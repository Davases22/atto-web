import crypto from "node:crypto";

// Self-hosted, one-click unsubscribe for transactional welcome emails.
// (Resend's {{{RESEND_UNSUBSCRIBE_URL}}} token only works in Broadcasts, not
// in emails.send(), so we sign our own HMAC token and host the endpoint.)

const SECRET = process.env.UNSUBSCRIBE_SECRET || "";
const SITE_URL = (process.env.SITE_URL || "https://attosound.com").replace(
  /\/$/,
  ""
);

function b64url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function b64urlDecode(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

/** `${base64url(email)}.${base64url(hmac)}` — opaque, tamper-evident. */
export function signUnsubscribeToken(email: string): string {
  // Fail loud rather than ship unsubscribe links that can never be verified
  // (verify returns null when SECRET is unset → every unsubscribe would 400).
  if (!SECRET) {
    throw new Error("UNSUBSCRIBE_SECRET is not set");
  }
  const payload = b64url(Buffer.from(email.trim().toLowerCase(), "utf8"));
  const sig = crypto.createHmac("sha256", SECRET).update(payload).digest();
  return `${payload}.${b64url(sig)}`;
}

/** Returns the email if the token is authentic, otherwise null. */
export function verifyUnsubscribeToken(token: string): string | null {
  if (!SECRET || !token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;

  const expected = b64url(
    crypto.createHmac("sha256", SECRET).update(payload).digest()
  );
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    return b64urlDecode(payload).toString("utf8");
  } catch {
    return null;
  }
}

export function unsubscribeUrl(email: string): string {
  return `${SITE_URL}/api/unsubscribe?token=${encodeURIComponent(
    signUnsubscribeToken(email)
  )}`;
}
