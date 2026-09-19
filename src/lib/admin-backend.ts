import { NextResponse } from "next/server";

/**
 * Server side helper for the admin proxy routes under /api/admin.
 *
 * The site never talks to the payment service from the browser. Each proxy
 * route runs on the server, adds the admin token header, and forwards the
 * call to BACKEND_API_URL (which already ends with /api/v1). Every backend
 * response is wrapped as { success, data } and this helper unwraps it, so
 * the client only ever sees the data (or the error body with its status).
 */

const BACKEND_API_URL = process.env.BACKEND_API_URL || "";
const ADMIN_API_SECRET = process.env.ADMIN_API_SECRET || "";

export const CONFIG_MISSING_MESSAGE =
  "Backend admin API not configured. Set BACKEND_API_URL and ADMIN_API_SECRET.";

export function backendUrl(path: string): string {
  return `${BACKEND_API_URL.replace(/\/$/, "")}${path}`;
}

export function adminHeaders(extra: Record<string, string> = {}): HeadersInit {
  return { "X-Admin-Token": ADMIN_API_SECRET, ...extra };
}

/** 503 when the env is missing, exactly like the app logo proxy. */
export function configMissing(): NextResponse | null {
  if (!BACKEND_API_URL || !ADMIN_API_SECRET) {
    return NextResponse.json({ error: CONFIG_MISSING_MESSAGE }, { status: 503 });
  }
  return null;
}

interface Wrapped {
  success?: boolean;
  data?: unknown;
  error?: unknown;
  message?: unknown;
  [key: string]: unknown;
}

function errorMessage(body: Wrapped, status: number): string {
  if (typeof body.error === "string") return body.error;
  if (body.error && typeof body.error === "object") {
    const nested = body.error as { message?: unknown };
    if (typeof nested.message === "string") return nested.message;
  }
  if (typeof body.message === "string") return body.message;
  return `Backend request failed (${status})`;
}

/**
 * Forward one request to the backend and unwrap the { success, data } shape.
 * Status codes are preserved. Error bodies keep every extra field the backend
 * sends (for example `subscribers` on a 409) so the client can show them.
 */
export async function proxyToBackend(
  path: string,
  init: { method: string; body?: unknown } = { method: "GET" }
): Promise<NextResponse> {
  const guard = configMissing();
  if (guard) return guard;

  const headers: Record<string, string> = {};
  const fetchInit: RequestInit = { method: init.method, cache: "no-store" };
  if (init.body !== undefined) {
    headers["Content-Type"] = "application/json";
    fetchInit.body = JSON.stringify(init.body);
  }
  fetchInit.headers = adminHeaders(headers);

  let res: Response;
  try {
    res = await fetch(backendUrl(path), fetchInit);
  } catch (err) {
    console.error(`admin proxy ${init.method} ${path} network error:`, err);
    return NextResponse.json(
      { error: "Could not reach the backend. Try again in a moment." },
      { status: 502 }
    );
  }

  const text = await res.text();
  let body: Wrapped = {};
  if (text) {
    try {
      body = JSON.parse(text) as Wrapped;
    } catch {
      return NextResponse.json(
        { error: `Backend returned an unreadable response (${res.status})` },
        { status: res.ok ? 502 : res.status }
      );
    }
  }

  if (!res.ok || body.success === false) {
    // Some backends answer 200 with success false. Treat that as a 502 so the
    // client never mistakes it for a good result.
    const status = res.ok ? 502 : res.status;
    const rest: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(body)) {
      if (key !== "success" && key !== "data") rest[key] = value;
    }
    return NextResponse.json(
      { ...rest, error: errorMessage(body, status) },
      { status }
    );
  }

  return NextResponse.json(body.data ?? null, { status: res.status });
}

/** Parse a JSON request body, or return a 400 response. */
export async function readJson<T>(req: Request): Promise<T | NextResponse> {
  try {
    return (await req.json()) as T;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
}
