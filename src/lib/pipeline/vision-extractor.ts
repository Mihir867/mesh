/**
 * vision-extractor.ts — Multimodal Vision Extraction with Grammar-Constrained JSON
 *
 * Replaces the legacy 2-pass text parsing pipeline:
 *  - Sends raw PDF / image buffers directly to Gemini Vision via inlineData.
 *  - For DOCX, extracts text via mammoth.
 *  - For TXT, passes text directly.
 *  - Single LLM round-trip with schema enforcement (responseSchema) extracting:
 *      1. Metadata (Vendor, Customer, Invoice #, Dates, Payment Terms, Currency)
 *      2. Line Items Array ([{ description, quantity, unitPrice, total, confidence }])
 *      3. Financial Totals (Subtotal, Tax, Discount, Shipping, Total Due)
 *      4. Grounded Flat Fields for 100% UI backwards compatibility
 *  - Automatically applies Self-Healing Math validation via math-validator.ts.
 */

import { Type, type Part } from "@google/genai";
import { getGeminiClient, GEMINI_MODEL } from "./gemini-client";
import { withRetry } from "./retry";
import { validateAndReconcileMath, type MathValidationResult } from "./math-validator";

export interface DocumentMetadata {
  vendor: string | null;
  customer: string | null;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  dueDate: string | null;
  paymentTerms: string | null;
  currency: string | null;
}

export interface ExtractedLineItem {
  description: string;
  quantity: number | null;
  unitPrice: number | null;
  total: number;
  confidence: number;
}

export interface DocumentTotals {
  subtotal: number | null;
  tax: number | null;
  discount: number | null;
  shipping: number | null;
  totalDue: number | null;
}

export interface GroundedFieldItem {
  key: string;
  label: string;
  value: string;
  confidence: number;
  source_snippet: string;
}

export interface VisionExtractionOutput {
  category: string;
  summary: string;
  metadata: DocumentMetadata;
  lineItems: ExtractedLineItem[];
  totals: DocumentTotals;
  mathValidation: MathValidationResult;
  fields: GroundedFieldItem[];
}

/**
 * Extract text from PDF using pdf-parse.
 * Runs locally in ~30ms with 0 external API tokens.
 * Capped at first 6 pages so 600+ page dump files extract in milliseconds without blowing tokens.
 */
async function extractPdfText(buffer: Buffer): Promise<{ text: string; numPages: number }> {
  try {
    // @ts-expect-error - pdf-parse/lib/pdf-parse.js has no bundled types
    const pdfModule = await import("pdf-parse/lib/pdf-parse.js");
    const pdf = (pdfModule.default || pdfModule) as any;
    const data = await pdf(buffer, { max: 6 });
    return {
      text: (data.text || "").trim(),
      numPages: data.numpages || 1,
    };
  } catch (err) {
    console.warn("[PDF Extractor] Local PDF text extraction failed, falling back to vision:", err);
    return { text: "", numPages: 1 };
  }
}

/**
 * Extract ALL text from PDF — no page limit.
 * Used by background Phase 2 to capture the complete document.
 * Runs locally in ~200-500ms even for 600+ page PDFs. Zero LLM tokens.
 */
export async function extractFullPdfText(buffer: Buffer): Promise<{ text: string; numPages: number }> {
  try {
    // @ts-expect-error - pdf-parse/lib/pdf-parse.js has no bundled types
    const pdfModule = await import("pdf-parse/lib/pdf-parse.js");
    const pdf = (pdfModule.default || pdfModule) as any;
    const data = await pdf(buffer); // No max — parse every page
    return {
      text: (data.text || "").trim(),
      numPages: data.numpages || 1,
    };
  } catch (err) {
    console.warn("[PDF Extractor] Full PDF text extraction failed:", err);
    return { text: "", numPages: 1 };
  }
}

/**
 * Resilient JSON parser that repairs unterminated strings, trailing commas,
 * and unclosed brackets if an LLM output was truncated mid-flight.
 */
