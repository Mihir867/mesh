/**
 * Pipeline barrel export — Stages 1, 2, and 3 modules.
 */

// Stage 1: Deterministic Parsers & Sanitizer
export { sanitizeText } from "./sanitizer";
export { parseTabular, type TabularResult } from "./tabular-parser";
export { extractText, type TextExtractionResult } from "./text-extractor";

// Gemini Client & Utilities
export { getGeminiClient, GEMINI_MODEL } from "./gemini-client";
export { withRetry } from "./retry";

// Stage 2: Schema Induction & Tabular Summary
export {
  induceSchema,
  type InducedField,
  type InducedSchema,
  type FieldDataType,
} from "./schema-inducer";
export { summarizeTabularData, type TabularSummary } from "./tabular-summary";

// Stage 3: Grounded Extraction
export {
  extractGroundedFields,
  type GroundedField,
  type ExtractionResult,
} from "./extractor";

// Stage 4: Orchestrator
export { processDocument } from "./orchestrator";
