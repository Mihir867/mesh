import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { processDocument } from "@/lib/pipeline";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    // 1. Authenticate with Clerk
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

    // 2. Fetch document and verify ownership
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: {
        user: {
          select: { clerkId: true },
        },
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
        { success: false, error: "Forbidden: You do not have permission to process this document." },
        { status: 403 }
      );
    }

    // 3. Process document through the pipeline
    console.log(`[Process API] Starting pipeline for document: ${documentId} (${document.name})`);
    const { document: updatedDoc, extraction } = await processDocument(documentId);

    return NextResponse.json({
      success: true,
      documentId: updatedDoc.id,
      status: updatedDoc.status,
      category: extraction.category,
      summary: extraction.summary,
      data: extraction.data,
      extraction: {
        id: extraction.id,
        category: extraction.category,
        summary: extraction.summary,
        data: extraction.data,
        createdAt: extraction.createdAt.toISOString(),
        updatedAt: extraction.updatedAt.toISOString(),
      },
    });
  } catch (error: any) {
    console.error("[Process API Route Error]:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "An unexpected error occurred while processing the document.",
      },
      { status: 500 }
    );
  }
}
