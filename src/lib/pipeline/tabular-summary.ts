/**
 * tabular-summary.ts — Fast Tabular Classification & Summary
 *
 * CSV and XLSX files skip full schema induction (headers are already explicit).
 * This module performs a single, fast, low-cost Gemini call to categorize
 * the spreadsheet and generate a 1-2 sentence overview for the UI dashboard.
 */

import { Type } from "@google/genai";
import { getGeminiClient, GEMINI_MODEL } from "./gemini-client";
import { withRetry } from "./retry";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TabularSummary {
  /** High-level classification (e.g. Financial_Data, Sales_Report, Inventory, Employee_Records, Other) */
  category: string;
  /** 1-2 sentence summary of what this dataset contains */
  summary: string;
}

// ---------------------------------------------------------------------------
// Tabular Summarizer
// ---------------------------------------------------------------------------

/**
 * Classify and summarize tabular data based on column headers and sample rows.
 *
 * @param headers - Column names from the parsed CSV/XLSX
 * @param sampleRows - Up to first 3 rows of parsed data
 * @returns Inferred category and 1-2 sentence summary
 */
export async function summarizeTabularData(
  headers: string[],
  sampleRows: Record<string, unknown>[]
): Promise<TabularSummary> {
  const ai = getGeminiClient();

  const response = await withRetry(async () => {
    return ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: `
Classify and summarize this spreadsheet data.

Column Headers: ${JSON.stringify(headers)}
Sample Rows (first 3):
${JSON.stringify(sampleRows.slice(0, 3), null, 2)}
`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            category: {
              type: Type.STRING,
              description:
                "e.g. Financial_Data, Sales_Report, Inventory, Employee_Records, Other",
            },
            summary: {
              type: Type.STRING,
              description: "1-2 sentence summary of what this data contains",
            },
          },
          required: ["category", "summary"],
        },
      },
    });
  });

  const responseText = response.text;
  if (!responseText) {
    throw new Error(
      "No response text received from Gemini during tabular summarization."
    );
  }

  return JSON.parse(responseText) as TabularSummary;
}
