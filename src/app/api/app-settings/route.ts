import { NextRequest, NextResponse } from "next/server";

/**
 * Admin proxy for the mobile app's editable settings (content-service).
 *
 * GET    -> everything the dashboard edits: the feed menu (order, labels,
 *           icons, hidden), the splash mark scale, and the allowed keys and
 *           icon names the app can draw.
 * PUT    -> { key: "feed-menu", items } | { key: "splash-scale", scale }
 *           | { key: "min-build", build } | { key: "update-copy", title, message, button, url }
 * DELETE -> ?key=feed-menu | splash-scale | min-build, back to the default
 *           (min-build cleared means nobody is blocked).
 *
 * The app receives the values inside its app-logo request on every launch, so
 * a change here reaches phones on their next launch or refresh, no build.
 */

const BACKEND_API_URL = process.env.BACKEND_API_URL || "";
const ADMIN_API_SECRET = process.env.ADMIN_API_SECRET || "";

const KEYS = new Set(["feed-menu", "splash-scale", "min-build", "update-copy"]);

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
async function relay(res: Response): Promise<NextResponse> {
  const text = await res.text();
  try {
    return NextResponse.json(JSON.parse(text), { status: res.status });
  } catch {
    return NextResponse.json({ error: text || res.statusText }, { status: res.status });
  }
}

export async function GET() {
  const missing = configMissing();
  if (missing) return missing;
  const res = await fetch(backendUrl("/admin/app-settings"), {
    headers: { "X-Admin-Token": ADMIN_API_SECRET },
    cache: "no-store",
  });
  return relay(res);
}

export async function PUT(req: NextRequest) {
  const missing = configMissing();
  if (missing) return missing;
  let body: {
    key?: string;
    items?: unknown;
    scale?: unknown;
    build?: unknown;
    title?: unknown;
    message?: unknown;
    button?: unknown;
    url?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const key = String(body.key || "");
  if (!KEYS.has(key)) {
    return NextResponse.json({ error: "Unknown key" }, { status: 400 });
  }
  // Cada ajuste manda lo suyo: el backend valida cada forma por separado.
  const payload =
    key === "feed-menu"
      ? { items: body.items }
      : key === "splash-scale"
        ? { scale: body.scale }
        : key === "min-build"
          ? { build: body.build }
          : { title: body.title, message: body.message, button: body.button, url: body.url };
  const res = await fetch(backendUrl(`/admin/app-settings/${key}`), {
    method: "PUT",
    headers: { "X-Admin-Token": ADMIN_API_SECRET, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return relay(res);
}

export async function DELETE(req: NextRequest) {
  const missing = configMissing();
  if (missing) return missing;
  const key = req.nextUrl.searchParams.get("key") || "";
  if (!KEYS.has(key)) {
    return NextResponse.json({ error: "Unknown key" }, { status: 400 });
  }
  const res = await fetch(backendUrl(`/admin/app-settings/${key}`), {
    method: "DELETE",
    headers: { "X-Admin-Token": ADMIN_API_SECRET },
  });
  return relay(res);
}
