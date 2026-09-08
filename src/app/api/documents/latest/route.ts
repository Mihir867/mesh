import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/documents/latest
 * Returns the authenticated user's most recent document and extraction data.
 */
export async function GET(req: NextRequest) {
  try {
    const { userId: clerkUserId } = await auth();

    if (!clerkUserId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Please sign in." },
        { status: 401 }
      );
    }

    // Find the user's internal ID
    const user = await prisma.user.findUnique({
      where: { clerkId: clerkUserId },
    });

    if (!user) {
      return NextResponse.json({
        success: true,
        document: null,
      });
    }

    // Find latest document that is COMPLETED
    const latestDoc = await prisma.document.findFirst({
      where: {
        userId: user.id,
        status: "COMPLETED",
      },
      orderBy: { updatedAt: "desc" },
      include: {
        extraction: true,
      },
    });

    if (!latestDoc) {
      return NextResponse.json({
        success: true,
        document: null,
      });
    }

    return NextResponse.json({
      success: true,
      document: {
        id: latestDoc.id,
        name: latestDoc.name,
        fileUrl: latestDoc.fileUrl,
        fileType: latestDoc.fileType,
        mimeType: latestDoc.mimeType,
        fileSize: latestDoc.fileSize,
        status: latestDoc.status,
        createdAt: latestDoc.createdAt.toISOString(),
        updatedAt: latestDoc.updatedAt.toISOString(),
      },
      extraction: latestDoc.extraction
        ? {
            id: latestDoc.extraction.id,
            category: latestDoc.extraction.category,
            summary: latestDoc.extraction.summary,
            data: latestDoc.extraction.data,
            createdAt: latestDoc.extraction.createdAt.toISOString(),
            updatedAt: latestDoc.extraction.updatedAt.toISOString(),
          }
        : null,
    });
  } catch (error: any) {
    console.error("[Documents Latest GET] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch latest document." },
      { status: 500 }
    );
  }
}
