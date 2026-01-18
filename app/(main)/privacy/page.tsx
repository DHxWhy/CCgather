import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Privacy Policy for CCgather",
};

export default function PrivacyPage() {
  const lastUpdated = "January 19, 2026";

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <p className="text-xs text-[var(--color-claude-coral)] font-medium tracking-wide uppercase mb-3">
          Legal
        </p>
        <h1 className="text-2xl md:text-3xl font-semibold text-[var(--color-text-primary)] mb-2">
          Privacy Policy
        </h1>
        <p className="text-sm text-[var(--color-text-muted)]">Last updated: {lastUpdated}</p>
      </div>

      {/* Content */}
      <div className="space-y-6 text-sm text-[var(--color-text-secondary)] leading-relaxed">
        <section className="glass rounded-2xl p-6 space-y-4">
          <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
            1. What We Collect
          </h2>
          <ul className="list-disc list-inside space-y-2 ml-2">
            <li>
              <strong>From GitHub:</strong> Username, email, profile picture (via OAuth)
            </li>
            <li>
              <strong>From You:</strong> Claude Code usage data (tokens, cost), country (optional)
            </li>
            <li>
              <strong>Automatically:</strong> Basic analytics (page views, device type)
            </li>
          </ul>
        </section>

        <section className="glass rounded-2xl p-6 space-y-4">
          <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
            2. How We Use It
          </h2>
          <ul className="list-disc list-inside space-y-2 ml-2">
            <li>Display your profile and stats on public leaderboards</li>
            <li>Calculate rankings and badges</li>
            <li>Improve the service</li>
            <li>Send important service updates (optional marketing emails)</li>
          </ul>
        </section>

        <section className="glass rounded-2xl p-6 space-y-4">
          <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
            3. Who We Share With
          </h2>
          <p>
            <strong>Public:</strong> Your username, profile picture, country, and usage stats are
            visible on leaderboards.
          </p>
          <p className="mt-3">
            <strong>Service Providers:</strong>
          </p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Clerk (authentication)</li>
            <li>Supabase (database)</li>
            <li>Vercel (hosting)</li>
            <li>PostHog (analytics)</li>
          </ul>
          <p className="mt-3">We do not sell your personal data.</p>
        </section>

        <section className="glass rounded-2xl p-6 space-y-4">
          <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
            4. Your Rights
          </h2>
          <p>You can:</p>
          <ul className="list-disc list-inside space-y-2 ml-2">
            <li>Access and update your data in account settings</li>
            <li>Delete your account and all associated data</li>
            <li>Request a copy of your data</li>
            <li>Opt out of marketing communications</li>
          </ul>
          <p className="mt-3 text-[var(--color-text-muted)]">
            EU/California users have additional rights under GDPR/CCPA. Contact us to exercise them.
          </p>
        </section>

        <section className="glass rounded-2xl p-6 space-y-4">
          <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
            5. Data Security & Retention
          </h2>
          <p>
            We use HTTPS encryption and secure database storage. Your data is retained while your
            account is active. Deleted accounts enter a 3-day grace period (allowing recovery),
            after which all data is permanently purged.
          </p>
        </section>

        <section className="glass rounded-2xl p-6 space-y-4">
          <h2 className="text-base font-semibold text-[var(--color-text-primary)]">6. Cookies</h2>
          <p>
            We use essential cookies for authentication and preferences (like dark mode). Analytics
            cookies help us understand how the service is used.
          </p>
        </section>

        <section className="glass rounded-2xl p-6 space-y-4">
          <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
            7. Changes & Contact
          </h2>
          <p>
            We may update this policy as the service evolves. Significant changes will be announced
            on the site.
          </p>
          <p className="mt-3">
            Questions? Contact us at{" "}
            <span className="text-[var(--color-claude-coral)]">privacy@ccgather.com</span>
          </p>
        </section>

        {/* Footer */}
        <div className="flex items-center justify-center gap-4 pt-4 text-[var(--color-text-muted)]">
          <Link href="/terms" className="hover:text-[var(--color-claude-coral)] transition-colors">
            Terms of Service
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
