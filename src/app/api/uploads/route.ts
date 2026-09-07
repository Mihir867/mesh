import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { prisma } from "@/lib/prisma";
import { DocumentType } from "@prisma/client";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB in bytes
const BUCKET_NAME = process.env.SUPABASE_BUCKET_NAME || "MESH";

const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "text/csv",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
  "application/vnd.ms-excel", // .xls / Excel CSV
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
  "application/msword", // .doc
  "text/plain",
];

// Map MIME types to DocumentType enum
function mapMimeTypeToDocumentType(mimeType: string, fileName: string): DocumentType {
  const ext = fileName.split(".").pop()?.toLowerCase();
  
  if (mimeType === "application/pdf") return DocumentType.PDF;
  if (mimeType === "text/csv") return DocumentType.CSV;
  if (
    mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    mimeType === "application/vnd.ms-excel" ||
    ext === "xlsx" ||
    ext === "xls"
  ) {
    return DocumentType.XLSX;
  }
  if (
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mimeType === "application/msword" ||
    ext === "docx" ||
    ext === "doc"
  ) {
    return DocumentType.DOCX;
  }
  if (mimeType === "text/plain" || ext === "txt") return DocumentType.TXT;
  
  // Default fallback (shouldn't reach here if validation passed)
  return DocumentType.TXT;
}

export async function POST(req: NextRequest) {
  try {
    // 0. Authenticate user with Clerk
    const { userId: clerkUserId } = await auth();
    
    if (!clerkUserId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Please sign in." },
        { status: 401 },
      );
    }

    // Find or create user in database
    let user = await prisma.user.findUnique({
      where: { clerkId: clerkUserId },
    });

    // Auto-create user if they don't exist (handles first-time users)
    if (!user) {
      const { clerkClient } = await import("@clerk/nextjs/server");
      const client = await clerkClient();
      const clerkUser = await client.users.getUser(clerkUserId);
      
      user = await prisma.user.create({
        data: {
          clerkId: clerkUserId,
          email: clerkUser.emailAddresses[0]?.emailAddress || `${clerkUserId}@placeholder.local`,
          name: clerkUser.firstName && clerkUser.lastName 
            ? `${clerkUser.firstName} ${clerkUser.lastName}` 
            : clerkUser.firstName || clerkUser.username || null,
          avatarUrl: clerkUser.imageUrl || null,
        },
      });
      
      console.log(`[Auto-created user]: ${user.email} (${user.id})`);
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    // 1. Check if file is provided
    if (!file) {
      return NextResponse.json(
        { success: false, error: "No file was provided in the request." },
        { status: 400 },
      );
    }

    // 2. Validate file size (<= 5MB)
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          success: false,
          error: `File is too large (${(file.size / (1024 * 1024)).toFixed(2)} MB). Maximum allowed size is 5 MB.`,
        },
        { status: 400 },
      );
    }

    // 3. Validate MIME type
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        {
          success: false,
          error: `Unsupported file type: '${file.type || "unknown"}'. Only PDF, CSV, Excel, Word, and TXT files are allowed.`,
        },
        { status: 400 },
      );
    }

    // 4. Sanitize file name and prefix with timestamp to avoid collision
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const uniqueStoragePath = `${Date.now()}-${sanitizedName}`;

    // Convert file to Buffer for server upload
    const fileBuffer = Buffer.from(await file.arrayBuffer());

    // 5. Upload to Supabase Storage via admin client
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .upload(uniqueStoragePath, fileBuffer, {
        contentType: file.type,
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      console.error("[Supabase Storage Upload Error]:", uploadError);
      return NextResponse.json(
        {
          success: false,
          error: `Supabase upload failed: ${uploadError.message}`,
        },
        { status: 500 },
      );
    }

    // 6. Get the public preview/download URL
    const { data: urlData } = supabaseAdmin.storage
      .from(BUCKET_NAME)
      .getPublicUrl(uploadData.path);

    // 7. Create Document row in PostgreSQL
    const fileType = mapMimeTypeToDocumentType(file.type, file.name);
    
    const document = await prisma.document.create({
      data: {
        userId: user.id,
        name: file.name,
        fileUrl: urlData.publicUrl,
        fileType: fileType,
        mimeType: file.type,
        fileSize: file.size,
        status: "UPLOADED",
      },
    });

    // 8. Success response with documentId
    return NextResponse.json({
      success: true,
      file: {
        id: document.id,
        name: document.name,
        storagePath: uploadData.path,
        url: document.fileUrl,
        size: document.fileSize,
        type: document.fileType,
        mimeType: document.mimeType,
        status: document.status,
        createdAt: document.createdAt.toISOString(),
      },
      documentId: document.id,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error("[Upload API Route Error]:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Internal server error during upload.",
      },
      { status: 500 },
    );
  }
}