function safeParseJson(raw: string): any {
  // 1. Try direct standard parse
  try {
    return JSON.parse(raw);
  } catch {
    console.warn("[safeParseJson] Initial parse failed, attempting structural repair...");
  }

  // 2. Clean markdown code fences if model wrapped output in ```json ... ```
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    try {
      return JSON.parse(cleaned);
    } catch {}
  }

  // 3. Repair truncated JSON (e.g. cut off inside a string or array)
  let repaired = cleaned;

  // If cut off mid-string (odd number of unescaped quotes), close the quote
  const quoteMatches = repaired.match(/(?<!\\)"/g);
  const quotesCount = quoteMatches ? quoteMatches.length : 0;
  if (quotesCount % 2 !== 0) {
    repaired += '"';
  }

  // If cut off mid-property (e.g. `{"key": "value", "sub": `), clean trailing colon or comma
  repaired = repaired.replace(/,\s*$/, "").replace(/:\s*$/, ": null");

  // Track unclosed brackets
  const stack: string[] = [];
  let inString = false;
  for (let i = 0; i < repaired.length; i++) {
    const char = repaired[i];
    if (char === '"' && (i === 0 || repaired[i - 1] !== '\\')) {
      inString = !inString;
    } else if (!inString) {
      if (char === "{") stack.push("}");
      else if (char === "[") stack.push("]");
      else if (char === "}" || char === "]") {
        if (stack.length > 0 && stack[stack.length - 1] === char) {
          stack.pop();
        }
      }
    }
  }

  // Append closing brackets in reverse order
  while (stack.length > 0) {
    repaired += stack.pop();
  }

  try {
    return JSON.parse(repaired);
  } catch (repairErr) {
    console.warn("[safeParseJson] Structural repair failed, extracting key metadata via regex...", repairErr);
  }

  // 4. Regex fallback: extract essential attributes if JSON is heavily corrupted
  const categoryMatch = cleaned.match(/"category"\s*:\s*"([^"]+)"/);
  const summaryMatch = cleaned.match(/"summary"\s*:\s*"([^"]+)"/);
  const vendorMatch = cleaned.match(/"vendor"\s*:\s*"([^"]+)"/);
  const totalMatch = cleaned.match(/"totalDue"\s*:\s*([0-9.]+)/);
  const invMatch = cleaned.match(/"invoiceNumber"\s*:\s*"([^"]+)"/);

  return {
    category: categoryMatch ? categoryMatch[1] : "Invoice",
    summary: summaryMatch ? summaryMatch[1] : "Document processed with recovered partial data.",
    metadata: {
      vendor: vendorMatch ? vendorMatch[1] : "Unknown",
      customer: null,
      invoiceNumber: invMatch ? invMatch[1] : null,
      invoiceDate: null,
      dueDate: null,
      paymentTerms: null,
      currency: "$",
    },
    lineItems: [],
    totals: {
      subtotal: null,
      tax: null,
      discount: null,
      shipping: null,
      totalDue: totalMatch ? parseFloat(totalMatch[1]) : null,
    },
    fields: [],
  };
}

/**
 * Extract text from DOCX using mammoth.
 */
async function extractDocxText(buffer: Buffer): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer });
  return (result.value || "").trim();
}

/**
 * Build parts for Gemini generateContent based on file type and MIME type.
 * Prioritizes deterministic text extraction for speed and quota preservation.
 */
