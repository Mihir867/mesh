import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
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

    // 2. Fetch document, extraction, and user
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: {
        extraction: true,
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
        { success: false, error: "Forbidden: You do not have permission to view this document." },
        { status: 403 }
      );
    }

    // 3. Return document and extraction data
    return NextResponse.json({
      success: true,
      document: {
        id: document.id,
        name: document.name,
        fileUrl: document.fileUrl,
        fileType: document.fileType,
        mimeType: document.mimeType,
        fileSize: document.fileSize,
        status: document.status,
        errorMessage: document.errorMessage,
        createdAt: document.createdAt.toISOString(),
        updatedAt: document.updatedAt.toISOString(),
      },
      extraction: document.extraction
        ? {
            id: document.extraction.id,
            category: document.extraction.category,
            summary: document.extraction.summary,
            data: document.extraction.data,
            createdAt: document.extraction.createdAt.toISOString(),
            updatedAt: document.extraction.updatedAt.toISOString(),
          }
        : null,
    });
  } catch (error: any) {
    console.error("[Get Document API Route Error]:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to retrieve document details.",
      },
      { status: 500 }
    );
  }
}
