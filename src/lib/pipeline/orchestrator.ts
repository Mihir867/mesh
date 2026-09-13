/**
 * orchestrator.ts — Pipeline Orchestrator (Stage 4)
 *
 * Ties all pipeline stages together:
 *  - Fetches Document from PostgreSQL via Prisma
 *  - Transitions status: UPLOADED → PROCESSING → COMPLETED (or FAILED)
 *  - Downloads file buffer from Supabase Storage
 *  - Routes through:
 *      Path A (CSV / XLSX) : Deterministic Tabular Parser → Gemini Category/Summary → DB
 *      Path B (PDF/DOCX/TXT): Deterministic Text Extractor → Schema Induction → Grounded Extraction → DB
 *  - Upserts structured Extraction row and updates Document in an atomic Prisma transaction.
 */

import { prisma } from "@/lib/prisma";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { parseTabular } from "./tabular-parser";
import { summarizeTabularData } from "./tabular-summary";
import { extractDocumentVision, extractFullPdfText } from "./vision-extractor";
import type { Document, Extraction, Prisma } from "@prisma/client";

const BUCKET_NAME = process.env.SUPABASE_BUCKET_NAME || "MESH";

/**
 * Fetch file buffer from a public URL or directly from Supabase Storage.
 */
async function fetchFileBuffer(fileUrl: string): Promise<Buffer> {
  try {
    const response = await fetch(fileUrl);
    if (response.ok) {
      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    }
  } catch (err) {
    console.warn(`[Orchestrator] Direct fetch failed for ${fileUrl}, trying Supabase SDK fallback:`, err);
  }

  // Fallback: Extract storage path from Supabase URL and download directly
  try {
    const urlObj = new URL(fileUrl);
    // Typical path: /storage/v1/object/public/<BUCKET_NAME>/<FILE_PATH>
    const match = urlObj.pathname.match(new RegExp(`/storage/v1/object/(?:public|sign)/[^/]+/(.+)`));
    const storagePath = match ? decodeURIComponent(match[1]) : urlObj.pathname.split("/").pop();

    if (storagePath) {
      const { data, error } = await supabaseAdmin.storage
        .from(BUCKET_NAME)
        .download(storagePath);

      if (error) {
        throw new Error(`Supabase storage download failed: ${error.message}`);
      }

      const arrayBuffer = await data.arrayBuffer();
      return Buffer.from(arrayBuffer);
    }
  } catch (fallbackErr: any) {
    throw new Error(`Failed to retrieve file from ${fileUrl}: ${fallbackErr.message || fallbackErr}`);
  }

  throw new Error(`Could not fetch file content from: ${fileUrl}`);
}

/**
 * Phase 2: Background full-text enrichment (fire-and-forget).
 *
 * Parses ALL pages from the PDF locally using pdf-parse (no page limit).
 * Stores the complete document text in `rawText` and marks `extractionDepth`
 * as "FULL". Zero LLM tokens — pure local text extraction.
 *
 * This runs AFTER the synchronous Phase 1 returns to the user, so the UI
 * gets instant results while this enriches the database in the background.
 */
async function enrichFullText(documentId: string, fileUrl: string): Promise<void> {
  try {
    const startMs = Date.now();
    const buffer = await fetchFileBuffer(fileUrl);
    const { text: fullText, numPages } = await extractFullPdfText(buffer);

    if (!fullText || fullText.length < 100) {
      console.log(
        `[Orchestrator] Skipping full-text enrichment for ${documentId} — insufficient text (${fullText.length} chars)`
      );
      return;
    }

    await prisma.document.update({
      where: { id: documentId },
      data: {
        rawText: fullText,
        extractionDepth: "FULL",
      },
    });

    const elapsedMs = Date.now() - startMs;
    console.log(
      `[Orchestrator] ✅ Full-text enrichment complete: ${documentId} — ${numPages} pages, ${fullText.length.toLocaleString()} chars in ${elapsedMs}ms`
    );
  } catch (err) {
    // Non-fatal: the partial extraction from Phase 1 is still valid and usable
    console.error(`[Orchestrator] Full-text enrichment error for ${documentId}:`, err);
  }
}

