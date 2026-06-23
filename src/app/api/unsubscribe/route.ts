import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import { verifyUnsubscribeToken } from "@/lib/unsubscribe";

// Needs Node (crypto + pg). Public route — middleware only gates /admin.
export const runtime = "nodejs";

const pool = new Pool({
  connectionString: process.env.WEB_DATABASE_URL || process.env.DATABASE_URL,
  max: 2,
});

// Self-provision the table so this works on the production web DB
// (WEB_DATABASE_URL, which we can't read to run the migration manually).
// Idempotent + cached so it runs at most once per process.
let ensured: Promise<void> | null = null;
function ensureTable(): Promise<void> {
  if (!ensured) {
    ensured = pool
      .query(
        `CREATE TABLE IF NOT EXISTS email_unsubscribes (
           email           TEXT PRIMARY KEY,
           unsubscribed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
           source          TEXT NOT NULL DEFAULT 'email_link'
         )`
      )
      .then(() => undefined)
      .catch((e) => {
        ensured = null; // let a later request retry
        throw e;
      });
  }
  return ensured;
}

async function markUnsubscribed(email: string): Promise<void> {
  await ensureTable();
  await pool.query(
    `INSERT INTO email_unsubscribes (email, source)
     VALUES ($1, 'email_link')
     ON CONFLICT (email) DO NOTHING`,
    [email.trim().toLowerCase()]
  );
}

// Browser click → confirmation page. GET is intentionally NON-mutating: mail
// scanners / link prefetchers (Outlook SafeLinks, antivirus, unfurlers) issue
// GETs without user intent, so the opt-out only happens on the POST below.
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const email = verifyUnsubscribeToken(token);

  if (!email) {
    return html(
      400,
      "Invalid link",
      "This unsubscribe link is invalid or has expired. If you keep getting emails, reply and we'll remove you."
    );
  }

  return html(
    200,
    "Unsubscribe?",
    `Confirm you want to stop receiving ATTO Sound emails at <strong>${escapeHtml(
      email
    )}</strong>.`,
    token
  );
}

// One-click unsubscribe (RFC 8058 — Gmail/Apple Mail POST here automatically)
// AND the confirmation-page form submit. This is where the opt-out is recorded.
export async function POST(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const email = verifyUnsubscribeToken(token);
  if (!email) return new NextResponse(null, { status: 400 });

  try {
    await markUnsubscribed(email);
  } catch (err) {
    console.error("[/api/unsubscribe] db error:", err);
    return html(
      500,
      "Something went wrong",
      "We couldn't process that right now. Please reply to the email and we'll remove you manually."
    );
  }

  return html(
    200,
    "You're unsubscribed",
    `<strong>${escapeHtml(
      email
    )}</strong> has been removed from ATTO Sound emails. You can rejoin anytime at attosound.com.`
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// When `confirmToken` is provided we render an Unsubscribe button that POSTs
// back to this same route — the actual opt-out is a deliberate user action.
function html(
  status: number,
  title: string,
  body: string,
  confirmToken?: string
): NextResponse {
  const action = confirmToken
    ? `<form method="POST" action="/api/unsubscribe?token=${encodeURIComponent(
        confirmToken
      )}" style="margin-top:28px;">
        <button type="submit" style="appearance:none;border:0;cursor:pointer;background:#ffffff;color:#000000;font-size:15px;font-weight:600;padding:13px 28px;border-radius:9999px;">Unsubscribe</button>
      </form>`
    : "";

  const page = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title} — ATTO Sound</title>
    <meta name="color-scheme" content="dark" />
  </head>
  <body style="margin:0;background:#000;color:#fff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <div style="max-width:440px;margin:0 auto;padding:80px 24px;text-align:center;">
      <div style="font-size:22px;font-weight:700;letter-spacing:-0.02em;margin-bottom:32px;">ATTO</div>
      <h1 style="font-size:22px;font-weight:700;margin:0 0 12px;">${title}</h1>
      <p style="font-size:15px;line-height:1.6;color:#a3a3a3;margin:0;">${body}</p>
      ${action}
    </div>
  </body>
</html>`;
  return new NextResponse(page, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
