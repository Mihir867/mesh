import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

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

export async function POST(req: NextRequest) {
  try {
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

    // 7. Success response
    return NextResponse.json({
      success: true,
      file: {
        name: file.name,
        storagePath: uploadData.path,
        url: urlData.publicUrl,
        size: file.size,
        type: file.type,
      },
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
