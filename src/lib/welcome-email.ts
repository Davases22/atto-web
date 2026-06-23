import { Resend } from "resend";
import { unsubscribeUrl } from "@/lib/unsubscribe";

// Reuses the same verified Resend domain (attosound.com) as the app backend.
// If the key is absent (local/preview), we no-op so signups still succeed.
const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM =
  process.env.RESEND_WELCOME_FROM || "ATTO Sound <welcome@attosound.com>";

// The copy invites replies ("reply to this email"), so point replies at a
// monitored inbox rather than the no-reply sending address.
const REPLY_TO = process.env.RESEND_REPLY_TO || "attosound1@gmail.com";

// iOS  -> public TestFlight invite link
// Android -> Expo / EAS internal-distribution build page (.apk)
const IOS_TESTFLIGHT_URL = process.env.IOS_TESTFLIGHT_URL || "";
const ANDROID_APK_URL = process.env.ANDROID_APK_URL || "";

type Platform = "ios" | "android";

interface Content {
  name: string;
  ctaLabel: string;
  ctaUrl: string;
  steps: string[];
  note: string;
  troubleshoot: { title: string; intro: string; items: string[] };
  unsubUrl: string;
}

// Shared narrative — identical for both platforms (verbatim from the brand
// copy, with minor punctuation cleanup).
const STORY: string[] = [
  "ATTO Sound is a platform designed to help incarcerated artists and creators showcase their work, connect with supporters and reach new audiences.",
  "During this pilot phase, we're testing features, gathering feedback, and building the foundation for the community we're creating together.",
  "As part of the first wave you'll join a community that will be participating in a creative showcase. Participants will receive weekly creative challenges, with standout submissions featured throughout the program and eligible for <strong>$225 in weekly cash rewards</strong>. Selections will be based on creativity, engagement and community response. Additional details will be shared in the coming weeks.",
  "For now, we encourage you to use ATTO Sound normally — create, explore, engage with others, and help us understand what works and what doesn't.",
  "Because this is a pilot program you may encounter bugs, unfinished features, or areas that need improvement. If something feels confusing, broken, or could be better, please let us know through the app. Your feedback will directly influence what we build next.",
  "A final update will be released in one week that enables incarcerated users to call directly into the app like a standard phone number, allowing them to begin recording and creating through ATTO Sound.",
  "Thank you for being here at the beginning and helping build what ATTO Sound is becoming.",
  "A place where incarcerated creators can express themselves freely, connect with the world, and build real opportunities.",
];

const LEAD =
  "You've been accepted into our early-access pilot and are among the first people helping shape the platform before public launch. Here's how to get started on your device:";

