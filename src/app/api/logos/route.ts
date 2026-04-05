import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 3,
});

const CLOUDINARY_CLOUD = process.env.CLOUDINARY_CLOUD_NAME || "dxzcutnlp";
const CLOUDINARY_KEY = process.env.CLOUDINARY_API_KEY || "";
const CLOUDINARY_SECRET = process.env.CLOUDINARY_API_SECRET || "";

// GET — list all logos
export async function GET() {
  try {
    const { rows } = await pool.query(
      "SELECT id, image_url, sort_order, active, created_at FROM creator_logos ORDER BY sort_order ASC"
    );
    return NextResponse.json({ logos: rows });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to fetch logos" },
      { status: 500 }
    );
  }
}

// POST — upload image to Cloudinary + insert into DB
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Upload to Cloudinary
    const cloudinaryForm = new FormData();
    cloudinaryForm.append("file", file);
    cloudinaryForm.append("upload_preset", "ml_default");
    cloudinaryForm.append("folder", "atto/creator-logos");

    // Use signed upload
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const crypto = await import("crypto");
    const signature = crypto
      .createHash("sha1")
      .update(`folder=atto/creator-logos&timestamp=${timestamp}${CLOUDINARY_SECRET}`)
      .digest("hex");

    cloudinaryForm.append("timestamp", timestamp);
    cloudinaryForm.append("api_key", CLOUDINARY_KEY);
    cloudinaryForm.append("signature", signature);

    const uploadRes = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`,
      { method: "POST", body: cloudinaryForm }
    );

    if (!uploadRes.ok) {
      const err = await uploadRes.text();
      return NextResponse.json(
        { error: "Cloudinary upload failed", detail: err },
        { status: 502 }
      );
    }

    const uploadData = await uploadRes.json();
    const imageUrl = uploadData.secure_url;

    // Get next sort order
    const { rows: maxRows } = await pool.query(
      "SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM creator_logos"
    );
    const sortOrder = maxRows[0].next_order;

    // Insert into DB
    const { rows } = await pool.query(
      "INSERT INTO creator_logos (id, image_url, sort_order, active) VALUES (gen_random_uuid(), $1, $2, true) RETURNING *",
      [imageUrl, sortOrder]
    );

    return NextResponse.json({ logo: rows[0] }, { status: 201 });
  } catch (err) {
    console.error("Logo upload error:", err);
    return NextResponse.json(
      { error: "Upload failed" },
      { status: 500 }
    );
  }
}

// DELETE — remove a logo
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "ID required" }, { status: 400 });
  }

  try {
    await pool.query("DELETE FROM creator_logos WHERE id = $1", [id]);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
