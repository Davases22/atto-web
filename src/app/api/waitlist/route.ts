import { NextRequest, NextResponse, after } from "next/server";
import { Pool, PoolClient } from "pg";
import { z } from "zod";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import {
  SMS_DISCLOSURE_VERSION,
  TRANSACTIONAL_SMS_DISCLOSURE,
  MARKETING_SMS_DISCLOSURE,
  hashDisclosure,
} from "@/lib/sms-compliance";
import { sendWelcomeEmail } from "@/lib/welcome-email";

// Web-owned data (waitlist + consent ledger) lives in its own Railway
// Postgres, isolated from the social-service DB that other backends wipe
// on deploy. DATABASE_URL is kept as a fallback so local/preview envs
// without WEB_DATABASE_URL still boot.
const pool = new Pool({
  connectionString: process.env.WEB_DATABASE_URL || process.env.DATABASE_URL,
  max: 3,
});

const SignupSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required"),
  lastName: z.string().trim().min(1, "Last name is required"),
  email: z.string().trim().toLowerCase().email("Invalid email"),
  phone: z.string().trim().min(1, "Phone is required"),
  platformPreference: z.enum(["ios", "android"]),
  consentTransactionalSms: z.literal(true, {
    message: "You must consent to transactional SMS to join the waitlist",
  }),
  consentMarketingSms: z.boolean(),
});

function clientIp(req: NextRequest): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip");
}

async function insertConsent(
  client: PoolClient,
  params: {
    userId: string | null;
    phone: string;
    email: string;
    type: "transactional" | "marketing";
    given: boolean;
    text: string;
    hash: string;
    ip: string | null;
    ua: string;
    formUrl: string | null;
  }
) {
  await client.query(
    `INSERT INTO sms_consent_records
       (user_id, phone_number, email, consent_type, consent_given,
        consent_text_version, consent_text_hash, consent_text_full,
        ip_address, user_agent, form_url)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [
      params.userId,
      params.phone,
      params.email,
      params.type,
      params.given,
      SMS_DISCLOSURE_VERSION,
      params.hash,
      params.text,
      params.ip,
      params.ua,
      params.formUrl,
    ]
  );
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = SignupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const data = parsed.data;

  const phoneObj = parsePhoneNumberFromString(data.phone);
  if (!phoneObj || !phoneObj.isValid()) {
    return NextResponse.json(
      { error: "Invalid phone number" },
      { status: 400 }
    );
  }
  const e164 = phoneObj.number;

  const ip = clientIp(req);
  const ua = req.headers.get("user-agent") ?? "";
  const formUrl = req.headers.get("referer");

  const [transactionalHash, marketingHash] = await Promise.all([
    hashDisclosure(TRANSACTIONAL_SMS_DISCLOSURE),
    hashDisclosure(MARKETING_SMS_DISCLOSURE),
  ]);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Atomic insert-or-detect-duplicate. A plain SELECT-then-INSERT races on
    // concurrent double-submits (both pass the SELECT, the 2nd INSERT hits the
    // UNIQUE(email) constraint and 500s); ON CONFLICT turns that into a clean 409.
    const insertUser = await client.query(
      `INSERT INTO waitlist_signups
         (first_name, last_name, email, phone_number, platform_preference)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (email) DO NOTHING
       RETURNING id`,
      [data.firstName, data.lastName, data.email, e164, data.platformPreference]
    );
    if (insertUser.rowCount === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ duplicate: true }, { status: 409 });
    }
    const userId = insertUser.rows[0].id as string;

    await insertConsent(client, {
      userId,
      phone: e164,
      email: data.email,
      type: "transactional",
      given: true,
      text: TRANSACTIONAL_SMS_DISCLOSURE,
      hash: transactionalHash,
      ip,
      ua,
      formUrl,
    });

    await insertConsent(client, {
      userId,
      phone: e164,
      email: data.email,
      type: "marketing",
      given: data.consentMarketingSms,
      text: MARKETING_SMS_DISCLOSURE,
      hash: marketingHash,
      ip,
      ua,
      formUrl,
    });

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[/api/waitlist] insert failed:", err);
    return NextResponse.json(
      { error: "Failed to save signup" },
      { status: 500 }
    );
  } finally {
    client.release();
  }

  // Send the platform-specific welcome email after the response is flushed.
  // Runs on Vercel via after() (not killed when the function returns) and
  // never fails the signup if Resend errors.
  after(async () => {
    try {
      // Respect prior unsubscribes. Fail open: if the table doesn't exist yet
      // (migration not applied), still send rather than silently dropping it.
      let suppressed = false;
      try {
        const r = await pool.query(
          "SELECT 1 FROM email_unsubscribes WHERE email = $1 LIMIT 1",
          [data.email]
        );
        suppressed = !!(r.rowCount && r.rowCount > 0);
      } catch (e) {
        console.error("[/api/waitlist] unsubscribe check failed (sending anyway):", e);
      }
      if (suppressed) {
        console.log(`[/api/waitlist] skipping welcome — ${data.email} unsubscribed`);
        return;
      }

      await sendWelcomeEmail({
        to: data.email,
        firstName: data.firstName,
        platform: data.platformPreference,
      });
    } catch (err) {
      console.error("[/api/waitlist] welcome email failed:", err);
    }
  });

  return NextResponse.json({ ok: true });
}