export async function sendWelcomeEmail(opts: {
  to: string;
  firstName: string;
  platform: Platform;
}): Promise<void> {
  if (!resend) {
    console.warn("[welcome-email] RESEND_API_KEY not set — skipping send");
    return;
  }

  const { to, firstName, platform } = opts;
  const unsubUrl = unsubscribeUrl(to);
  const { subject, html, text } = buildWelcomeEmail(firstName, platform, unsubUrl);

  const { error } = await resend.emails.send({
    from: FROM,
    to,
    subject,
    html,
    text,
    replyTo: REPLY_TO,
    headers: {
      // RFC 8058 one-click unsubscribe — surfaces the native "Unsubscribe"
      // control in Gmail / Apple Mail.
      "List-Unsubscribe": `<${unsubUrl}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  });

  if (error) {
    throw new Error(`Resend error: ${error.message}`);
  }
}

export function buildWelcomeEmail(
  firstName: string,
  platform: Platform,
  unsubUrl = "https://attosound.com"
): { subject: string; html: string; text: string } {
  const name = firstName?.trim() || "there";

  const content: Content =
    platform === "ios"
      ? {
          name,
          ctaLabel: "Open in TestFlight",
          ctaUrl: IOS_TESTFLIGHT_URL,
          steps: [
            "Open this email <strong>on your iPhone</strong> (not a computer) and tap the button above.",
            "If you don't have TestFlight yet, the App Store will prompt you to install it — it's free and made by Apple.",
            "Inside TestFlight, tap <strong>Install</strong> (or <strong>Accept</strong>) to download ATTO Sound.",
            "Open the app and you're in 🎉",
          ],
          troubleshoot: {
            title: "If TestFlight won't let you in",
            intro:
              "TestFlight is Apple's official app for trying beta apps — it's completely safe. If something doesn't work:",
            items: [
              "<strong>Don't see TestFlight?</strong> Install it free from the App Store, then tap <strong>Open in TestFlight</strong> above again.",
              "<strong>\"This beta is full\" or \"not accepting new testers\"</strong> → reply to this email and we'll open a spot for you.",
              "<strong>\"This build is no longer available\"</strong> → TestFlight builds expire after 90 days; reply and we'll send you the latest one.",
              "Make sure you open the link <strong>on your iPhone</strong> (not a Mac or iPad) for the smoothest install.",
            ],
          },
          note: "TestFlight builds expire after 90 days — when that happens, just open TestFlight and tap Update, or we'll email you a fresh invite.",
          unsubUrl,
        }
      : {
          name,
          ctaLabel: "Download ATTO Sound",
          ctaUrl: ANDROID_APK_URL,
          steps: [
            "Open this email <strong>on your Android phone</strong> (not a computer) and tap the button above.",
            "On the Expo page that opens, tap <strong>Install</strong> to download the app file.",
            "When the download finishes, tap the file to open it, then tap <strong>Install</strong>.",
            "Open the app and you're in 🎉",
          ],
          troubleshoot: {
            title: "If your phone won't let you install",
            intro:
              "ATTO Sound isn't on the Google Play Store yet, so Android may warn you — the app is safe. Depending on your phone, do one of these:",
            items: [
              "<strong>\"For your security, your phone isn't allowed to install unknown apps from this source\"</strong> → tap <strong>Settings</strong> in that popup, turn on <strong>Allow from this source</strong>, press back, and tap <strong>Install</strong> again.",
              "<strong>Samsung / other brands:</strong> open <strong>Settings → Apps → (⋮) Special access → Install unknown apps</strong>, pick the browser you downloaded with (e.g. Chrome), and turn on <strong>Allow from this source</strong>.",
              "<strong>Play Protect says \"Unsafe app blocked\" or \"App not scanned\"</strong> → tap <strong>More details</strong> (or <strong>Install without scanning</strong>) → <strong>Install anyway</strong>.",
              "Still stuck? Reply to this email and we'll help you get in.",
            ],
          },
          note: "Because this is a direct download (not the Play Store), the app won't auto-update. When we ship a new build we'll email you a fresh link.",
          unsubUrl,
        };

  const subject =
    platform === "ios"
      ? "Welcome to ATTO Sound — your TestFlight invite 🎧"
      : "Welcome to ATTO Sound — download the beta 🎧";

  return { subject, html: shell(content), text: textBody(content) };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, "");
}

// Plain-text alternative — HTML-only sends score worse with spam filters.
function textBody(c: Content): string {
  const lines = [
    `Hello ${c.name},`,
    "",
    "Welcome to ATTO Sound",
    "",
    stripTags(LEAD),
    "",
    `${c.ctaLabel}: ${c.ctaUrl || "https://attosound.com"}`,
    "",
    ...c.steps.map((s, i) => `${i + 1}. ${stripTags(s)}`),
    "",
    `${c.troubleshoot.title}`,
    stripTags(c.troubleshoot.intro),
    ...c.troubleshoot.items.map((it) => `- ${stripTags(it)}`),
    "",
    c.note,
    "",
    "---",
    "",
    ...STORY.map((p) => stripTags(p)),
    "",
    "— The ATTO Sound Team",
    "",
    "You're receiving this because you joined the ATTO Sound waitlist.",
    `Unsubscribe: ${c.unsubUrl}`,
  ];
  return lines.join("\n");
}

function shell(c: Content): string {
  const { ctaLabel, ctaUrl, steps, note, troubleshoot, unsubUrl } = c;
  const safeName = escapeHtml(c.name);

  const stepsHtml = steps
    .map(
      (s, i) => `
      <tr>
        <td valign="top" width="34" style="padding:0 10px 14px 0;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
            <td align="center" valign="middle" width="24" height="24" bgcolor="#ffffff" style="width:24px;height:24px;border-radius:9999px;background:#ffffff;color:#000000;font-size:13px;font-weight:600;line-height:24px;">${i + 1}</td>
          </tr></table>
        </td>
        <td valign="top" style="padding:0 0 14px 0;color:#d4d4d4;font-size:15px;line-height:1.5;">${s}</td>
      </tr>`
    )
    .join("");

  const troubleshootItems = troubleshoot.items
    .map(
      (it) =>
        `<p style="margin:0 0 12px 0;font-size:13px;line-height:1.55;color:#d4d4d4;">• ${it}</p>`
    )
    .join("");

  const storyHtml = STORY.map(
    (p) =>
      `<p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#d4d4d4;">${p}</p>`
  ).join("");

  // ctaUrl may be empty if the env var isn't set yet — keep the button but
  // point it at the site so the email never has a dead "#" link.
  const href = ctaUrl || "https://attosound.com";

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="dark" />
    <meta name="supported-color-schemes" content="dark light" />
  </head>
  <body bgcolor="#000000" style="margin:0;padding:0;background:#000000;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#000000" style="background:#000000;">
      <tr>
        <td align="center" bgcolor="#000000" style="padding:40px 16px;background:#000000;">
          <!--[if mso]><table role="presentation" width="480" align="center" cellpadding="0" cellspacing="0" border="0" bgcolor="#000000"><tr><td><![endif]-->
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" border="0" bgcolor="#000000" style="width:100%;max-width:480px;background:#000000;">
            <tr>
              <td bgcolor="#000000" style="padding:32px 32px 8px 32px;">
                <div style="font-size:22px;font-weight:700;letter-spacing:-0.02em;color:#ffffff;">ATTO</div>
              </td>
            </tr>
            <tr>
              <td bgcolor="#000000" style="padding:8px 32px 0 32px;">
                <p style="margin:0 0 6px 0;font-size:15px;color:#a3a3a3;">Hello ${safeName},</p>
                <h1 style="margin:0 0 14px 0;font-size:25px;line-height:1.25;font-weight:700;color:#ffffff;">Welcome to ATTO Sound 🎧</h1>
                <p style="margin:0 0 24px 0;font-size:15px;line-height:1.6;color:#d4d4d4;">${LEAD}</p>
              </td>
            </tr>
            <tr>
              <td bgcolor="#000000" style="padding:0 32px 8px 32px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
                  <td align="center" bgcolor="#ffffff" style="border-radius:9999px;background:#ffffff;">
                    <a href="${href}" style="display:inline-block;color:#000000;text-decoration:none;font-size:15px;font-weight:600;padding:13px 24px;border-radius:9999px;">${ctaLabel}</a>
                  </td>
                </tr></table>
              </td>
            </tr>
            <tr>
              <td bgcolor="#000000" style="padding:24px 32px 0 32px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                  ${stepsHtml}
                </table>
              </td>
            </tr>
            <tr>
              <td bgcolor="#000000" style="padding:18px 32px 0 32px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#171717" style="background:#171717;border:1px solid #2a2a2a;border-radius:12px;"><tr>
                  <td style="padding:18px 18px 6px 18px;">
                    <p style="margin:0 0 6px 0;font-size:15px;font-weight:600;color:#ffffff;">🔒 ${troubleshoot.title}</p>
                    <p style="margin:0 0 12px 0;font-size:13px;line-height:1.5;color:#a3a3a3;">${troubleshoot.intro}</p>
                    ${troubleshootItems}
                  </td>
                </tr></table>
              </td>
            </tr>
            <tr>
              <td bgcolor="#000000" style="padding:14px 32px 0 32px;">
                <p style="margin:0;font-size:13px;line-height:1.5;color:#8a8a8a;">${note}</p>
              </td>
            </tr>
            <tr>
              <td bgcolor="#000000" style="padding:28px 32px 0 32px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
                  <td height="1" bgcolor="#1f1f1f" style="height:1px;line-height:1px;font-size:1px;">&nbsp;</td>
                </tr></table>
              </td>
            </tr>
            <tr>
              <td bgcolor="#000000" style="padding:24px 32px 0 32px;">
                ${storyHtml}
                <p style="margin:8px 0 0 0;font-size:15px;line-height:1.6;color:#ffffff;">— The ATTO Sound Team</p>
              </td>
            </tr>
            <tr>
              <td bgcolor="#000000" style="padding:28px 32px 36px 32px;">
                <p style="margin:0;font-size:12px;line-height:1.6;color:#6b6b6b;">You're receiving this because you joined the ATTO Sound waitlist. If the button doesn't work, copy this link:<br /><span style="color:#8a8a8a;word-break:break-all;">${href}</span></p>
                <p style="margin:12px 0 0 0;font-size:12px;line-height:1.6;color:#6b6b6b;"><a href="${unsubUrl}" style="color:#8a8a8a;text-decoration:underline;">Unsubscribe</a> from ATTO Sound emails.</p>
              </td>
            </tr>
          </table>
          <!--[if mso]></td></tr></table><![endif]-->
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
