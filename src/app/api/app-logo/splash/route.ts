import { NextRequest, NextResponse } from "next/server";

/**
 * Admin proxy for the mobile app's LAUNCH SPLASH logo.
 *
 * The main logo (../route.ts) drives the feed header and, by default, the
 * splash. The header needs a wide wordmark while the splash usually wants the
 * round mark, so the splash has a slot of its own:
 *
 * POST   -> uploads the image to Cloudinary (slot "splash") and saves it in
 *           content-service. The header logo is left untouched.
 * DELETE -> clears it, so the splash follows the main logo again.
 */

const CLOUDINARY_CLOUD = process.env.CLOUDINARY_CLOUD_NAME || "da9vymoah";
const CLOUDINARY_KEY = process.env.CLOUDINARY_API_KEY || "";
const CLOUDINARY_SECRET = process.env.CLOUDINARY_API_SECRET || "";
const BACKEND_API_URL = process.env.BACKEND_API_URL || "";
const ADMIN_API_SECRET = process.env.ADMIN_API_SECRET || "";

function backendUrl(path: string): string {
  return `${BACKEND_API_URL.replace(/\/$/, "")}${path}`;
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

/** Signed upload to the fixed splash slot (overwrite). */
async function uploadSplash(file: File): Promise<string> {
  const bytes = await file.arrayBuffer();
  const dataUri = `data:${file.type};base64,${Buffer.from(bytes).toString("base64")}`;
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const folder = "atto/app-logo";
  const publicId = `${folder}/splash`;
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
  // The version makes the URL change on every upload, which is what tells the
  // app its cached splash is stale.
  const version = data.version ? `?v=${data.version}` : "";
  return `${data.secure_url as string}${version}`;
}

export async function POST(req: NextRequest) {
  const guard = configMissing();
  if (guard) return guard;
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

    const imageUrl = await uploadSplash(file);
    const backendRes = await fetch(backendUrl("/admin/app-logo/splash"), {
      method: "POST",
      headers: { "X-Admin-Token": ADMIN_API_SECRET, "Content-Type": "application/json" },
      body: JSON.stringify({ imageUrl }),
    });
    const body = await backendRes.json().catch(() => ({}));
    if (!backendRes.ok) {
      return NextResponse.json(
        { error: body.error ?? "Failed to save the splash logo", detail: body },
        { status: backendRes.status }
      );
    }
    return NextResponse.json({ splashImageUrl: body.data?.splashImageUrl ?? imageUrl }, { status: 201 });
  } catch (err) {
    console.error("app-logo splash POST error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed" },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  const guard = configMissing();
  if (guard) return guard;
  try {
    const backendRes = await fetch(backendUrl("/admin/app-logo/splash"), {
      method: "DELETE",
      headers: { "X-Admin-Token": ADMIN_API_SECRET },
    });
    const body = await backendRes.json().catch(() => ({}));
    return NextResponse.json({ removed: body.data?.removed ?? false }, { status: backendRes.status });
  } catch (err) {
    console.error("app-logo splash DELETE error:", err);
    return NextResponse.json({ error: "Failed to clear the splash logo" }, { status: 502 });
  }
}
