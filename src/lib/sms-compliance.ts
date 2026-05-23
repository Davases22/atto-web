export const SMS_DISCLOSURE_VERSION = "v1.0-2026-05-07";

export const TRANSACTIONAL_SMS_DISCLOSURE = `I agree to receive one-time verification codes (OTP) and account-related SMS messages from ATTO SOUND at the phone number I provided. Msg & data rates may apply. Reply STOP to opt out, HELP for help. See our Privacy Policy and Terms of Service.`;

export const MARKETING_SMS_DISCLOSURE = `I agree to receive promotional and marketing text messages from ATTO SOUND, including app launch announcements, invitations to download the ATTO SOUND app, product updates, and offers at the phone number provided. Msg frequency varies (up to 4 msgs/month). Msg & data rates may apply. Reply STOP to opt out, HELP for help. Consent is not a condition of any purchase. See our Privacy Policy and Terms of Service.`;

export const STOP_KEYWORDS = [
  "STOP",
  "STOPALL",
  "UNSUBSCRIBE",
  "CANCEL",
  "END",
  "QUIT",
  "OPTOUT",
  "REVOKE",
] as const;

export const HELP_KEYWORDS = ["HELP", "INFO", "SUPPORT"] as const;

export const START_KEYWORDS = ["START", "UNSTOP", "YES"] as const;

export const STOP_REPLY = `You have successfully been unsubscribed from ATTO SOUND. You will not receive any more messages from this number. Reply START to resubscribe.`;

export const HELP_REPLY = `ATTO Sound: Account verification SMS only. For support visit https://www.attosound.com or email contact@attosound.com. Msg & data rates may apply. Reply STOP to opt out.`;

export const START_REPLY = `You have been resubscribed to ATTO SOUND messages. Reply STOP to opt out at any time. Msg & data rates may apply.`;

export async function hashDisclosure(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