/**
 * Top-level orchestration function. Processes an uploaded document through the pipeline
 * and persists the structured extraction in PostgreSQL.
 *
 * @param documentId - UUID of the Document record
 * @returns Updated Document and upserted Extraction record
 */
export async function processDocument(documentId: string): Promise<{
  document: Document;
  extraction: Extraction;
}> {
  // 1. Fetch document record
  const doc = await prisma.document.findUnique({
    where: { id: documentId },
  });

  if (!doc) {
    throw new Error(`Document with ID "${documentId}" was not found.`);
  }

  // 2. Transition status to PROCESSING
  await prisma.document.update({
    where: { id: documentId },
    data: {
      status: "PROCESSING",
      errorMessage: null,
    },
  });

  try {
    let category: string;
    let summary: string;
    let extractedData: Prisma.InputJsonValue;
    let rawText: string | null = null;

    const fileBuffer = await fetchFileBuffer(doc.fileUrl);

    // =========================================================================
    // PATH A: Tabular files (CSV / XLSX) — Skip LLM schema induction
    // =========================================================================
    if (doc.fileType === "CSV" || doc.fileType === "XLSX") {
      const tabular = parseTabular(fileBuffer, doc.fileType as "CSV" | "XLSX");

      extractedData = {
        headers: tabular.headers,
        rowCount: tabular.rowCount,
        rows: tabular.rows as Prisma.InputJsonValue[],
      };

      // Fast, lightweight LLM call to classify category & produce summary
      const tableSummary = await summarizeTabularData(tabular.headers, tabular.rows);

      category = tableSummary.category;
      summary = tableSummary.summary;

      // Persist sample text for chat context
      rawText = `Headers: ${tabular.headers.join(", ")}\n\nSample Data (first 20 rows):\n${JSON.stringify(
        tabular.rows.slice(0, 20),
        null,
        2
      )}`;
    }

    // =========================================================================
    // PATH B: Documents (PDF / DOCX / TXT / Images) — Multimodal Vision Single Pass
    // =========================================================================
    else {
      const visionResult = await extractDocumentVision(
        fileBuffer,
        doc.mimeType,
        doc.fileType
      );

      category = visionResult.category;
      summary = visionResult.summary;
      extractedData = visionResult as unknown as Prisma.InputJsonValue;

      // Persist structured context summary for search & chat
      rawText = `Category: ${visionResult.category}\nVendor: ${visionResult.metadata.vendor || "N/A"}\nSummary: ${visionResult.summary}\nLine Items: ${visionResult.lineItems.length}\nTotal Due: ${visionResult.totals.totalDue ?? "N/A"}`;
    }

    // =========================================================================
    // Stage 4: Atomic Database Transaction
    // =========================================================================
    const [updatedDoc, savedExtraction] = await prisma.$transaction([
      prisma.document.update({
        where: { id: documentId },
        data: {
          status: "COMPLETED",
          rawText,
          errorMessage: null,
        },
      }),
      prisma.extraction.upsert({
        where: { documentId },
        update: {
          category,
          summary,
          data: extractedData,
        },
        create: {
          documentId,
          category,
          summary,
          data: extractedData,
        },
      }),
    ]);

    // =========================================================================
    // Phase 2: Background full-text enrichment (fire-and-forget)
    // For PDFs, asynchronously parse ALL pages and store the complete text.
    // This does NOT block the API response — the user gets instant results.
    // Zero additional LLM tokens — pure local pdf-parse extraction.
    // =========================================================================
    if (doc.fileType === "PDF") {
      enrichFullText(documentId, doc.fileUrl).catch((err) => {
        console.error(`[Orchestrator] Background full-text enrichment failed for ${documentId}:`, err);
      });
    }

    return {
      document: updatedDoc,
      extraction: savedExtraction,
    };
  } catch (error: any) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[Orchestrator] Document processing failed for ${documentId}:`, message);

    // Persist failure status and message
    await prisma.document.update({
      where: { id: documentId },
      data: {
        status: "FAILED",
        errorMessage: message,
      },
    });

    throw error;
  }
}
