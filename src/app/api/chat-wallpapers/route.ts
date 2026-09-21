import { NextRequest, NextResponse } from "next/server";

/**
 * Admin proxy for the chat wallpaper catalogue.
 *
 * Wallpapers live in content-service's MongoDB so the mobile app reads them
 * from the backend it already trusts. Three kinds exist:
 *   image    a tileable texture (uploaded here to Cloudinary)
 *   gradient two to four HEX colours, drawn on the phone and rotated on send
 *   pattern  a gradient plus a tileable transparent PNG of line art doodles
 *
 * This route authenticates through the admin middleware (Basic Auth), uploads
 * any tile to Cloudinary with a signed request and forwards the metadata to
 * content-service with the shared X-Admin-Token. The token never leaves the
 * server.
 */

const CLOUDINARY_CLOUD = process.env.CLOUDINARY_CLOUD_NAME || "da9vymoah";
const CLOUDINARY_KEY = process.env.CLOUDINARY_API_KEY || "";
const CLOUDINARY_SECRET = process.env.CLOUDINARY_API_SECRET || "";
const BACKEND_API_URL = process.env.BACKEND_API_URL || "";
const ADMIN_API_SECRET = process.env.ADMIN_API_SECRET || "";

const KINDS = new Set(["image", "gradient", "pattern"]);

function backendUrl(path: string): string {
  return `${BACKEND_API_URL.replace(/\/$/, "")}${path}`;
}

function adminHeaders(extra: Record<string, string> = {}): HeadersInit {
  return { "X-Admin-Token": ADMIN_API_SECRET, ...extra };
}

function configMissing(): NextResponse | null {
  if (!BACKEND_API_URL || !ADMIN_API_SECRET) {
    return NextResponse.json(
      {
        error:
          "Backend admin API not configured. Set BACKEND_API_URL and ADMIN_API_SECRET.",
      },
      { status: 503 },
    );
  }
  return null;
}

