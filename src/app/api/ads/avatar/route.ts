import { NextRequest, NextResponse } from "next/server";

/**
 * Upload a brand-avatar image for a feed ad.
 *
 * Why server-side (unlike the video, which goes browser → Cloudinary
 * direct): avatars are small logos, well under the 4.5 MB Vercel function
 * body limit, so the direct-upload dance isn't needed and a signed
 * server-side upload keeps the api secret entirely on the server.
 *
 * Why we return `publicId` (NOT `secure_url`): the mobile app applies a
 * Cloudinary transformation template to the stored value to render the
 * avatar (see src/features/feed/hooks/useAds.ts in atto-app/front:
 * `https://res.cloudinary.com/dxzcutnlp/image/upload/c_lpad,w_200,h_200,b_rgb:000000,bo_30px_solid_rgb:000000,f_png/${ad.brandAvatar}`).
 * That template only works when `brandAvatar` is a Cloudinary public_id —
 * a full secure_url would produce a malformed URL.
 */

// Fallback matches the value currently set on Vercel
// (CLOUDINARY_CLOUD_NAME=da9vymoah). The fallback is only used in dev when
// no .env.local is present; prod always reads from the env var.
const CLOUDINARY_CLOUD = process.env.CLOUDINARY_CLOUD_NAME || "da9vymoah";
const CLOUDINARY_KEY = process.env.CLOUDINARY_API_KEY || "";
const CLOUDINARY_SECRET = process.env.CLOUDINARY_API_SECRET || "";

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export async function POST(req: NextRequest) {
  if (!CLOUDINARY_KEY || !CLOUDINARY_SECRET) {
    return NextResponse.json(
      { error: "Cloudinary not configured" },
      { status: 500 }
    );
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  const brandNameRaw = (formData.get("brandName") as string | null) ?? "";

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (!file.type.startsWith("image/")) {
    return NextResponse.json(
      { error: "File must be an image" },
      { status: 400 }
    );
  }

  // Use the brand name as the asset slug when available so repeated uploads
  // for the same brand overwrite each other instead of piling up. Falls back
  // to a timestamp if no brand was supplied (e.g. avatar uploaded before
  // the brand name is typed).
  const slug = slugify(brandNameRaw) || `ad-${Date.now()}`;
  // public_id carries the full path; we DO NOT also pass `folder` to the
  // upload API. Cloudinary's behaviour with both set is to prepend folder
  // to public_id, which silently produced atto/brand-avatars/atto/brand-avatars/<slug>
  // on the previous draft. Keeping it as a single param is unambiguous and
  // matches the value that gets written to feed_ads.brand_avatar.
  const publicId = `atto/brand-avatars/${slug}`;

  const bytes = await file.arrayBuffer();
  const base64 = Buffer.from(bytes).toString("base64");
  const dataUri = `data:${file.type};base64,${base64}`;

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const crypto = await import("crypto");
  // Cloudinary signing: sorted, ampersand-joined params + secret, sha1.
  const sigParams = [
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

  const uploadData = (await uploadRes.json()) as {
    public_id: string;
    secure_url: string;
  };

  // Return both: publicId is what we store in DB; secureUrl is what the
  // admin UI shows immediately as a preview without having to rebuild the
  // transformation URL.
  return NextResponse.json({
    publicId: uploadData.public_id,
    secureUrl: uploadData.secure_url,
  });
}
