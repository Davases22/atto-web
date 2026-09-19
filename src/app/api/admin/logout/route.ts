import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/admin-session";

/**
 * Clears the admin session cookie and sends the browser to the login page.
 * The sidebar posts a plain form here, so a 303 redirect is what the
 * browser expects (it follows it with a GET).
 */
export async function POST(req: NextRequest) {
  const res = NextResponse.redirect(new URL("/admin/login", req.url), 303);
  res.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}
