import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Terms of Service for CCgather",
};

export default function TermsPage() {
  const lastUpdated = "January 8, 2026";

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <p className="text-xs text-[var(--color-claude-coral)] font-medium tracking-wide uppercase mb-3">
          Legal
        </p>
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)] mb-2">
          Terms of Service
        </h1>
        <p className="text-sm text-[var(--color-text-secondary)]">Last updated: {lastUpdated}</p>
      </div>

      {/* Content */}
      <div className="space-y-6 text-sm text-[var(--color-text-secondary)] leading-relaxed">
        <section className="glass rounded-2xl p-6 space-y-4">
          <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
            1. Service Overview
          </h2>
          <p>
            CCgather is a leaderboard platform for Claude Code developers. By using our service, you
            agree to these terms. If you disagree, please do not use the service.
          </p>
        </section>

        <section className="glass rounded-2xl p-6 space-y-4">
          <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
            2. Eligibility
          </h2>
          <p>
            You must be at least 13 years old to use this service (required by GitHub&apos;s terms).
            By using CCgather, you confirm you meet this requirement.
          </p>
        </section>

        <section className="glass rounded-2xl p-6 space-y-4">
          <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
            3. Your Responsibilities
          </h2>
          <ul className="list-disc list-inside space-y-2 ml-2">
            <li>Submit accurate usage data only</li>
            <li>Do not manipulate rankings or submit false information</li>
            <li>Do not interfere with or disrupt the service</li>
            <li>Keep your GitHub account secure</li>
          </ul>
        </section>

        <section className="glass rounded-2xl p-6 space-y-4">
          <h2 className="text-base font-semibold text-[var(--color-text-primary)]">4. Your Data</h2>
          <p>
            By submitting usage data, you agree that it will be displayed publicly on leaderboards.
            See our{" "}
            <Link href="/privacy" className="text-[var(--color-claude-coral)] hover:underline">
              Privacy Policy
            </Link>{" "}
            for details on how we handle your data.
          </p>
        </section>

        <section className="glass rounded-2xl p-6 space-y-4">
          <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
            5. Disclaimer
          </h2>
          <p>
            The service is provided &quot;as is&quot; without warranties. We are not responsible for
            the accuracy of user-submitted data. &quot;Claude Code&quot; is a trademark of
            Anthropic; CCgather is not affiliated with Anthropic.
          </p>
        </section>

        <section className="glass rounded-2xl p-6 space-y-4">
          <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
            6. Account Termination
          </h2>
          <p>
            We may suspend or terminate accounts that violate these terms. You can delete your
            account anytime through settings.
          </p>
        </section>

        <section className="glass rounded-2xl p-6 space-y-4">
          <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
            7. Changes & Contact
          </h2>
          <p>
            We may update these terms as the service evolves. Continued use after changes means you
            accept the new terms.
          </p>
          <p>
            Questions? Contact us at{" "}
            <a
              href="mailto:contact@ccgather.com"
              className="text-[var(--color-claude-coral)] hover:underline"
            >
              contact@ccgather.com
            </a>
          </p>
        </section>

        {/* Footer */}
        <div className="flex items-center justify-center gap-4 pt-4 text-[var(--color-text-muted)]">
          <Link
            href="/privacy"
            className="hover:text-[var(--color-claude-coral)] transition-colors"
          >
            Privacy Policy
          </Link>
          <span>•</span>
          <Link href="/" className="hover:text-[var(--color-claude-coral)] transition-colors">
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
