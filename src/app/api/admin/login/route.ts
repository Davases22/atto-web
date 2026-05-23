import { NextRequest, NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  issueSessionToken,
} from "@/lib/admin-session";

/** Constant-time string comparison to avoid timing-side-channel leaks. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export async function POST(req: NextRequest) {
  const expectedUser = process.env.ADMIN_USER;
  const expectedPass = process.env.ADMIN_PASS;
  if (!expectedUser || !expectedPass) {
    return NextResponse.json(
      { error: "Admin login is not configured on the server" },
      { status: 503 }
    );
  }

  let body: { user?: string; pass?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const user = (body.user || "").trim();
  const pass = body.pass || "";
  if (!user || !pass) {
    return NextResponse.json(
      { error: "User and password are required" },
      { status: 400 }
    );
  }

  if (!timingSafeEqual(user, expectedUser) || !timingSafeEqual(pass, expectedPass)) {
    return NextResponse.json(
      { error: "Wrong user or password" },
      { status: 401 }
    );
  }

  const token = await issueSessionToken();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return res;
}
