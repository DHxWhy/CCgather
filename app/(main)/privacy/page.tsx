import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Privacy Policy for CCgather - how we collect, use, and protect your data.",
};

export default function PrivacyPage() {
  const lastUpdated = "January 8, 2026";

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
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
      <div className="prose prose-invert max-w-none space-y-8">
        {/* Introduction */}
        <section className="glass rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
            1. Introduction
          </h2>
          <div className="text-sm text-[var(--color-text-secondary)] space-y-3">
            <p>
              CCgather (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) respects your privacy
              and is committed to protecting your personal data. This Privacy Policy explains how we
              collect, use, and safeguard your information when you use our service at ccgather.com.
            </p>
            <p>
              This policy applies to all users worldwide and addresses requirements under GDPR (EU),
              CCPA (California), and other applicable privacy laws.
            </p>
          </div>
        </section>

        {/* Data We Collect */}
        <section className="glass rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
            2. Data We Collect
          </h2>
          <div className="text-sm text-[var(--color-text-secondary)] space-y-4">
            <div>
              <h3 className="font-medium text-[var(--color-text-primary)] mb-2">
                Account Information (via GitHub OAuth)
              </h3>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>GitHub username and user ID</li>
                <li>Email address</li>
                <li>Profile picture URL</li>
                <li>Public profile information</li>
              </ul>
            </div>
            <div>
              <h3 className="font-medium text-[var(--color-text-primary)] mb-2">
                Usage Data (Submitted by You)
              </h3>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Claude Code token usage statistics</li>
                <li>Estimated usage cost</li>
                <li>Subscription plan type (if provided)</li>
                <li>Country (optional, for regional leaderboards)</li>
              </ul>
            </div>
            <div>
              <h3 className="font-medium text-[var(--color-text-primary)] mb-2">
                Automatically Collected Data
              </h3>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>IP address and approximate location</li>
                <li>Browser type and version</li>
                <li>Device information</li>
                <li>Pages visited and interaction data</li>
              </ul>
            </div>
          </div>
        </section>

        {/* How We Use Data */}
        <section className="glass rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
            3. How We Use Your Data
          </h2>
          <div className="text-sm text-[var(--color-text-secondary)] space-y-3">
            <p>We use your data to:</p>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li>Create and manage your account</li>
              <li>Display your profile and statistics on public leaderboards</li>
              <li>Calculate rankings and award badges</li>
              <li>Provide regional (country-based) leaderboards</li>
              <li>Send important service notifications</li>
              <li>Improve our service through analytics</li>
              <li>Prevent fraud and ensure security</li>
            </ul>
          </div>
        </section>

        {/* Legal Basis (GDPR) */}
        <section className="glass rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
            4. Legal Basis for Processing (GDPR)
          </h2>
          <div className="text-sm text-[var(--color-text-secondary)] space-y-3">
            <p>For users in the European Economic Area (EEA), we process your data based on:</p>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li>
                <strong>Contract:</strong> Processing necessary to provide our service to you
              </li>
              <li>
                <strong>Consent:</strong> When you voluntarily submit usage data
              </li>
              <li>
                <strong>Legitimate Interest:</strong> For security, fraud prevention, and service
                improvement
              </li>
            </ul>
          </div>
        </section>

        {/* Data Sharing */}
        <section className="glass rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
            5. Data Sharing
          </h2>
          <div className="text-sm text-[var(--color-text-secondary)] space-y-3">
            <p>
              <strong>Public Display:</strong> Your username, profile picture, country, and usage
              statistics are displayed publicly on leaderboards.
            </p>
            <p>We share data with third-party service providers:</p>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li>
                <strong>Clerk</strong> - Authentication services (processes GitHub OAuth)
              </li>
              <li>
                <strong>Supabase</strong> - Database hosting (stores your data)
              </li>
              <li>
                <strong>Vercel</strong> - Website hosting and analytics
              </li>
            </ul>
            <p>
              We do not sell your personal data. We may share anonymized, aggregated data for
              analytical purposes.
            </p>
          </div>
        </section>

        {/* International Transfers */}
        <section className="glass rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
            6. International Data Transfers
          </h2>
          <div className="text-sm text-[var(--color-text-secondary)] space-y-3">
            <p>
              Your data may be transferred to and processed in countries outside your country of
              residence, including the United States. Our service providers implement appropriate
              safeguards such as Standard Contractual Clauses (SCCs) for EU data transfers.
            </p>
          </div>
        </section>

        {/* Data Retention */}
        <section className="glass rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
            7. Data Retention
          </h2>
          <div className="text-sm text-[var(--color-text-secondary)] space-y-3">
            <p>
              We retain your data for as long as your account is active. If you delete your account,
              we will delete your personal data within 30 days, except where we need to retain it
              for legal obligations or legitimate business purposes.
            </p>
            <p>Anonymized statistical data may be retained indefinitely for analytical purposes.</p>
          </div>
        </section>

        {/* Your Rights */}
        <section className="glass rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
            8. Your Rights
          </h2>
          <div className="text-sm text-[var(--color-text-secondary)] space-y-4">
            <div>
              <h3 className="font-medium text-[var(--color-text-primary)] mb-2">All Users</h3>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Access your data through your account settings</li>
                <li>Update or correct your profile information</li>
                <li>Delete your account and associated data</li>
                <li>Opt out of non-essential communications</li>
              </ul>
            </div>
            <div>
              <h3 className="font-medium text-[var(--color-text-primary)] mb-2">
                EEA Users (GDPR Rights)
              </h3>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Right to access your personal data</li>
                <li>Right to rectification of inaccurate data</li>
                <li>Right to erasure (&quot;right to be forgotten&quot;)</li>
                <li>Right to restrict processing</li>
                <li>Right to data portability</li>
                <li>Right to object to processing</li>
                <li>Right to lodge a complaint with a supervisory authority</li>
              </ul>
            </div>
            <div>
              <h3 className="font-medium text-[var(--color-text-primary)] mb-2">
                California Users (CCPA Rights)
              </h3>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Right to know what data we collect</li>
                <li>Right to delete your data</li>
                <li>Right to opt out of sale (we do not sell data)</li>
                <li>Right to non-discrimination for exercising your rights</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Security */}
        <section className="glass rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
            9. Security
          </h2>
          <div className="text-sm text-[var(--color-text-secondary)] space-y-3">
            <p>We implement industry-standard security measures to protect your data, including:</p>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li>HTTPS encryption for all data in transit</li>
              <li>Encrypted database storage</li>
              <li>OAuth-based authentication (no password storage)</li>
              <li>Regular security audits and updates</li>
            </ul>
            <p>
              However, no method of transmission over the Internet is 100% secure. We cannot
              guarantee absolute security.
            </p>
          </div>
        </section>

        {/* Cookies */}
        <section className="glass rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
            10. Cookies and Tracking
          </h2>
          <div className="text-sm text-[var(--color-text-secondary)] space-y-3">
            <p>We use cookies for:</p>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li>
                <strong>Essential cookies:</strong> Required for authentication and basic
                functionality
              </li>
              <li>
                <strong>Analytics cookies:</strong> To understand how users interact with our
                service
              </li>
              <li>
                <strong>Preference cookies:</strong> To remember your settings (e.g., dark mode)
              </li>
            </ul>
            <p>
              You can control cookies through your browser settings. Disabling essential cookies may
              affect service functionality.
            </p>
          </div>
        </section>

        {/* Children's Privacy */}
        <section className="glass rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
            11. Children&apos;s Privacy
          </h2>
          <div className="text-sm text-[var(--color-text-secondary)] space-y-3">
            <p>
              Our service is not intended for children under 13 years of age. We do not knowingly
              collect personal data from children under 13. If you believe we have collected data
              from a child under 13, please contact us immediately.
            </p>
          </div>
        </section>

        {/* Changes */}
        <section className="glass rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
            12. Changes to This Policy
          </h2>
          <div className="text-sm text-[var(--color-text-secondary)] space-y-3">
            <p>
              We may update this Privacy Policy from time to time. We will notify you of material
              changes by posting the new policy on this page and updating the &quot;Last
              updated&quot; date.
            </p>
            <p>
              We encourage you to review this policy periodically. Continued use of the service
              after changes constitutes acceptance of the updated policy.
            </p>
          </div>
        </section>

        {/* Contact */}
        <section className="glass rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
            13. Contact Us
          </h2>
          <div className="text-sm text-[var(--color-text-secondary)] space-y-3">
            <p>
              If you have questions about this Privacy Policy or wish to exercise your rights,
              please contact us at:
            </p>
            <p className="text-[var(--color-claude-coral)]">privacy@ccgather.com</p>
            <p>
              For GDPR-related inquiries, you may also contact your local data protection authority.
            </p>
          </div>
        </section>

        {/* Footer Links */}
        <div className="flex items-center justify-center gap-4 pt-4 text-sm text-[var(--color-text-muted)]">
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
