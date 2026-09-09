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

    // 4. Construct Minimal-Context System Instruction & Contents
    // We only pass category, summary, and extracted JSON fields — NOT the massive raw document text!
    // This reduces token consumption by over 95%, saving costs and minimizing latency.
    const extraction = document.extraction;
    const systemInstruction = `
You are MESH AI, an intelligent, precise assistant specialized in answering questions about this specific document.
You answer strictly based on the structured extraction JSON and summary provided below.

RULES:
1. Ground your answers directly in the provided extraction data, numbers, dates, and facts.
2. Be concise, direct, helpful, and polite. Avoid unnecessary conversational fluff.
3. If the user asks about information or fields not captured in the extracted data, clearly explain that it is not present in the extracted schema.
4. Format responses cleanly using GitHub Markdown:
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
