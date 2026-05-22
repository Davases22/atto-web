import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import { createClient } from "redis";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 3,
});

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

// POST — store an ad after the browser uploaded the video directly to
// Cloudinary. Only lightweight JSON metadata passes through this function,
// so there is no 4.5 MB body limit to hit.
export async function POST(req: NextRequest) {
  try {
    const { videoUrl, brandName, caption = "" } = await req.json();

    if (!videoUrl || !brandName) {
      return NextResponse.json(
        { error: "Video URL and brand name required" },
        { status: 400 }
      );
    }

    const { rows: maxRows } = await pool.query(
      "SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM feed_ads"
    );

    const { rows } = await pool.query(
      "INSERT INTO feed_ads (id, video_url, brand_name, caption, sort_order, active) VALUES (gen_random_uuid(), $1, $2, $3, $4, true) RETURNING *",
      [videoUrl, brandName, caption, maxRows[0].next_order]
    );

    await clearAdsCache();
    return NextResponse.json({ ad: rows[0] }, { status: 201 });
  } catch (err) {
    console.error("Ad save error:", err);
    return NextResponse.json({ error: "Failed to save ad" }, { status: 500 });
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
