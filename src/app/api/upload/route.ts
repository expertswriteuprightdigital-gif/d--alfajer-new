import { NextRequest, NextResponse } from "next/server";
import { uploadImage } from "@/src/lib/cloudinary";

export const runtime = "nodejs";

/**
 * POST /api/upload
 * Accepts a FormData with a `file` field and optional `folder` field.
 * Uploads to Cloudinary and returns the secure URL.
 */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const folder = (formData.get("folder") as string) || "alfajer/products";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Convert File to base64 data URI
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64 = buffer.toString("base64");
    const mimeType = file.type || "image/jpeg";
    const dataUri = `data:${mimeType};base64,${base64}`;

    // Upload to Cloudinary
    const url = await uploadImage(dataUri, folder);

    if (!url) {
      return NextResponse.json(
        { error: "Upload failed" },
        { status: 500 }
      );
    }

    return NextResponse.json({ url });
  } catch (error) {
    console.error("Upload API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
