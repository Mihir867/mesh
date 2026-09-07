/**
 * tabular-parser.ts — Stage 1: Tabular Data Extraction
 *
 * Pure deterministic parsing for CSV and XLSX files. Zero LLM involvement.
 *
 * CSV  → papaparse (header mode, dynamic typing, skip empty lines)
 * XLSX → xlsx (first sheet → JSON rows with headers)
 *
 * Returns a uniform TabularResult shape regardless of input format.
 */

import Papa from "papaparse";
import * as XLSX from "xlsx";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TabularResult {
  /** Column names from the first row / header row */
  headers: string[];
  /** Array of row objects keyed by header names */
  rows: Record<string, unknown>[];
  /** Total number of data rows (excluding header) */
  rowCount: number;
}

// ---------------------------------------------------------------------------
// CSV Parser
// ---------------------------------------------------------------------------

function parseCsv(buffer: Buffer): TabularResult {
  const text = buffer.toString("utf-8");

  const result = Papa.parse<Record<string, unknown>>(text, {
    header: true,
    dynamicTyping: true,
    skipEmptyLines: "greedy", // skip lines that are empty or contain only whitespace
    transformHeader: (header: string) => header.trim(),
  });

  // Filter out rows where every value is null/undefined/empty
  const rows = result.data.filter((row) =>
    Object.values(row).some(
      (v) => v !== null && v !== undefined && v !== ""
    )
  );

  const headers =
    result.meta.fields?.map((f) => f.trim()).filter(Boolean) ?? [];

  return {
    headers,
    rows,
    rowCount: rows.length,
  };
}

// ---------------------------------------------------------------------------
// XLSX Parser
// ---------------------------------------------------------------------------

function parseXlsx(buffer: Buffer): TabularResult {
  const workbook = XLSX.read(buffer, { type: "buffer" });

  // Use the first sheet
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    return { headers: [], rows: [], rowCount: 0 };
  }

  const sheet = workbook.Sheets[firstSheetName];
  if (!sheet) {
    return { headers: [], rows: [], rowCount: 0 };
  }

  // Convert to JSON with headers from the first row
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: null, // default value for empty cells
  });

  // Extract headers from the first row's keys
  const headers =
    rawRows.length > 0
      ? Object.keys(rawRows[0]).filter((k) => k.trim() !== "")
      : [];

  // Filter out fully-empty rows
  const rows = rawRows.filter((row) =>
    Object.values(row).some(
      (v) => v !== null && v !== undefined && v !== ""
    )
  );

  return {
    headers,
    rows,
    rowCount: rows.length,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse a tabular file (CSV or XLSX) into a uniform result.
 *
 * @param buffer - The raw file contents as a Node.js Buffer
 * @param type   - "CSV" or "XLSX"
 * @returns Parsed headers, rows, and rowCount
 * @throws If the type is unsupported
 */
export function parseTabular(
  buffer: Buffer,
  type: "CSV" | "XLSX"
): TabularResult {
  switch (type) {
    case "CSV":
      return parseCsv(buffer);
    case "XLSX":
      return parseXlsx(buffer);
    default:
      throw new Error(`Unsupported tabular format: ${type}`);
  }
}
