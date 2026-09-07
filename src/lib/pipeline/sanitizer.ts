/**
 * sanitizer.ts — Stage 1: Text Sanitization
 *
 * Pure deterministic text cleaning. Zero LLM involvement.
 * Runs on ALL text extracted from any document type before it touches any model.
 *
 * What it strips:
 *  - Zero-width characters (ZWJ, ZWNJ, ZWSP, BOM, soft-hyphen, etc.)
 *  - Null bytes and C0/C1 control characters (except \n, \r, \t)
 *  - Collapse whitespace runs (multiple spaces/tabs → single space)
 *  - Collapse excessive newlines (3+ → 2)
 *  - Trim leading/trailing whitespace
 */

// Zero-width and invisible Unicode characters
const ZERO_WIDTH_RE =
  /[\u200B\u200C\u200D\u200E\u200F\uFEFF\u00AD\u2060\u2061\u2062\u2063\u2064\u2066\u2067\u2068\u2069\u206A\u206B\u206C\u206D\u206E\u206F]/g;

// Null bytes and C0/C1 control chars, EXCEPT newline (\n = 0x0A), carriage return (\r = 0x0D), tab (\t = 0x09)
const CONTROL_CHARS_RE =
  // eslint-disable-next-line no-control-regex
  /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F\x80-\x9F]/g;

// Multiple spaces or tabs (not newlines) → single space
const WHITESPACE_RUN_RE = /[^\S\n\r]+/g;

// 3+ consecutive newlines → 2 newlines (preserves paragraph breaks, kills excessive gaps)
const EXCESSIVE_NEWLINES_RE = /\n{3,}/g;

/**
 * Sanitize raw extracted text.
 *
 * @param raw - The raw text from a parser (pdf-parse, mammoth, raw file read, etc.)
 * @returns Cleaned text safe for LLM consumption
 */
export function sanitizeText(raw: string): string {
  if (!raw) return "";

  let text = raw;

  // 1. Strip zero-width / invisible characters
  text = text.replace(ZERO_WIDTH_RE, "");

  // 2. Strip control characters (keep \n, \r, \t)
  text = text.replace(CONTROL_CHARS_RE, "");

  // 3. Normalize \r\n and lone \r to \n
  text = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // 4. Collapse whitespace runs (spaces/tabs) → single space
  text = text.replace(WHITESPACE_RUN_RE, " ");

  // 5. Collapse excessive newlines (3+ → 2)
  text = text.replace(EXCESSIVE_NEWLINES_RE, "\n\n");

  // 6. Trim leading/trailing whitespace
  text = text.trim();

  return text;
}
