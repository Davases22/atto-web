import { NextRequest, NextResponse } from "next/server";

/**
 * Admin proxy for the mobile app's MAIN logo (feed header wordmark), with
 * version targeting.
 *
 * GET  -> the full stored config (imageUrl, minVersion, fallbackImageUrl) from
 *         content-service's admin endpoint, so the dashboard shows current state.
 * POST -> uploads the primary logo (and an optional fallback logo for older
 *         versions) to Cloudinary, then saves { imageUrl, minVersion,
 *         fallbackImageUrl } in content-service.
 *
 * The mobile app reads GET /content/app-logo?appBuild=N and the backend serves
 * the right one per build, so a baked-in "SOUND" logo can never double up on an
 * older build (those don't send appBuild and get the fallback / their default).
 */

const CLOUDINARY_CLOUD = process.env.CLOUDINARY_CLOUD_NAME || "da9vymoah";
const CLOUDINARY_KEY = process.env.CLOUDINARY_API_KEY || "";
const CLOUDINARY_SECRET = process.env.CLOUDINARY_API_SECRET || "";
const BACKEND_API_URL = process.env.BACKEND_API_URL || "";
const ADMIN_API_SECRET = process.env.ADMIN_API_SECRET || "";

function backendUrl(path: string): string {
  return `${BACKEND_API_URL.replace(/\/$/, "")}${path}`;
}
function adminHeaders(extra: Record<string, string> = {}): HeadersInit {
  return { "X-Admin-Token": ADMIN_API_SECRET, ...extra };
}
function configMissing(): NextResponse | null {
  if (!BACKEND_API_URL || !ADMIN_API_SECRET) {
    return NextResponse.json(
      { error: "Backend admin API not configured. Set BACKEND_API_URL and ADMIN_API_SECRET." },
      { status: 503 }
    );
  }
  return null;
}

/** Signed upload of one image to Cloudinary at a fixed public_id (overwrite). */
async function uploadToCloudinary(file: File, slot: string): Promise<string> {
  const bytes = await file.arrayBuffer();
  const dataUri = `data:${file.type};base64,${Buffer.from(bytes).toString("base64")}`;
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const folder = "atto/app-logo";
  const publicId = `${folder}/${slot}`;
  const crypto = await import("crypto");
  const sig = crypto
    .createHash("sha1")
    .update(
      [`folder=${folder}`, `overwrite=true`, `public_id=${publicId}`, `timestamp=${timestamp}`].join("&") +
        CLOUDINARY_SECRET
    )
    .digest("hex");
  const form = new FormData();
  form.append("file", dataUri);
  form.append("folder", folder);
  form.append("overwrite", "true");
  form.append("public_id", publicId);
  form.append("timestamp", timestamp);
  form.append("api_key", CLOUDINARY_KEY);
  form.append("signature", sig);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) throw new Error(`Cloudinary upload failed: ${await res.text().catch(() => "")}`);
  const data = await res.json();
  const version = data.version ? `?v=${data.version}` : "";
  return `${data.secure_url as string}${version}`;
}

// ── GET: full config for the dashboard ─────────────────────────────────

export async function GET() {
  const guard = configMissing();
  if (guard) return guard;
  try {
    const res = await fetch(backendUrl("/admin/app-logo"), {
      method: "GET",
      headers: adminHeaders(),
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({ data: null }));
    return NextResponse.json(
      { logo: data.data ?? null, latestSeenBuild: data.latestSeenBuild ?? null },
      { status: res.status }
    );
  } catch (err) {
    console.error("app-logo GET error:", err);
    return NextResponse.json({ error: "Failed to fetch app logo" }, { status: 502 });
  }
}

// ── POST: upload primary (+ optional fallback) and save config ─────────

export async function POST(req: NextRequest) {
  const guard = configMissing();
  if (guard) return guard;

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const fallbackFile = formData.get("fallbackFile") as File | null;
    const minVersionRaw = (formData.get("minVersion") as string | null)?.trim() ?? "";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    const minVersion =
      minVersionRaw && Number.isFinite(Number(minVersionRaw)) ? Number(minVersionRaw) : null;

    const imageUrl = await uploadToCloudinary(file, "main");
    const fallbackImageUrl = fallbackFile
      ? await uploadToCloudinary(fallbackFile, "fallback")
      : null;

    const backendRes = await fetch(backendUrl("/admin/app-logo"), {
      method: "POST",
      headers: adminHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ imageUrl, minVersion, fallbackImageUrl }),
    });
    const backendBody = await backendRes.json().catch(() => ({}));
    if (!backendRes.ok) {
      return NextResponse.json(
        { error: backendBody.error ?? "Failed to save app logo", detail: backendBody },
        { status: backendRes.status }
      );
    }
    return NextResponse.json({ logo: backendBody.data }, { status: 201 });
  } catch (err) {
    console.error("app-logo POST error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed" },
      { status: 500 }
    );
  }
}
