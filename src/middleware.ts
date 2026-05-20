import { NextRequest, NextResponse } from "next/server";

/**
 * HTTP Basic Auth gate for the admin UI.
 *
 * Why: the admin pages (/admin/*) were public until this middleware was
 * added — anyone with the URL could upload media. Browser-native Basic Auth
 * is the lowest-effort gate that works on Vercel Free, requires no extra
 * deps, and is independent of the backend's own admin token. The backend
 * still enforces its own X-Admin-Token on every write, so this middleware
 * is defense-in-depth, not the only line of defense.
 *
 * Configuration via env vars (set in Vercel project settings):
 *   ADMIN_USER  — required, the username the browser dialog asks for
 *   ADMIN_PASS  — required, the matching password
 *
 * If either env var is unset we BLOCK all admin traffic. Failing closed
 * prevents accidental public exposure when a deploy is misconfigured.
 *
 * Upgrade path: when we add a real session-based admin login (Clerk,
 * NextAuth, or a custom flow), remove this middleware in favour of a
 * proper auth check that issues a session cookie.
 */
export function middleware(req: NextRequest) {
  const expectedUser = process.env.ADMIN_USER;
  const expectedPass = process.env.ADMIN_PASS;

  if (!expectedUser || !expectedPass) {
    // Fail closed when not configured. Body intentionally cryptic so we
    // don't advertise the surface area on a misconfigured deploy.
    return new NextResponse("Admin not configured", { status: 503 });
  }

  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Basic ")) {
    return unauthorized();
  }

  const credentials = decodeBasic(authHeader.slice("Basic ".length));
  if (
    !credentials ||
    !timingSafeEqual(credentials.user, expectedUser) ||
    !timingSafeEqual(credentials.pass, expectedPass)
  ) {
    return unauthorized();
  }

  return NextResponse.next();
}

function unauthorized() {
  return new NextResponse("Authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="ATTO admin", charset="UTF-8"',
    },
  });
}

function decodeBasic(b64: string): { user: string; pass: string } | null {
  try {
    const decoded = Buffer.from(b64, "base64").toString("utf-8");
    const sepIdx = decoded.indexOf(":");
    if (sepIdx === -1) return null;
    return {
      user: decoded.slice(0, sepIdx),
      pass: decoded.slice(sepIdx + 1),
    };
  } catch {
    return null;
  }
}

/** Constant-time string comparison to avoid timing-side-channel leaks. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export const config = {
  matcher: ["/admin/:path*"],
};
