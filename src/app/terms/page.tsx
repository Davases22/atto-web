import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service | ATTO SOUND",
  description: "ATTO SOUND Beta Terms of Service.",
};

export default function TermsPage() {
  return (
    <main className="min-h-dvh bg-black text-white">
      <div className="mx-auto max-w-3xl px-6 py-16 sm:py-24">
        <Link
          href="/"
          className="mb-12 inline-block text-sm text-neutral-400 transition-opacity hover:opacity-70"
        >
          &larr; Back
        </Link>

        <h1 className="mb-2 text-3xl font-bold sm:text-4xl">
          Terms of Service
        </h1>
        <p className="mb-12 text-sm text-neutral-400">
          Effective Date: March 3, 2026
        </p>

        <div className="space-y-10 text-sm leading-relaxed text-neutral-300 [&_h2]:mb-3 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-white [&_p]:mb-3">
          <section>
            <p>
              PLEASE READ CAREFULLY. BY PARTICIPATING IN THE ATTO BETA OR USING
              OUR SERVICES, YOU AGREE TO THE FOLLOWING TERMS. IF YOU DO NOT
              AGREE, DO NOT USE THE BETA OR OUR SERVICES.
            </p>
          </section>

          <section>
            <h2>1. Beta Program and Disclaimer</h2>
            <p>
              1.1 ATTO SOUND (&ldquo;ATTO,&rdquo; &ldquo;we,&rdquo;
              &ldquo;us,&rdquo; or &ldquo;our&rdquo;) is a record label,
              content platform, and social network that discovers, showcases, and
              monetizes the creativity of incarcerated talent. We are providing
              access to a beta version of our software and technology (the
              &ldquo;Beta&rdquo;) for testing and evaluation purposes.
            </p>
            <p>
              1.2 The Beta is pre-release, experimental software, and
              functionality is not guaranteed. Features may change, malfunction,
              or be discontinued at any time without notice.
            </p>
            <p>
              1.3 The Beta may involve recording telephone calls via third-party
              networks over which ATTO has no control. Users acknowledge the
              experimental nature of these features.
            </p>
          </section>

          <section>
            <h2>2. User Acknowledgment and Assumption of Risk</h2>
            <p>
              2.1 You assume all risks associated with participation in the
              Beta, including, without limitation, legal claims, disciplinary
              actions, or loss or interruption of service.
            </p>
            <p>
              2.2 ATTO is not affiliated with, endorsed by, or responsible for
              any third-party phone systems, networks, or telecommunications
              providers.
            </p>
            <p>
              2.3 Users agree not to hold ATTO liable for any consequences
              arising from use of the Beta or the recording process.
            </p>
          </section>

          <section>
            <h2>3. Waitlist and Communications</h2>
            <p>
              3.1 By signing up for our waitlist, you consent to receive
              communications from ATTO SOUND regarding your waitlist status,
              product updates, and launch announcements via email and/or SMS.
            </p>
            <p>
              3.2 Message frequency may vary. Message and data rates may apply.
              You can opt out of SMS communications at any time by replying STOP
              to any message. Reply HELP for assistance.
            </p>
            <p>
              3.3 By providing your phone number, you expressly consent to
              receive text messages from ATTO SOUND. Consent is not a condition
              of any purchase.
            </p>
          </section>

          <section>
            <h2>4. Recording and Data Collection</h2>
            <p>
              4.1 Participation in the Beta may involve recording of telephone
              calls.
            </p>
            <p>
              4.2 Recorded data may be temporarily stored and used solely for
              internal development, testing, quality assurance, and research
              purposes.
            </p>
            <p>
              4.3 No recorded content will be publicly distributed or uploaded
              during Beta testing without explicit user consent.
            </p>
            <p>
              4.4 ATTO may collect technical information such as device type,
              operating system, and connection status necessary to operate and
              improve the Beta.
            </p>
          </section>

          <section>
            <h2>5. User Obligations</h2>
            <p>
              5.1 Users may not record, transmit, or share content that violates
              applicable law, third-party rules, or constitutes harassment,
              threats, or illegal activity.
            </p>
            <p>
              5.2 ATTO reserves the right to suspend or terminate access for
              users who violate these Terms or engage in prohibited conduct.
            </p>
          </section>

          <section>
            <h2>6. Intellectual Property</h2>
            <p>
              6.1 All software, code, processes, recordings, and other
              intellectual property in the Beta are owned exclusively by ATTO.
            </p>
            <p>
              6.2 Users are granted a limited, non-exclusive, non-transferable
              license to use the Beta for participation in testing only.
            </p>
          </section>

          <section>
            <h2>7. Limitation of Liability and Indemnification</h2>
            <p className="uppercase">
              7.1 THE BETA AND ALL SERVICES ARE PROVIDED &ldquo;AS-IS&rdquo; AND
              &ldquo;AS AVAILABLE.&rdquo;
            </p>
            <p className="uppercase">
              7.2 TO THE MAXIMUM EXTENT PERMITTED BY LAW, ATTO DISCLAIMS ALL
              WARRANTIES, EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY, FITNESS
              FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
            </p>
            <p className="uppercase">
              7.3 USERS AGREE TO RELEASE, INDEMNIFY, AND HOLD HARMLESS ATTO,
              ITS OFFICERS, DIRECTORS, EMPLOYEES, AND AGENTS FROM ANY AND ALL
              CLAIMS, DAMAGES, LOSSES, OR LIABILITIES ARISING FROM PARTICIPATION
              IN THE BETA, INCLUDING BUT NOT LIMITED TO RECORDING TELEPHONE
              CALLS OR INTERACTIONS WITH THIRD-PARTY SYSTEMS.
            </p>
          </section>

          <section>
            <h2>8. Termination</h2>
            <p>
              8.1 ATTO may, in its sole discretion, suspend or terminate your
              access to the Beta at any time, with or without notice, for any
              reason.
            </p>
            <p>
              8.2 All recorded data collected during Beta may be deleted at any
              time at ATTO&rsquo;s discretion.
            </p>
          </section>

          <section>
            <h2>9. Governing Law</h2>
            <p>
              9.1 These Terms are governed by the laws of the State of
              Connecticut, without regard to conflicts of law principles.
            </p>
            <p>
              9.2 Any dispute arising under or in connection with these Terms
              shall be resolved exclusively in the courts located in
              Connecticut.
            </p>
          </section>

          <section>
            <h2>10. Changes to These Terms</h2>
            <p>
              10.1 ATTO reserves the right to modify these Terms at any time. We
              will notify users of material changes via email or through the
              platform. Continued use of the Beta after changes constitutes
              acceptance of the updated Terms.
            </p>
          </section>

          <section>
            <h2>11. Contact</h2>
            <p>
              If you have questions about these Terms, please contact us at{" "}
              <a
                href="mailto:contact@attosound.com"
                className="text-white underline underline-offset-2 transition-opacity hover:opacity-70"
              >
                contact@attosound.com
              </a>
              .
            </p>
          </section>

          <section className="border-t border-neutral-800 pt-8 text-neutral-400">
            <p>
              BY PARTICIPATING IN THE ATTO BETA, YOU ACKNOWLEDGE THAT YOU HAVE
              READ, UNDERSTAND, AND AGREE TO THESE TERMS, INCLUDING THE
              RECORDING, DATA HANDLING, AND LIABILITY PROVISIONS.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
