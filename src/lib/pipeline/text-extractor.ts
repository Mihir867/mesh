/**
 * text-extractor.ts — Stage 1: Text Extraction
 *
 * Pure deterministic text extraction for PDF, DOCX, and TXT files. Zero LLM.
 *
 * PDF  → pdf2json → sanitize
 * DOCX → mammoth  → sanitize
 * TXT  → raw read → sanitize
 *
 * All extracted text is run through sanitizeText() before being returned.
 */

import PDFParser from "pdf2json";
import { sanitizeText } from "./sanitizer";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TextExtractionResult {
  /** The sanitized extracted text content */
  text: string;
  /** Number of pages (only available for PDF) */
  pageCount?: number;
}

// ---------------------------------------------------------------------------
// PDF Extractor
// ---------------------------------------------------------------------------

/**
 * Safely decode URI-encoded text strings emitted by pdf2json.
 * Avoids throwing `URIError: URI malformed` when PDFs contain unescaped `%` signs,
 * mathematical formulas, or non-standard byte sequences.
 */
function safeDecodeURIComponent(encoded: string): string {
  if (!encoded) return "";
  try {
    return decodeURIComponent(encoded);
  } catch {
    try {
      // Escape any % that is not followed by two hex digits
      return decodeURIComponent(encoded.replace(/%(?![0-9A-Fa-f]{2})/g, "%25"));
    } catch {
      try {
        // Fallback to legacy unescape
        return unescape(encoded);
      } catch {
        return encoded;
      }
    }
  }
}

async function extractPdf(buffer: Buffer): Promise<TextExtractionResult> {
  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser();

    pdfParser.on("pdfParser_dataError", (errData: any) => {
      const msg = errData?.parserError?.message || errData?.message || String(errData);
      reject(new Error(`PDF parsing failed: ${msg}`));
    });

    pdfParser.on("pdfParser_dataReady", (pdfData: any) => {
      // Extract text from all pages
      const textPages =
        pdfData.Pages?.map((page: any) => {
          return (
            page.Texts?.map((text: any) => {
              return safeDecodeURIComponent(text.R?.[0]?.T || "");
            }).join(" ") || ""
          );
        }) || [];

      const fullText = textPages.join("\n\n");
      const pageCount = pdfData.Pages?.length || 0;

      resolve({
        text: sanitizeText(fullText),
        pageCount,
      });
    });

    pdfParser.parseBuffer(buffer);
  });
}

// ---------------------------------------------------------------------------
// DOCX Extractor
// ---------------------------------------------------------------------------

async function extractDocx(buffer: Buffer): Promise<TextExtractionResult> {
  const mammoth = await import("mammoth");

  // mammoth.extractRawText returns plain text (no HTML markup)
  const result = await mammoth.extractRawText({ buffer });

  return {
    text: sanitizeText(result.value),
  };
}

// ---------------------------------------------------------------------------
// TXT Extractor
// ---------------------------------------------------------------------------

function extractTxt(buffer: Buffer): TextExtractionResult {
  const raw = buffer.toString("utf-8");

  return {
    text: sanitizeText(raw),
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Extract text from a document file.
 *
 * @param buffer - The raw file contents as a Node.js Buffer
 * @param type   - "PDF", "DOCX", or "TXT"
 * @returns Sanitized text content and optional page count
 * @throws If the type is unsupported
 */
export async function extractText(
  buffer: Buffer,
  type: "PDF" | "DOCX" | "TXT"
): Promise<TextExtractionResult> {
  switch (type) {
    case "PDF":
      return extractPdf(buffer);
    case "DOCX":
      return extractDocx(buffer);
    case "TXT":
      return extractTxt(buffer);
    default:
      throw new Error(`Unsupported text extraction format: ${type}`);
  }
}
