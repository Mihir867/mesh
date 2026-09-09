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
import { extractText } from "./text-extractor";
import { induceSchema } from "./schema-inducer";
import { extractGroundedFields } from "./extractor";
import { summarizeTabularData } from "./tabular-summary";
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
    // PATH B: Text documents (PDF / DOCX / TXT) — Full 4-stage pipeline
    // =========================================================================
    else {
      const { text } = await extractText(
        fileBuffer,
        doc.fileType as "PDF" | "DOCX" | "TXT"
      );
      rawText = text;

      // Stage 2: Schema induction (first ~4000 characters)
      const schema = await induceSchema(text);

      category = schema.category;
      summary = schema.summary;

      // Stage 3: Grammar-constrained grounded extraction (full text)
      const extraction = await extractGroundedFields(text, schema);

      extractedData = extraction.fields as unknown as Prisma.InputJsonValue;
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
