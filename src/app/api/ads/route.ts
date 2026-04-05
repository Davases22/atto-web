import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import { createClient } from "redis";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 3,
});

const CLOUDINARY_CLOUD = process.env.CLOUDINARY_CLOUD_NAME || "dxzcutnlp";
const CLOUDINARY_KEY = process.env.CLOUDINARY_API_KEY || "";
const CLOUDINARY_SECRET = process.env.CLOUDINARY_API_SECRET || "";
const REDIS_URL = process.env.REDIS_URL || "";

async function clearAdsCache() {
  if (!REDIS_URL) return;
  try {
    const redis = createClient({ url: REDIS_URL });
    await redis.connect();
    await redis.del("social:feed-ads");
    await redis.disconnect();
  } catch {
    // non-critical
  }
}

// GET — list all ads
export async function GET() {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM feed_ads ORDER BY sort_order ASC"
    );
    return NextResponse.json({ ads: rows });
  } catch {
    return NextResponse.json({ error: "Failed to fetch ads" }, { status: 500 });
  }
}

// POST — upload video to Cloudinary + insert ad
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const brandName = formData.get("brandName") as string;
    const caption = (formData.get("caption") as string) || "";

    if (!file || !brandName) {
      return NextResponse.json(
        { error: "File and brand name required" },
        { status: 400 }
      );
    }

    // Convert to base64 for Cloudinary
    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString("base64");
    const dataUri = `data:${file.type};base64,${base64}`;

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const folder = "atto/ads";
    const crypto = await import("crypto");
    const signature = crypto
      .createHash("sha1")
      .update(`folder=${folder}&timestamp=${timestamp}${CLOUDINARY_SECRET}`)
      .digest("hex");

    const cloudinaryForm = new FormData();
    cloudinaryForm.append("file", dataUri);
    cloudinaryForm.append("folder", folder);
    cloudinaryForm.append("timestamp", timestamp);
    cloudinaryForm.append("api_key", CLOUDINARY_KEY);
    cloudinaryForm.append("signature", signature);
    cloudinaryForm.append("resource_type", "video");

    const uploadRes = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/video/upload`,
      { method: "POST", body: cloudinaryForm }
    );

    if (!uploadRes.ok) {
      const err = await uploadRes.text();
      return NextResponse.json(
        { error: "Upload failed", detail: err },
        { status: 502 }
      );
    }

    const { secure_url } = await uploadRes.json();

    const { rows: maxRows } = await pool.query(
      "SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM feed_ads"
    );

    const { rows } = await pool.query(
      "INSERT INTO feed_ads (id, video_url, brand_name, caption, sort_order, active) VALUES (gen_random_uuid(), $1, $2, $3, $4, true) RETURNING *",
      [secure_url, brandName, caption, maxRows[0].next_order]
    );

    await clearAdsCache();
    return NextResponse.json({ ad: rows[0] }, { status: 201 });
  } catch (err) {
    console.error("Ad upload error:", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}

// DELETE — remove an ad
export async function DELETE(req: NextRequest) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "ID required" }, { status: 400 });
  }
  try {
    await pool.query("DELETE FROM feed_ads WHERE id = $1", [id]);
    await clearAdsCache();
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
