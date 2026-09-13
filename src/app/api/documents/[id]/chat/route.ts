import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { getGeminiClient, GEMINI_MODEL } from "@/lib/pipeline/gemini-client";
import { withRetry } from "@/lib/pipeline/retry";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/documents/[id]/chat
 * Returns the full persisted chat history for a document.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Please sign in." },
        { status: 401 }
      );
    }

    const { id: documentId } = await params;
    if (!documentId) {
      return NextResponse.json(
        { success: false, error: "Document ID is required." },
        { status: 400 }
      );
    }

    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: {
        user: { select: { clerkId: true } },
      },
    });

    if (!document) {
      return NextResponse.json(
        { success: false, error: "Document not found." },
        { status: 404 }
      );
    }

    if (document.user.clerkId !== clerkUserId) {
      return NextResponse.json(
        { success: false, error: "Forbidden. Document belongs to another user." },
        { status: 403 }
      );
    }

    const messages = await prisma.chatMessage.findMany({
      where: { documentId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        role: true,
        content: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      messages: messages.map((m) => ({
        id: m.id,
        role: m.role.toLowerCase() as "user" | "assistant",
        content: m.content,
        createdAt: m.createdAt.toISOString(),
      })),
    });
  } catch (error: any) {
    console.error("[Chat GET] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to load chat messages." },
      { status: 500 }
    );
  }
}

/**
 * POST /api/documents/[id]/chat
 * Persists user message, calls Gemini with minimal extraction context, and persists assistant reply.
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Please sign in." },
        { status: 401 }
      );
    }

    const { id: documentId } = await params;
    if (!documentId) {
      return NextResponse.json(
        { success: false, error: "Document ID is required." },
        { status: 400 }
      );
    }

    const body = await req.json();
    const userPrompt = (body.message || "").trim();

    if (!userPrompt) {
      return NextResponse.json(
        { success: false, error: "Message cannot be empty." },
        { status: 400 }
      );
    }

    // 1. Fetch document and extraction
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: {
        extraction: true,
        user: { select: { clerkId: true } },
      },
    });

    if (!document) {
      return NextResponse.json(
        { success: false, error: "Document not found." },
        { status: 404 }
      );
    }

    if (document.user.clerkId !== clerkUserId) {
      return NextResponse.json(
        { success: false, error: "Forbidden. Document belongs to another user." },
        { status: 403 }
      );
    }

    if (!document.extraction) {
      return NextResponse.json(
        {
          success: false,
          error: "Document has not completed structured extraction yet. Please wait for extraction to finish.",
        },
        { status: 400 }
      );
    }

    // 2. Persist the user's message to the database
    const userMessageRecord = await prisma.chatMessage.create({
      data: {
        documentId: document.id,
        role: "USER",
        content: userPrompt,
      },
    });

    // 3. Fetch recent message history (last 10 messages before current)
    const recentHistory = await prisma.chatMessage.findMany({
      where: {
        documentId: document.id,
        id: { not: userMessageRecord.id },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    // Reverse to chronological order
    const chronologicalHistory = recentHistory.reverse();

    // 4. Construct System Instruction with structured extraction + full document text
    // The structured extraction JSON provides precise fields/totals for grounded answers.
    // When available, rawText from Phase 2 enrichment provides the complete document text
    // so chat can answer questions about ANY page, not just the first 6 pages.
    const extraction = document.extraction;

    // Build raw text context with smart windowing for the LLM context window
    let rawTextSection = "";
    if (document.rawText && document.rawText.length > 0) {
      // Gemini 2.0 Flash supports 1M tokens (~4M chars) context
      // We'll use up to 300K chars (75K tokens) for document content
      const MAX_CONTEXT_CHARS = 300000;
      let rawTextContent: string;

      if (document.rawText.length <= MAX_CONTEXT_CHARS) {
        // Document fits entirely in context window
        rawTextContent = document.rawText;
      } else {
        // For massive documents (1M+ chars), use strategic sampling:
        // - First 100K chars: Headers, metadata, initial content
        // - Middle 100K chars: Sample from document middle (around page 340/684)
        // - Last 100K chars: Totals, signatures, final content
        const head = document.rawText.slice(0, 100000);
        const middleStart = Math.floor(document.rawText.length / 2) - 50000;
        const middle = document.rawText.slice(middleStart, middleStart + 100000);
        const tail = document.rawText.slice(-100000);
        
        const omittedChars = document.rawText.length - 300000;
        rawTextContent = `${head}\n\n[... ~${omittedChars.toLocaleString()} characters omitted for context efficiency. Content includes beginning, middle sample (around page ${Math.floor(684/2)}), and end sections. ...]\n\n--- MIDDLE SECTION SAMPLE ---\n${middle}\n\n--- FINAL SECTION ---\n${tail}`;
      }

      rawTextSection = `
<DOCUMENT_RAW_TEXT>
${rawTextContent}
</DOCUMENT_RAW_TEXT>`;
    }

    const systemInstruction = `
You are MESH AI, an intelligent, precise assistant specialized in answering questions about this specific document.
You answer based on the structured extraction JSON, summary, and full document text provided below.

RULES:
1. Ground your answers directly in the provided data — extraction fields, raw text, numbers, dates, and facts.
2. Be concise, direct, helpful, and polite. Avoid unnecessary conversational fluff.
3. If the user asks about information not found in the extraction data OR the raw document text, clearly explain that it is not present.
4. When answering, prefer specific data from the structured extraction for precision, and use the raw text for broader context or details not captured in the extraction schema.
5. Format responses cleanly using GitHub Markdown:
   - Use compact section headers (prefer ### or ####, avoid top-level # or ##).
   - Use bullet points with bold field names (e.g., "- **Metric Name:** Value").
   - Use Markdown tables when presenting multiple financial periods, dates, or tabular comparisons.
   - Format monetary figures, percentages, and IDs with clear notation.

<DOCUMENT_STRUCTURED_CONTEXT>
Document Name: ${document.name}
File Type: ${document.fileType}
Category: ${extraction.category}
Summary: ${extraction.summary}

Extracted JSON Data:
${JSON.stringify(extraction.data, null, 2)}
</DOCUMENT_STRUCTURED_CONTEXT>
${rawTextSection}
`;

    // Map history to Gemini content format
    const contents: Array<{ role: "user" | "model"; parts: Array<{ text: string }> }> = [];

    for (const msg of chronologicalHistory) {
      contents.push({
        role: msg.role === "USER" ? "user" : "model",
        parts: [{ text: msg.content }],
      });
    }

    // Add current user prompt
    contents.push({
      role: "user",
      parts: [{ text: userPrompt }],
    });

    // 5. Call Gemini with retry
    const ai = getGeminiClient();

    const response = await withRetry(async () => {
      return await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents,
        config: {
          systemInstruction,
          temperature: 0.2, // Low temperature for high precision and factual grounding
        },
      });
    });

    const assistantReply =
      response.text?.trim() ||
      "I was unable to generate an answer based on the extracted document data. Please try rephrasing your question.";

    // 6. Persist assistant reply to the database
    const assistantMessageRecord = await prisma.chatMessage.create({
      data: {
        documentId: document.id,
        role: "ASSISTANT",
        content: assistantReply,
      },
    });

    return NextResponse.json({
      success: true,
      message: {
        id: assistantMessageRecord.id,
        role: "assistant",
        content: assistantMessageRecord.content,
        createdAt: assistantMessageRecord.createdAt.toISOString(),
      },
    });
  } catch (error: any) {
    console.error("[Chat POST] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to process chat message." },
      { status: 500 }
    );
  }
}
