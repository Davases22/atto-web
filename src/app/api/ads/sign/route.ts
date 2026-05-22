import { NextResponse } from "next/server";

const CLOUDINARY_CLOUD = process.env.CLOUDINARY_CLOUD_NAME || "dxzcutnlp";
const CLOUDINARY_KEY = process.env.CLOUDINARY_API_KEY || "";
const CLOUDINARY_SECRET = process.env.CLOUDINARY_API_SECRET || "";

// GET — returns a signed payload so the browser can upload the video
// directly to Cloudinary, bypassing Vercel's 4.5 MB request body limit.
export async function GET() {
  if (!CLOUDINARY_KEY || !CLOUDINARY_SECRET) {
    return NextResponse.json(
      { error: "Cloudinary not configured" },
      { status: 500 }
    );
  }

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const folder = "atto/ads";
  const crypto = await import("crypto");
  const signature = crypto
    .createHash("sha1")
    .update(`folder=${folder}&timestamp=${timestamp}${CLOUDINARY_SECRET}`)
    .digest("hex");

  return NextResponse.json({
    cloudName: CLOUDINARY_CLOUD,
    apiKey: CLOUDINARY_KEY,
    timestamp,
    folder,
    signature,
  });
}
