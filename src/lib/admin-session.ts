/**
 * HMAC-signed session token for the admin area.
 *
 * Why this exists
 *   We used to gate /admin/* with HTTP Basic Auth. It works, but Safari
 *   (especially on iOS) is notoriously bad at caching the Authorization
 *   header — users get re-prompted for credentials on every navigation,
 *   sometimes can't sign in at all from mobile. Browser-native Basic Auth
 *   is also impossible to style and offers no UX for failures.
 *
 *   This module replaces that with a self-contained signed token stored in
 *   an HttpOnly Secure cookie. The middleware verifies the cookie on every
 *   request; the login form trades credentials for a fresh token.
 *
 *   The signing key is derived from ADMIN_PASS so we don't introduce a new
 *   env var. As a side-effect, rotating ADMIN_PASS invalidates every active
 *   session — which is what you want when you rotate a password.
 *
 * Token shape
 *   `<expirySeconds>.<base64url(hmacSha256(secret, expirySeconds))>`
 *   Compact, URL-safe, no JSON parsing on the hot path, no external deps.
 */

const ENCODER = new TextEncoder();

export const SESSION_COOKIE = "atto_admin_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7; // 7 days

function bytesToBase64Url(bytes: ArrayBuffer): string {
  let s = "";
  const view = new Uint8Array(bytes);
  for (let i = 0; i < view.length; i++) s += String.fromCharCode(view[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function importKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    ENCODER.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
}

async function hmac(secret: string, payload: string): Promise<string> {
  const key = await importKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, ENCODER.encode(payload));
  return bytesToBase64Url(sig);
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

export function getSessionSecret(): string | null {
  const pass = process.env.ADMIN_PASS;
  if (!pass) return null;
  // Tag the secret so the signing key is namespaced even if ADMIN_PASS is
  // ever reused elsewhere.
  return `atto-admin-session:v1:${pass}`;
}

export async function issueSessionToken(): Promise<string> {
  const secret = getSessionSecret();
  if (!secret) throw new Error("ADMIN_PASS not configured");
  const expiry = Math.floor(Date.now() / 1000) + SESSION_DURATION_SECONDS;
  const exp = String(expiry);
  const sig = await hmac(secret, exp);
  return `${exp}.${sig}`;
}

export async function isValidSessionToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const secret = getSessionSecret();
  if (!secret) return false;

  const dot = token.indexOf(".");
  if (dot <= 0 || dot === token.length - 1) return false;
  const exp = token.slice(0, dot);
  const sig = token.slice(dot + 1);

  const expNum = Number(exp);
  if (!Number.isFinite(expNum) || expNum <= Math.floor(Date.now() / 1000)) {
    return false;
  }

  const expected = await hmac(secret, exp);
  return timingSafeEqual(expected, sig);
}

export const SESSION_MAX_AGE = SESSION_DURATION_SECONDS;
