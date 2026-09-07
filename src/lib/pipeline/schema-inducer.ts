/**
 * schema-inducer.ts — Stage 2: Schema Induction (Text Documents Only)
 *
 * Runs ONLY for PDF, DOCX, and TXT.
 * Sends first ~4000 chars to Gemini with grammar-constrained decoding (responseSchema).
 * Returns document category, summary, and typed field specifications.
 */

import { Type } from "@google/genai";
import { getGeminiClient, GEMINI_MODEL } from "./gemini-client";
import { withRetry } from "./retry";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FieldDataType = "string" | "number" | "date" | "boolean" | "array";

export interface InducedField {
  /** camelCase identifier for the field (e.g. invoiceNumber, totalAmount) */
  key: string;
  /** Human-readable title for UI presentation */
  label: string;
  /** Inferred data type */
  type: FieldDataType;
}

export interface InducedSchema {
  /** Document classification (e.g. Invoice, Contract, Receipt, Resume, etc.) */
  category: string;
  /** 1-2 sentence overview of the document */
  summary: string;
  /** Discovered structured fields to extract */
  fields: InducedField[];
}

// ---------------------------------------------------------------------------
// Schema Inducer
// ---------------------------------------------------------------------------

/**
 * Analyze document text excerpt, classify document type, and induce an extraction schema.
 *
 * @param textSample - Document text (up to first ~4000 characters used)
 * @returns Inferred category, summary, and target fields array
 */
export async function induceSchema(textSample: string): Promise<InducedSchema> {
  const ai = getGeminiClient();
  const sample = (textSample || "").slice(0, 4000);

  const response = await withRetry(async () => {
    return ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: `
Analyze the following document excerpt.
Classify it and define the data fields that should be extracted.

Document Excerpt:
"""
${sample}
"""
`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            category: {
              type: Type.STRING,
              description:
                "Document type: Invoice, Contract, Report, Letter, Resume, Medical_Record, Legal, Receipt, Other",
            },
            summary: {
              type: Type.STRING,
              description: "1-2 sentence summary of the document",
            },
            fields: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  key: {
                    type: Type.STRING,
                    description: "camelCase field name (e.g. totalAmount, dueDate)",
                  },
                  label: {
                    type: Type.STRING,
                    description: "Human-readable label",
                  },
                  type: {
                    type: Type.STRING,
                    enum: ["string", "number", "date", "boolean", "array"],
                  },
                },
                required: ["key", "label", "type"],
              },
            },
          },
          required: ["category", "summary", "fields"],
        },
      },
    });
  });

  const responseText = response.text;
  if (!responseText) {
    throw new Error("No response text received from Gemini during schema induction.");
  }

  return JSON.parse(responseText) as InducedSchema;
}
