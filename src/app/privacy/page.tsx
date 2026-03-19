import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy | ATTO SOUND",
  description: "ATTO SOUND Privacy Policy.",
  alternates: { canonical: "/privacy" },
  openGraph: {
    title: "Privacy Policy | ATTO SOUND",
    description: "ATTO SOUND Privacy Policy.",
    url: "/privacy",
  },
};

export default function PrivacyPage() {
  return (
    <main className="min-h-dvh bg-black text-white">
      <div className="mx-auto max-w-3xl px-6 py-16 sm:py-24">
        <Link
          href="/"
          className="mb-12 inline-block text-sm text-neutral-400 transition-opacity hover:opacity-70"
        >
          &larr; Back
        </Link>

        <h1 className="mb-2 text-3xl font-bold sm:text-4xl">Privacy Policy</h1>
        <p className="mb-12 text-sm text-neutral-400">
          Effective Date: March 3, 2026
        </p>

        <div className="space-y-10 text-sm leading-relaxed text-neutral-300 [&_h2]:mb-3 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-white [&_p]:mb-3">
          <section>
            <p>
              ATTO SOUND (&ldquo;ATTO,&rdquo; &ldquo;we,&rdquo;
              &ldquo;us,&rdquo; or &ldquo;our&rdquo;) is committed to
              protecting your privacy. This Privacy Policy explains how we
              collect, use, disclose, and safeguard your information when you
              visit our website at{" "}
              <a
                href="https://attosound.com"
                className="text-white underline underline-offset-2 transition-opacity hover:opacity-70"
              >
                attosound.com
              </a>
              , sign up for our waitlist, participate in our Beta program, or
              interact with us via SMS or email.
            </p>
          </section>

          <section>
            <h2>1. Information We Collect</h2>
            <p>
              <strong className="text-white">
                Personal Information You Provide:
              </strong>
            </p>
            <ul className="mb-3 list-inside list-disc space-y-1 pl-2">
              <li>First and last name</li>
              <li>Email address</li>
              <li>Phone number (with country code)</li>
              <li>Platform preference (iOS or Android)</li>
            </ul>
            <p>
              <strong className="text-white">
                Information Collected Automatically:
              </strong>
            </p>
            <ul className="mb-3 list-inside list-disc space-y-1 pl-2">
              <li>Device type and operating system</li>
              <li>Browser type and version</li>
              <li>IP address</li>
              <li>Pages visited and time spent on our website</li>
              <li>Connection status and technical diagnostics</li>
            </ul>
            <p>
              <strong className="text-white">Beta Program Data:</strong>
            </p>
            <ul className="list-inside list-disc space-y-1 pl-2">
              <li>
                Telephone call recordings (only during Beta participation with
                your consent)
              </li>
              <li>Usage data related to Beta features</li>
            </ul>
          </section>

          <section>
            <h2>2. How We Use Your Information</h2>
            <p>We use the information we collect to:</p>
            <ul className="list-inside list-disc space-y-1 pl-2">
              <li>Manage your waitlist registration and account</li>
              <li>
                Send you updates about your waitlist status, product launches,
                and announcements via email and/or SMS
              </li>
              <li>Operate, develop, and improve the Beta and our platform</li>
              <li>
                Conduct internal testing, quality assurance, and research
              </li>
              <li>Respond to your inquiries and provide customer support</li>
              <li>Comply with legal obligations</li>
            </ul>
          </section>

          <section>
            <h2>3. SMS Communications</h2>

            <p>
              <strong className="text-white">
                3a. Verification &amp; Authentication Messages (OTP)
              </strong>
            </p>
            <p>
              When you create an account or log in to the ATTO SOUND platform,
              we will send one-time passcodes (OTP) via SMS for identity
              verification. These are transactional messages sent only upon your
              explicit request. You cannot opt out of OTP messages while using
              account authentication features.
            </p>

            <p>
              <strong className="text-white">
                3b. Waitlist &amp; Marketing Messages
              </strong>
            </p>
            <p>
              By providing your phone number on our waitlist form, you consent
              to receive text messages about waitlist status, product launches,
              and platform announcements.
            </p>
            <ul className="list-inside list-disc space-y-1 pl-2">
              <li>Message frequency may vary</li>
              <li>Message and data rates may apply</li>
              <li>
                Reply <strong className="text-white">STOP</strong> to opt out
                at any time
              </li>
              <li>
                Reply <strong className="text-white">HELP</strong> for
                assistance
              </li>
              <li>Consent is not a condition of any purchase</li>
            </ul>
            <p className="mt-3">
              We will not share your phone number or SMS opt-in data with third
              parties for their own marketing purposes.
            </p>
          </section>

          <section>
            <h2>4. How We Share Your Information</h2>
            <p>
              We do not sell your personal information. We may share your
              information only in the following circumstances:
            </p>
            <ul className="list-inside list-disc space-y-1 pl-2">
              <li>
                <strong className="text-white">Service Providers:</strong> With
                trusted third-party vendors who assist us in operating our
                platform (e.g., hosting, analytics, messaging services such as
                Twilio), subject to confidentiality obligations.
              </li>
              <li>
                <strong className="text-white">Legal Requirements:</strong> When
                required by law, regulation, legal process, or governmental
                request.
              </li>
              <li>
                <strong className="text-white">Business Transfers:</strong> In
                connection with a merger, acquisition, or sale of assets, your
                information may be transferred as part of that transaction.
              </li>
            </ul>
          </section>

          <section>
            <h2>5. Data Security</h2>
            <p>
              We implement reasonable administrative, technical, and physical
              safeguards to protect your personal information from unauthorized
              access, alteration, disclosure, or destruction. However, no method
              of transmission over the internet or electronic storage is 100%
              secure, and we cannot guarantee absolute security.
            </p>
          </section>

          <section>
            <h2>6. Data Retention</h2>
            <p>
              We retain your personal information for as long as necessary to
              fulfill the purposes described in this Privacy Policy, unless a
              longer retention period is required or permitted by law. Waitlist
              data will be retained until the platform launches or you request
              deletion. Beta recordings may be deleted at any time at
              ATTO&rsquo;s discretion.
            </p>
          </section>

          <section>
            <h2>7. Your Rights</h2>
            <p>Depending on your location, you may have the right to:</p>
            <ul className="list-inside list-disc space-y-1 pl-2">
              <li>Access the personal information we hold about you</li>
              <li>Request correction of inaccurate information</li>
              <li>Request deletion of your personal information</li>
              <li>Opt out of marketing communications</li>
              <li>Withdraw consent where processing is based on consent</li>
            </ul>
            <p className="mt-3">
              To exercise any of these rights, please contact us at{" "}
              <a
                href="mailto:contact@attosound.com"
                className="text-white underline underline-offset-2 transition-opacity hover:opacity-70"
              >
                contact@attosound.com
              </a>
              .
            </p>
          </section>

          <section>
            <h2>8. Children&rsquo;s Privacy</h2>
            <p>
              Our services are not directed to individuals under the age of 18.
              We do not knowingly collect personal information from children. If
              we become aware that we have collected data from a child under 18,
              we will take steps to delete such information promptly.
            </p>
          </section>

          <section>
            <h2>9. Third-Party Links</h2>
            <p>
              Our website may contain links to third-party websites or services
              (e.g., Instagram, TikTok, YouTube). We are not responsible for the
              privacy practices of these third parties. We encourage you to
              review their privacy policies.
            </p>
          </section>

          <section>
            <h2>10. Changes to This Privacy Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will
              notify you of material changes by posting the updated policy on
              our website with a revised effective date. Your continued use of
              our services after any changes constitutes acceptance of the
              updated Privacy Policy.
            </p>
          </section>

          <section>
            <h2>11. Governing Law</h2>
            <p>
              This Privacy Policy is governed by the laws of the State of
              Connecticut, without regard to conflicts of law principles.
            </p>
          </section>

          <section>
            <h2>12. Contact Us</h2>
            <p>
              If you have questions or concerns about this Privacy Policy or our
              data practices, please contact us at:
            </p>
            <p className="mt-3">
              ATTO SOUND
              <br />
              Email:{" "}
              <a
                href="mailto:contact@attosound.com"
                className="text-white underline underline-offset-2 transition-opacity hover:opacity-70"
              >
                contact@attosound.com
              </a>
              <br />
              Website:{" "}
              <a
                href="https://attosound.com"
                className="text-white underline underline-offset-2 transition-opacity hover:opacity-70"
              >
                attosound.com
              </a>
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