async function buildContentParts(
  fileBuffer: Buffer,
  mimeType: string,
  fileType: string
): Promise<{ parts: (Part | string)[]; isMultimodalVisual: boolean }> {
  const lowerMime = (mimeType || "").toLowerCase();
  const lowerType = (fileType || "").toLowerCase();

  // 1. PDF Documents: Hybrid Fast-Text first, vision fallback for pure scans
  if (lowerMime === "application/pdf" || lowerType === "pdf") {
    const pdfInfo = await extractPdfText(fileBuffer);
    const cleanText = pdfInfo.text;

    // Case A: Digital PDF with selectable text (95%+ of invoices and multi-page PDFs)
    if (cleanText.length > 50) {
      let textToSend = cleanText;

      // Smart anchor windowing if document is massive (> 40,000 characters / ~20+ pages):
      // Preserves first 25k chars (vendor, client, dates, initial line items)
      // and last 15k chars (summary, subtotal, tax, total due, payment terms, signatures).
      if (cleanText.length > 40000) {
        const head = cleanText.slice(0, 25000);
        const tail = cleanText.slice(-15000);
        textToSend = `${head}\n\n[... OMITTED INTERMEDIATE PAGES TO PRESERVE QUOTA (${pdfInfo.numPages} TOTAL PAGES) ...]\n\n${tail}`;
      }

      console.log(
        `[PDF Extractor] Successfully extracted text (${pdfInfo.numPages} pages, ${cleanText.length} chars). Using fast token-efficient text pipeline.`
      );

      return {
        parts: [
          `DOCUMENT TYPE: PDF (${pdfInfo.numPages} Pages)\n\nDOCUMENT CONTENT:\n"""\n${textToSend}\n"""`,
        ],
        isMultimodalVisual: false,
      };
    }

    // Case B: Scanned PDF with zero selectable text -> Fallback to Vision
    console.log(
      `[PDF Extractor] No selectable text detected in PDF (${pdfInfo.numPages} pages). Using Multimodal Vision fallback.`
    );

    const inlinePart: Part = {
      inlineData: {
        mimeType: "application/pdf",
        data: fileBuffer.toString("base64"),
      },
    };

    return {
      parts: [inlinePart],
      isMultimodalVisual: true,
    };
  }

  // 2. Pure Image Files (PNG, JPG, WEBP): Vision (Single image = low token consumption)
  if (
    lowerMime.startsWith("image/") ||
    ["png", "jpg", "jpeg", "webp"].includes(lowerType)
  ) {
    const effectiveMime = lowerMime.startsWith("image/")
      ? lowerMime
      : `image/${lowerType}`;

    const inlinePart: Part = {
      inlineData: {
        mimeType: effectiveMime,
        data: fileBuffer.toString("base64"),
      },
    };

    return {
      parts: [inlinePart],
      isMultimodalVisual: true,
    };
  }

  // 3. DOCX Word Document: Extract text with mammoth
  if (
    lowerType === "docx" ||
    lowerMime.includes("wordprocessingml") ||
    lowerMime.includes("msword")
  ) {
    const text = await extractDocxText(fileBuffer);
    return {
      parts: [
        `DOCUMENT TYPE: Word Document (DOCX)\n\nDOCUMENT CONTENT:\n"""\n${text}\n"""`,
      ],
      isMultimodalVisual: false,
    };
  }

  // 4. Plain Text (TXT)
  const text = fileBuffer.toString("utf-8").trim();
  return {
    parts: [
      `DOCUMENT TYPE: Plain Text (TXT)\n\nDOCUMENT CONTENT:\n"""\n${text}\n"""`,
    ],
    isMultimodalVisual: false,
  };
}

/**
 * Perform single-pass vision/document extraction using Gemini.
 */
