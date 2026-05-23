import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import crypto from "node:crypto";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import {
  SMS_DISCLOSURE_VERSION,
  TRANSACTIONAL_SMS_DISCLOSURE,
  MARKETING_SMS_DISCLOSURE,
  STOP_KEYWORDS,
  HELP_KEYWORDS,
  START_KEYWORDS,
  STOP_REPLY,
  HELP_REPLY,
  START_REPLY,
  hashDisclosure,
} from "@/lib/sms-compliance";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 3,
});

function escapeXml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function twiml(message: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(
    message
  )}</Message></Response>`;
}

function emptyTwiml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?><Response/>`;
}

function xmlResponse(body: string, status = 200) {
  return new NextResponse(body, {
    status,
    headers: { "Content-Type": "text/xml; charset=utf-8" },
  });
}

// https://www.twilio.com/docs/usage/webhooks/webhooks-security
function validateTwilioSignature(
  authToken: string,
  signature: string,
  url: string,
  params: Record<string, string>
): boolean {
  const sortedKeys = Object.keys(params).sort();
  let data = url;
  for (const k of sortedKeys) data += k + params[k];
  const computed = crypto
    .createHmac("sha1", authToken)
    .update(data)
    .digest("base64");
  if (computed.length !== signature.length) return false;
  return crypto.timingSafeEqual(
    Buffer.from(computed),
    Buffer.from(signature)
  );
}

function buildWebhookUrl(req: NextRequest): string {
  const explicit = process.env.TWILIO_WEBHOOK_PUBLIC_URL;
  if (explicit) return explicit;
  // Reconstruct from the inbound request — Twilio signs the URL it called.
  const proto =
    req.headers.get("x-forwarded-proto") ?? req.nextUrl.protocol.replace(":", "");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  return `${proto}://${host}${req.nextUrl.pathname}`;
}

function classifyKeyword(
  body: string
): "stop" | "help" | "start" | null {
  const normalized = body.trim().toUpperCase();
  if ((STOP_KEYWORDS as readonly string[]).includes(normalized)) return "stop";
  if ((HELP_KEYWORDS as readonly string[]).includes(normalized)) return "help";
  if ((START_KEYWORDS as readonly string[]).includes(normalized)) return "start";
  return null;
}

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const params: Record<string, string> = {};
  for (const [k, v] of formData.entries()) {
    if (typeof v === "string") params[k] = v;
  }

  const signature = req.headers.get("x-twilio-signature");
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (authToken) {
    if (!signature) {
      return xmlResponse(emptyTwiml(), 403);
    }
    const url = buildWebhookUrl(req);
    if (!validateTwilioSignature(authToken, signature, url, params)) {
      return xmlResponse(emptyTwiml(), 403);
    }
  } else {
    console.warn(
      "[twilio webhook] TWILIO_AUTH_TOKEN not set — signature validation skipped"
    );
  }

  const fromRaw = params.From ?? "";
  const body = params.Body ?? "";

  const phoneObj = parsePhoneNumberFromString(fromRaw);
  if (!phoneObj || !phoneObj.isValid()) {
    return xmlResponse(emptyTwiml());
  }
  const e164 = phoneObj.number;
  const intent = classifyKeyword(body);

  if (!intent) {
    // Inbound message we don't have a keyword handler for. Don't auto-reply.
    return xmlResponse(emptyTwiml());
  }

  const client = await pool.connect();
  try {
    if (intent === "stop") {
      await client.query(
        `UPDATE sms_consent_records
         SET revoked_at = now(), revoked_via = 'sms_stop'
         WHERE phone_number = $1 AND revoked_at IS NULL AND consent_given = true`,
        [e164]
      );
      return xmlResponse(twiml(STOP_REPLY));
    }

    if (intent === "help") {
      return xmlResponse(twiml(HELP_REPLY));
    }

    // intent === "start" — re-subscribe by inserting NEW consent records.
    const lookup = await client.query(
      `SELECT email FROM sms_consent_records
       WHERE phone_number = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [e164]
    );
    const email = (lookup.rows[0]?.email as string | undefined) ?? "";

    const [txHash, mkHash] = await Promise.all([
      hashDisclosure(TRANSACTIONAL_SMS_DISCLOSURE),
      hashDisclosure(MARKETING_SMS_DISCLOSURE),
    ]);

    await client.query("BEGIN");
    await client.query(
      `INSERT INTO sms_consent_records
         (phone_number, email, consent_type, consent_given,
          consent_text_version, consent_text_hash, consent_text_full,
          ip_address, user_agent, form_url)
       VALUES ($1,$2,'transactional',true,$3,$4,$5,NULL,'twilio-sms-webhook','sms:start')`,
      [e164, email, SMS_DISCLOSURE_VERSION, txHash, TRANSACTIONAL_SMS_DISCLOSURE]
    );
    await client.query(
      `INSERT INTO sms_consent_records
         (phone_number, email, consent_type, consent_given,
          consent_text_version, consent_text_hash, consent_text_full,
          ip_address, user_agent, form_url)
       VALUES ($1,$2,'marketing',true,$3,$4,$5,NULL,'twilio-sms-webhook','sms:start')`,
      [e164, email, SMS_DISCLOSURE_VERSION, mkHash, MARKETING_SMS_DISCLOSURE]
    );
    await client.query("COMMIT");

    return xmlResponse(twiml(START_REPLY));
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // ignore
    }
    console.error("[twilio webhook] failed:", err);
    return xmlResponse(emptyTwiml(), 500);
  } finally {
    client.release();
  }
}
