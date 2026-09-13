/**
 * Pipeline barrel export — Deterministic Tabular & Multimodal Vision Modules.
 */

// Tabular Deterministic Parser (CSV & XLSX)
export { parseTabular, type TabularResult } from "./tabular-parser";
export { summarizeTabularData, type TabularSummary } from "./tabular-summary";

// Multimodal Vision Extractor (PDF, DOCX, TXT, Images)
export {
  extractDocumentVision,
  extractFullPdfText,
  type VisionExtractionOutput,
  type DocumentMetadata,
  type ExtractedLineItem,
  type DocumentTotals,
  type GroundedFieldItem,
} from "./vision-extractor";

// Self-Healing Math Validator
export {
  validateAndReconcileMath,
  type MathValidationResult,
  type LineItemInput,
  type DocumentTotalsInput,
} from "./math-validator";

// Gemini Client & Utilities
export { getGeminiClient, GEMINI_MODEL } from "./gemini-client";
export { withRetry, type RetryOptions } from "./retry";

// Orchestrator
export { processDocument } from "./orchestrator";
