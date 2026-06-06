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

// GET — list all ads (ordered as they'll appear in the mobile feed)
export async function GET() {
  try {
    const { rows } = await pool.query(
      "SELECT id, video_url, brand_name, brand_avatar, caption, link_url, sort_order, active, created_at FROM feed_ads ORDER BY sort_order ASC"
    );
    return NextResponse.json({ ads: rows });
  } catch {
    return NextResponse.json({ error: "Failed to fetch ads" }, { status: 500 });
  }
}

// POST — store an ad after the browser uploaded the video directly to
// Cloudinary. Only lightweight JSON metadata passes through this function,
// so there is no 4.5 MB body limit to hit.
//
// All four fields are required: videoUrl, brandName, caption, brandAvatar.
// The admin UI also disables the publish button until they're all set, but
// we enforce server-side so direct API callers can't bypass the rule.
//
// `brandAvatar` is the Cloudinary public_id (e.g. "atto/ad-avatars/apple"),
// NOT a full URL — the mobile app concatenates it inside a transformation
// template (c_lpad,w_200,h_200,…) in src/features/feed/hooks/useAds.ts.
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      videoUrl?: unknown;
      brandName?: unknown;
      caption?: unknown;
      brandAvatar?: unknown;
    };

    const videoUrl =
      typeof body.videoUrl === "string" ? body.videoUrl.trim() : "";
    const brandName =
      typeof body.brandName === "string" ? body.brandName.trim() : "";
    const caption =
      typeof body.caption === "string" ? body.caption.trim() : "";
    const brandAvatar =
      typeof body.brandAvatar === "string" ? body.brandAvatar.trim() : "";

    const missing: string[] = [];
    if (!videoUrl) missing.push("videoUrl");
    if (!brandName) missing.push("brandName");
    if (!caption) missing.push("caption");
    if (!brandAvatar) missing.push("brandAvatar");
    if (missing.length > 0) {
      return NextResponse.json(
        { error: `Missing required field(s): ${missing.join(", ")}` },
        { status: 400 }
      );
    }

    // New ads land FIRST (smallest sort_order) so they show at the top of
    // both the admin list and the mobile feed (ORDER BY sort_order ASC) —
    // immediate visual confirmation that the upload landed. Admins can still
    // drag to reorder afterwards. sort_order is relative, so going negative
    // is fine.
    const { rows: minRows } = await pool.query(
      "SELECT COALESCE(MIN(sort_order), 0) - 1 AS next_order FROM feed_ads"
    );

    const { rows } = await pool.query(
      "INSERT INTO feed_ads (id, video_url, brand_name, brand_avatar, caption, sort_order, active) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, true) RETURNING *",
      [videoUrl, brandName, brandAvatar, caption, minRows[0].next_order]
    );

    await clearAdsCache();
    return NextResponse.json({ ad: rows[0] }, { status: 201 });
  } catch (err) {
    console.error("Ad save error:", err);
    return NextResponse.json({ error: "Failed to save ad" }, { status: 500 });
  }
}

// PATCH — bulk reorder. Body: { order: [{ id, sortOrder }, ...] }.
// Wrapped in a transaction so a partial failure can't leave the table
// half-reordered. The mobile app reads `ORDER BY sort_order ASC`, so the
// exact integer values don't matter as long as they're monotonic.
export async function PATCH(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const order = (body as { order?: Array<{ id: string; sortOrder: number }> })
    ?.order;
  if (!Array.isArray(order) || order.length === 0) {
    return NextResponse.json(
      { error: "order array required" },
      { status: 400 }
    );
  }

  for (const item of order) {
    if (!item || typeof item.id !== "string" || !UUID_RE.test(item.id)) {
      return NextResponse.json({ error: "Invalid id in order" }, { status: 400 });
    }
    if (!Number.isFinite(item.sortOrder)) {
      return NextResponse.json(
        { error: "Invalid sortOrder in order" },
        { status: 400 }
      );
    }
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const { id, sortOrder } of order) {
      await client.query("UPDATE feed_ads SET sort_order = $1 WHERE id = $2", [
        sortOrder,
        id,
      ]);
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Ad reorder error:", err);
    return NextResponse.json({ error: "Reorder failed" }, { status: 500 });
  } finally {
    client.release();
  }

  await clearAdsCache();
  return NextResponse.json({ success: true });
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