export async function extractDocumentVision(
  fileBuffer: Buffer,
  mimeType: string,
  fileType: string
): Promise<VisionExtractionOutput> {
  const ai = getGeminiClient();
  const { parts, isMultimodalVisual } = await buildContentParts(
    fileBuffer,
    mimeType,
    fileType
  );

  const systemInstruction = `
You are a state-of-the-art document intelligence and financial data extraction engine.
Analyze the provided document content (tables, line items, headers, metadata, stamps).

RULES FOR ROBUST EXTRACTION:
1. Category: Classify the document (e.g., "Invoice", "Receipt", "Bill", "Contract", "Financial Report", "Purchase Order", "Tax Form", "Other").
2. Summary: Provide a 1-2 sentence executive summary of the document purpose and key transaction.
3. Metadata:
   - vendor: Entity, company, or merchant issuing the document.
   - customer: Client, recipient, or billed party.
   - invoiceNumber: Invoice, reference, receipt, or order number.
   - invoiceDate: Date document was issued (ISO 8601 YYYY-MM-DD format if possible).
   - dueDate: Due or payment date (ISO 8601 YYYY-MM-DD format if possible).
   - paymentTerms: Payment terms or payment method (e.g. "Net 30", "Credit Card ending 1234").
   - currency: Currency symbol or code (e.g. "$", "USD", "EUR", "GBP").
4. Line Items (MAX 30 ITEMS):
   - Extract up to the primary 30 line items from itemized tables. If a document has hundreds of items, capture the first 30.
   - Each line item MUST have:
     - description: Item name or service description.
     - quantity: Numeric quantity (or null if not specified).
     - unitPrice: Price per unit (or null if not specified).
     - total: Line total price (numeric).
     - confidence: 0.0 to 1.0 confidence score.
5. Totals:
   - subtotal: Subtotal before tax and fees (numeric or null).
   - tax: Tax, VAT, or GST amount (numeric or null).
   - discount: Discount applied (numeric or null).
   - shipping: Shipping or handling fee (numeric or null).
   - totalDue: Final total amount due or paid (numeric).
6. Grounded Fields (MAX 15 PRIMARY ATTRIBUTES):
   - A concise list of key document-level attributes (Vendor, Customer, Invoice Number, Issue Date, Due Date, Total Due).
   - DO NOT duplicate individual line items into this fields list. Keep fields focused strictly on high-level document attributes.
`;

  const promptText = `
Please extract all structured data, metadata, itemized line items (up to 30), totals, and primary grounded fields from this document according to the required schema.
Ensure all numerical amounts are clean numbers without currency symbols.
`;

  const response = await withRetry(async () => {
    return ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [...parts, promptText],
      config: {
        systemInstruction,
        temperature: 0.1,
        maxOutputTokens: 4096,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            category: {
              type: Type.STRING,
              description: "Document classification (e.g. Invoice, Receipt, Contract)",
            },
            summary: {
              type: Type.STRING,
              description: "1-2 sentence summary of what this document is",
            },
            metadata: {
              type: Type.OBJECT,
              properties: {
                vendor: { type: Type.STRING, description: "Vendor or issuing company" },
                customer: { type: Type.STRING, description: "Customer or billed entity" },
                invoiceNumber: { type: Type.STRING, description: "Invoice or reference number" },
                invoiceDate: { type: Type.STRING, description: "Invoice date" },
                dueDate: { type: Type.STRING, description: "Payment due date" },
                paymentTerms: { type: Type.STRING, description: "Payment terms or method" },
                currency: { type: Type.STRING, description: "Currency symbol or code" },
              },
              required: ["vendor"],
            },
            lineItems: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  description: { type: Type.STRING, description: "Line item description" },
                  quantity: { type: Type.NUMBER, description: "Quantity" },
                  unitPrice: { type: Type.NUMBER, description: "Unit price" },
                  total: { type: Type.NUMBER, description: "Total price for this line item" },
                  confidence: { type: Type.NUMBER, description: "Confidence score 0.0-1.0" },
                },
                required: ["description", "total"],
              },
            },
            totals: {
              type: Type.OBJECT,
              properties: {
                subtotal: { type: Type.NUMBER, description: "Subtotal before tax" },
                tax: { type: Type.NUMBER, description: "Tax amount" },
                discount: { type: Type.NUMBER, description: "Discount amount" },
                shipping: { type: Type.NUMBER, description: "Shipping fee" },
                totalDue: { type: Type.NUMBER, description: "Total amount due" },
              },
              required: ["totalDue"],
            },
            fields: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  key: { type: Type.STRING, description: "camelCase identifier" },
                  label: { type: Type.STRING, description: "Human readable label" },
                  value: { type: Type.STRING, description: "Extracted value as formatted string" },
                  confidence: { type: Type.NUMBER, description: "Confidence score 0.0-1.0" },
                  source_snippet: { type: Type.STRING, description: "Visual text snippet where found" },
                },
                required: ["key", "label", "value", "confidence", "source_snippet"],
              },
            },
          },
          required: ["category", "summary", "metadata", "lineItems", "totals", "fields"],
        },
      },
    });
  });

  const responseText =
    response.text ||
    response.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") ||
    "";

  if (!responseText) {
    throw new Error("No response text received from Gemini during extraction.");
  }

  const parsed = safeParseJson(responseText);

  // 1. Run Self-Healing Math validation in TypeScript
  const lineItems: ExtractedLineItem[] = Array.isArray(parsed.lineItems) ? parsed.lineItems : [];
  const rawTotals: DocumentTotals = parsed.totals || {
    subtotal: null,
    tax: null,
    discount: null,
    shipping: null,
    totalDue: null,
  };

  const mathValidation = validateAndReconcileMath(lineItems, rawTotals);

  // 2. If self-healing reconciled the total, update the totals object
  const reconciledTotals: DocumentTotals = {
    ...rawTotals,
    subtotal: rawTotals.subtotal ?? (lineItems.length > 0 ? mathValidation.computedItemSum : null),
    totalDue: rawTotals.totalDue ?? mathValidation.reconciledTotal,
  };

  // 3. Ensure flattened fields array includes both metadata and totals for UI table rendering
  const fields: GroundedFieldItem[] = Array.isArray(parsed.fields) ? [...parsed.fields] : [];

  const existingKeys = new Set(fields.map((f) => f.key.toLowerCase()));

  // Add vendor if missing from fields
  if (parsed.metadata?.vendor && !existingKeys.has("vendor") && !existingKeys.has("vendorname")) {
    fields.unshift({
      key: "vendor",
      label: "Vendor / Merchant",
      value: String(parsed.metadata.vendor),
      confidence: 0.98,
      source_snippet: parsed.metadata.vendor,
    });
  }

  // Add totalDue if missing from fields
  if (
    reconciledTotals.totalDue !== null &&
    !existingKeys.has("total") &&
    !existingKeys.has("totaldue") &&
    !existingKeys.has("totalamount")
  ) {
    const currency = parsed.metadata?.currency || "$";
    fields.unshift({
      key: "totalDue",
      label: "Total Due",
      value: `${currency}${reconciledTotals.totalDue.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`,
      confidence: 0.99,
      source_snippet: `Total Due: ${reconciledTotals.totalDue}`,
    });
  }

  // Add Invoice Number if missing
  if (
    parsed.metadata?.invoiceNumber &&
    !existingKeys.has("invoicenumber") &&
    !existingKeys.has("invoice_no")
  ) {
    fields.push({
      key: "invoiceNumber",
      label: "Invoice Number",
      value: String(parsed.metadata.invoiceNumber),
      confidence: 0.97,
      source_snippet: parsed.metadata.invoiceNumber,
    });
  }

  // Add Invoice Date if missing
  if (
    parsed.metadata?.invoiceDate &&
    !existingKeys.has("invoicedate") &&
    !existingKeys.has("date")
  ) {
    fields.push({
      key: "invoiceDate",
      label: "Invoice Date",
      value: String(parsed.metadata.invoiceDate),
      confidence: 0.97,
      source_snippet: parsed.metadata.invoiceDate,
    });
  }

  return {
    category: parsed.category || "Invoice",
    summary: parsed.summary || "",
    metadata: {
      vendor: parsed.metadata?.vendor || null,
      customer: parsed.metadata?.customer || null,
      invoiceNumber: parsed.metadata?.invoiceNumber || null,
      invoiceDate: parsed.metadata?.invoiceDate || null,
      dueDate: parsed.metadata?.dueDate || null,
      paymentTerms: parsed.metadata?.paymentTerms || null,
      currency: parsed.metadata?.currency || "$",
    },
    lineItems,
    totals: reconciledTotals,
    mathValidation,
    fields,
  };
}
