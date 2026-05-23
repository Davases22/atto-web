import { NextRequest, NextResponse } from "next/server";

/**
 * Admin proxy for the mobile app-icon catalogue.
 *
 * Unlike /api/logos (which writes directly to atto-web's own Postgres),
 * app icons live in content-service's MongoDB so the mobile app can read
 * them from the same backend it already trusts. This route:
 *   1. Authenticates the admin user via the Next.js middleware (Basic Auth).
 *   2. Uploads the preview thumbnail to Cloudinary (signed; same flow as
 *      /api/logos and /api/ads — keeps storage consistent).
 *   3. Forwards the metadata to content-service's admin endpoint with the
 *      shared X-Admin-Token header. The token never leaves the server.
 *
 * The slot_name field is the contract with the mobile binary — it must
 * match a key declared in the app's @howincodes/expo-dynamic-app-icon
 * plugin config (e.g. "noir", "blueprint", "mono"). Posting a slot name
 * the binary doesn't ship will surface as "icon not found" on the device
 * when the user picks that tile.
 */

const CLOUDINARY_CLOUD = process.env.CLOUDINARY_CLOUD_NAME || "dxzcutnlp";
const CLOUDINARY_KEY = process.env.CLOUDINARY_API_KEY || "";
const CLOUDINARY_SECRET = process.env.CLOUDINARY_API_SECRET || "";
const BACKEND_API_URL = process.env.BACKEND_API_URL || "";
const ADMIN_API_SECRET = process.env.ADMIN_API_SECRET || "";

function backendUrl(path: string): string {
  // BACKEND_API_URL is the Kong gateway base, e.g.
  // https://api-gateway-kong-production.up.railway.app/api/v1
  return `${BACKEND_API_URL.replace(/\/$/, "")}${path}`;
}

function adminHeaders(extra: Record<string, string> = {}): HeadersInit {
  return {
    "X-Admin-Token": ADMIN_API_SECRET,
    ...extra,
  };
}

function configMissing(): NextResponse | null {
  if (!BACKEND_API_URL || !ADMIN_API_SECRET) {
    return NextResponse.json(
      {
        error:
          "Backend admin API not configured. Set BACKEND_API_URL and ADMIN_API_SECRET.",
      },
      { status: 503 }
    );
  }
  return null;
}

// ── GET: admin listing (includes inactive rows) ──────────────────────

export async function GET() {
  const guard = configMissing();
  if (guard) return guard;

  try {
    const res = await fetch(backendUrl("/admin/app-icons"), {
      method: "GET",
      headers: adminHeaders(),
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({ data: [] }));
    return NextResponse.json({ icons: data.data ?? [] }, { status: res.status });
  } catch (err) {
    console.error("app-icons GET error:", err);
    return NextResponse.json(
      { error: "Failed to fetch app icons" },
      { status: 502 }
    );
  }
}

// ── POST: upload preview + upsert catalog row ────────────────────────

export async function POST(req: NextRequest) {
  const guard = configMissing();
  if (guard) return guard;

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const slotName = (formData.get("slotName") as string | null)?.trim() ?? "";
    const name = (formData.get("name") as string | null)?.trim() ?? "";
    const sortOrderRaw = formData.get("sortOrder") as string | null;
    const isActiveRaw = formData.get("isActive") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (!slotName) {
      return NextResponse.json(
        {
          error:
            "slotName is required. It must match a slot declared in the mobile binary's app.json plugin block.",
        },
        { status: 400 }
      );
    }
    if (!name) {
      return NextResponse.json(
        { error: "name (user-facing display name) is required" },
        { status: 400 }
      );
    }

    const sortOrder = Number.isFinite(Number(sortOrderRaw))
      ? Number(sortOrderRaw)
      : 0;
    const isActive = isActiveRaw === null ? true : isActiveRaw !== "false";

    // ── 1. Upload preview to Cloudinary (signed) ──────────────────────
    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString("base64");
    const dataUri = `data:${file.type};base64,${base64}`;

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const folder = "atto/app-icons";
    const publicId = `${folder}/${slotName}`;
    const crypto = await import("crypto");
    // Cloudinary signing requires sorted, ampersand-joined params plus the secret.
    const sigParams = [
      `folder=${folder}`,
      `overwrite=true`,
      `public_id=${publicId}`,
      `timestamp=${timestamp}`,
    ].join("&");
    const signature = crypto
      .createHash("sha1")
      .update(sigParams + CLOUDINARY_SECRET)
      .digest("hex");

    const cloudinaryForm = new FormData();
    cloudinaryForm.append("file", dataUri);
    cloudinaryForm.append("folder", folder);
    cloudinaryForm.append("overwrite", "true");
    cloudinaryForm.append("public_id", publicId);
    cloudinaryForm.append("timestamp", timestamp);
    cloudinaryForm.append("api_key", CLOUDINARY_KEY);
    cloudinaryForm.append("signature", signature);

    const uploadRes = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`,
      { method: "POST", body: cloudinaryForm }
    );

    if (!uploadRes.ok) {
      const detail = await uploadRes.text().catch(() => "");
      return NextResponse.json(
        { error: "Cloudinary upload failed", detail },
        { status: 502 }
      );
    }

    const uploadData = await uploadRes.json();
    const previewUrl = uploadData.secure_url as string;

    // ── 2. Upsert in content-service ──────────────────────────────────
    const backendRes = await fetch(backendUrl("/admin/app-icons"), {
      method: "POST",
      headers: adminHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        slotName,
        name,
        previewUrl,
        sortOrder,
        isActive,
      }),
    });

    const backendBody = await backendRes.json().catch(() => ({}));
    if (!backendRes.ok) {
      return NextResponse.json(
        {
          error: backendBody.error ?? "Failed to save app icon",
          detail: backendBody,
        },
        { status: backendRes.status }
      );
    }

    return NextResponse.json({ icon: backendBody.data }, { status: 201 });
  } catch (err) {
    console.error("app-icons POST error:", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}

// ── DELETE: remove a slot from the catalogue ─────────────────────────

export async function DELETE(req: NextRequest) {
  const guard = configMissing();
  if (guard) return guard;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  try {
    const res = await fetch(backendUrl(`/admin/app-icons/${id}`), {
      method: "DELETE",
      headers: adminHeaders(),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json(
        { error: body.error ?? "Delete failed" },
        { status: res.status }
      );
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("app-icons DELETE error:", err);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
