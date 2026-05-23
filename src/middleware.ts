import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, isValidSessionToken } from "@/lib/admin-session";

/**
 * Cookie-session gate for the admin area.
 *
 * Why we don't use HTTP Basic Auth: Safari (especially mobile) caches the
 * Authorization header so poorly that signed-in users were getting the
 * native login dialog over and over. The replacement is a custom login
 * form (/admin/login) that issues an HttpOnly signed cookie; the cookie is
 * what we check here.
 *
 * Fail-closed for admin routes: if ADMIN_USER / ADMIN_PASS are not set,
 * we deliberately block every admin request rather than risk leaving the
 * surface area open on a misconfigured deploy.
 */
export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // The login page itself and its API are the only admin paths that must
  // stay reachable without a session — otherwise users could never sign in.
  if (pathname === "/admin/login" || pathname === "/api/admin/login") {
    return NextResponse.next();
  }

  if (!process.env.ADMIN_USER || !process.env.ADMIN_PASS) {
    return new NextResponse("Admin not configured", { status: 503 });
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (await isValidSessionToken(token)) {
    return NextResponse.next();
  }

  // API callers get a clean 401 JSON they can react to programmatically.
  // Browser navigations get a redirect to the styled login form, with the
  // intended destination preserved so we can bounce back after sign-in.
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const loginUrl = req.nextUrl.clone();
  loginUrl.pathname = "/admin/login";
  loginUrl.search = `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(loginUrl);
}

export const config = {
  // Gate both the admin UI and the admin-only JSON APIs that mutate data.
  // Public endpoints under /api/waitlist (the signup form) stay open.
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