/** Signed upload of one tile to Cloudinary under a stable public id. */
async function uploadTile(file: File, slug: string): Promise<string> {
  const bytes = await file.arrayBuffer();
  const base64 = Buffer.from(bytes).toString("base64");
  const dataUri = `data:${file.type};base64,${base64}`;
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const folder = "atto/chat-wallpapers";
  const publicId = `${folder}/${slug}`;
  const crypto = await import("crypto");
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

  const form = new FormData();
  form.append("file", dataUri);
  form.append("folder", folder);
  form.append("overwrite", "true");
  form.append("public_id", publicId);
  form.append("timestamp", timestamp);
  form.append("api_key", CLOUDINARY_KEY);
  form.append("signature", signature);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`,
    {
      method: "POST",
      body: form,
    },
  );
  if (!res.ok) {
    throw new Error(
      `Cloudinary upload failed: ${await res.text().catch(() => "")}`,
    );
  }
  const data = await res.json();
  return data.secure_url as string;
}

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 40) || `wallpaper_${Date.now()}`
  );
}

// ── GET: admin listing, active and retired ──────────────────────────

export async function GET() {
  const guard = configMissing();
  if (guard) return guard;
  try {
    const res = await fetch(backendUrl("/admin/chat-wallpapers"), {
      method: "GET",
      headers: adminHeaders(),
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({ data: [] }));
    return NextResponse.json(
      { wallpapers: data.data ?? [] },
      { status: res.status },
    );
  } catch (err) {
    console.error("chat-wallpapers GET error:", err);
    return NextResponse.json(
      { error: "Failed to fetch chat wallpapers" },
      { status: 502 },
    );
  }
}

// ── POST: upload tiles, then create the catalogue row ───────────────

export async function POST(req: NextRequest) {
  const guard = configMissing();
  if (guard) return guard;

  try {
    const formData = await req.formData();
    const name = (formData.get("name") as string | null)?.trim() ?? "";
    const kind = (formData.get("kind") as string | null)?.trim() || "image";
    const colorsRaw = (formData.get("gradientColors") as string | null) ?? "";
    const overlayRaw = formData.get("overlayOpacity") as string | null;
    const patternOpacityRaw = formData.get("patternOpacity") as string | null;
    const sortOrderRaw = formData.get("sortOrder") as string | null;
    const isActiveRaw = formData.get("isActive") as string | null;
    const imageFile = formData.get("image") as File | null;
    const patternFile = formData.get("pattern") as File | null;

    if (!name)
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    if (!KINDS.has(kind)) {
      return NextResponse.json(
        { error: "kind must be image, gradient or pattern" },
        { status: 400 },
      );
    }
    const gradientColors = colorsRaw
      .split(/[,\s]+/)
      .map((c) => c.trim())
      .filter(Boolean);
    if (
      kind !== "image" &&
      (gradientColors.length < 2 || gradientColors.length > 4)
    ) {
      return NextResponse.json(
        {
          error:
            "gradientColors needs two to four HEX colours, e.g. #0B0B0F, #1C1330",
        },
        { status: 400 },
      );
    }
    if (kind === "image" && !imageFile) {
      return NextResponse.json(
        { error: "An image tile is required" },
        { status: 400 },
      );
    }
    if (kind === "pattern" && !patternFile) {
      return NextResponse.json(
        { error: "A pattern tile (transparent PNG) is required" },
        { status: 400 },
      );
    }

    const slug = slugify(name);
    const imageUrl =
      kind === "image" && imageFile
        ? await uploadTile(imageFile, `image-${slug}`)
        : null;
    const patternUrl =
      kind === "pattern" && patternFile
        ? await uploadTile(patternFile, `pattern-${slug}`)
        : null;

    const num = (raw: string | null, fallback: number | null) => {
      if (raw === null || raw.trim() === "") return fallback;
      const n = Number(raw);
      return Number.isFinite(n) ? n : fallback;
    };

    const backendRes = await fetch(backendUrl("/admin/chat-wallpapers"), {
      method: "POST",
      headers: adminHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        name,
        kind,
        imageUrl,
        patternUrl,
        gradientColors: kind === "image" ? null : gradientColors,
        overlayOpacity: num(overlayRaw, null),
        patternOpacity: num(patternOpacityRaw, null),
        sortOrder: num(sortOrderRaw, 0),
        isActive: isActiveRaw === null ? true : isActiveRaw !== "false",
      }),
    });
    const body = await backendRes.json().catch(() => ({}));
    if (!backendRes.ok) {
      return NextResponse.json(
        { error: body.error ?? "Failed to save chat wallpaper", detail: body },
        { status: backendRes.status },
      );
    }
    return NextResponse.json({ wallpaper: body.data }, { status: 201 });
  } catch (err) {
    console.error("chat-wallpapers POST error:", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}

// ── PATCH: retire or restore ────────────────────────────────────────

export async function PATCH(req: NextRequest) {
  const guard = configMissing();
  if (guard) return guard;
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  try {
    const { isActive } = (await req.json()) as { isActive: boolean };
    const res = await fetch(backendUrl(`/admin/chat-wallpapers/${id}`), {
      method: "PATCH",
      headers: adminHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ isActive: !!isActive }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json(
        { error: body.error ?? "Update failed" },
        { status: res.status },
      );
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("chat-wallpapers PATCH error:", err);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}

// ── DELETE: remove from the catalogue ───────────────────────────────

export async function DELETE(req: NextRequest) {
  const guard = configMissing();
  if (guard) return guard;
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  try {
    const res = await fetch(backendUrl(`/admin/chat-wallpapers/${id}`), {
      method: "DELETE",
      headers: adminHeaders(),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json(
        { error: body.error ?? "Delete failed" },
        { status: res.status },
      );
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("chat-wallpapers DELETE error:", err);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
