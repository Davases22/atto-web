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

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * PATCH /api/ads/[id] — edit metadata of an existing ad without reuploading
 * the video. Accepts a partial body so the admin UI can update fields one
 * at a time:
 *   { brandName?, caption?, brandAvatar? }
 *
 * `brandAvatar` is the Cloudinary public_id (or null to clear it). The
 * mobile feed reads `ORDER BY sort_order ASC` so reordering is handled by
 * the bulk PATCH in /api/ads, not here.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id || !UUID_RE.test(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const updates: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (typeof body.brandName === "string" && body.brandName.trim()) {
    updates.push(`brand_name = $${idx++}`);
    values.push(body.brandName.trim());
  }
  if (typeof body.caption === "string") {
    updates.push(`caption = $${idx++}`);
    values.push(body.caption);
  }
  // brandAvatar is nullable — explicit null clears it; undefined leaves it.
  if (body.brandAvatar === null || typeof body.brandAvatar === "string") {
    updates.push(`brand_avatar = $${idx++}`);
    values.push(body.brandAvatar);
  }

  if (updates.length === 0) {
    return NextResponse.json(
      { error: "No editable fields supplied" },
      { status: 400 }
    );
  }

  values.push(id);
  try {
    const { rows } = await pool.query(
      `UPDATE feed_ads SET ${updates.join(", ")} WHERE id = $${idx} RETURNING *`,
      values
    );
    if (rows.length === 0) {
      return NextResponse.json({ error: "Ad not found" }, { status: 404 });
    }
    await clearAdsCache();
    return NextResponse.json({ ad: rows[0] });
  } catch (err) {
    console.error("Ad patch error:", err);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
