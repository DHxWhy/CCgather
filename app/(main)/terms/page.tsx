import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Terms of Service for CCgather - the global leaderboard for Claude Code developers.",
};

export default function TermsPage() {
  const lastUpdated = "January 8, 2026";

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <p className="text-xs text-[var(--color-claude-coral)] font-medium tracking-wide uppercase mb-3">
          Legal
        </p>
        <h1 className="text-2xl md:text-3xl font-semibold text-[var(--color-text-primary)] mb-2">
          Terms of Service
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
              Welcome to CCgather (&quot;Service&quot;), operated by CCgather (&quot;we&quot;,
              &quot;us&quot;, or &quot;our&quot;). By accessing or using our Service at
              ccgather.com, you agree to be bound by these Terms of Service.
            </p>
            <p>
              CCgather is a global leaderboard platform that allows Claude Code developers to track
              their usage statistics and compete with other developers worldwide.
            </p>
          </div>
        </section>

        {/* Eligibility */}
        <section className="glass rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
            2. Eligibility
          </h2>
          <div className="text-sm text-[var(--color-text-secondary)] space-y-3">
            <p>
              You must be at least 13 years old to use this Service. If you are under 18, you must
              have your parent or guardian&apos;s permission to use the Service.
            </p>
            <p>
              By using the Service, you represent that you meet these eligibility requirements and
              have the legal capacity to enter into these Terms.
            </p>
          </div>
        </section>

        {/* Account */}
        <section className="glass rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
            3. Account Registration
          </h2>
          <div className="text-sm text-[var(--color-text-secondary)] space-y-3">
            <p>
              To use certain features of the Service, you must create an account using GitHub OAuth
              authentication. You are responsible for:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li>Maintaining the security of your GitHub account</li>
              <li>All activities that occur under your account</li>
              <li>Ensuring your profile information is accurate</li>
              <li>Notifying us immediately of any unauthorized use</li>
            </ul>
          </div>
        </section>

        {/* Acceptable Use */}
        <section className="glass rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
            4. Acceptable Use
          </h2>
          <div className="text-sm text-[var(--color-text-secondary)] space-y-3">
            <p>You agree not to:</p>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li>Submit false or manipulated usage data</li>
              <li>
                Attempt to gain unauthorized access to the Service or other users&apos; accounts
              </li>
              <li>
                Use automated tools to submit data or access the Service in ways that exceed normal
                usage
              </li>
              <li>Interfere with or disrupt the Service or its infrastructure</li>
              <li>Violate any applicable laws or regulations</li>
              <li>Impersonate another person or entity</li>
              <li>Engage in any activity that could harm other users or the Service</li>
            </ul>
          </div>
        </section>

        {/* Data Submission */}
        <section className="glass rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
            5. Data Submission
          </h2>
          <div className="text-sm text-[var(--color-text-secondary)] space-y-3">
            <p>
              The Service allows you to submit your Claude Code usage statistics through our CLI
              tool or web interface. By submitting data, you:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li>Confirm that the data accurately reflects your actual usage</li>
              <li>Grant us permission to display your data on public leaderboards</li>
              <li>Understand that submitted data will be visible to other users</li>
              <li>Accept that we may use aggregated, anonymized data for analytics</li>
            </ul>
          </div>
        </section>

        {/* Intellectual Property */}
        <section className="glass rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
            6. Intellectual Property
          </h2>
          <div className="text-sm text-[var(--color-text-secondary)] space-y-3">
            <p>
              The Service, including its design, features, and content (excluding user-submitted
              data), is owned by CCgather and protected by intellectual property laws.
            </p>
            <p>
              &quot;Claude Code&quot; is a trademark of Anthropic. CCgather is not affiliated with,
              endorsed by, or sponsored by Anthropic.
            </p>
          </div>
        </section>

        {/* Disclaimer */}
        <section className="glass rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
            7. Disclaimer of Warranties
          </h2>
          <div className="text-sm text-[var(--color-text-secondary)] space-y-3">
            <p>
              THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT
              WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED. WE DO NOT WARRANT THAT THE SERVICE
              WILL BE UNINTERRUPTED, ERROR-FREE, OR SECURE.
            </p>
            <p>
              We are not responsible for the accuracy of user-submitted data or any decisions made
              based on leaderboard rankings.
            </p>
          </div>
        </section>

        {/* Limitation of Liability */}
        <section className="glass rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
            8. Limitation of Liability
          </h2>
          <div className="text-sm text-[var(--color-text-secondary)] space-y-3">
            <p>
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, CCGATHER SHALL NOT BE LIABLE FOR ANY INDIRECT,
              INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING OUT OF OR RELATING TO
              YOUR USE OF THE SERVICE.
            </p>
          </div>
        </section>

        {/* Termination */}
        <section className="glass rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
            9. Termination
          </h2>
          <div className="text-sm text-[var(--color-text-secondary)] space-y-3">
            <p>
              We reserve the right to suspend or terminate your account at any time for violation of
              these Terms or for any other reason at our discretion.
            </p>
            <p>
              You may delete your account at any time through your account settings. Upon
              termination, your data will be handled in accordance with our Privacy Policy.
            </p>
          </div>
        </section>

        {/* Governing Law */}
        <section className="glass rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
            10. Governing Law
          </h2>
          <div className="text-sm text-[var(--color-text-secondary)] space-y-3">
            <p>
              These Terms shall be governed by and construed in accordance with the laws of the
              Republic of Korea, without regard to its conflict of law provisions.
            </p>
            <p>
              For users in the European Union, nothing in these Terms affects your rights under
              mandatory consumer protection laws in your country of residence.
            </p>
          </div>
        </section>

        {/* Changes */}
        <section className="glass rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
            11. Changes to Terms
          </h2>
          <div className="text-sm text-[var(--color-text-secondary)] space-y-3">
            <p>
              We may update these Terms from time to time. We will notify you of any material
              changes by posting the new Terms on this page and updating the &quot;Last
              updated&quot; date.
            </p>
            <p>
              Your continued use of the Service after any changes constitutes acceptance of the new
              Terms.
            </p>
          </div>
        </section>

        {/* Contact */}
        <section className="glass rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
            12. Contact Us
          </h2>
          <div className="text-sm text-[var(--color-text-secondary)] space-y-3">
            <p>If you have any questions about these Terms, please contact us at:</p>
            <p className="text-[var(--color-claude-coral)]">support@ccgather.com</p>
          </div>
        </section>

        {/* Footer Links */}
        <div className="flex items-center justify-center gap-4 pt-4 text-sm text-[var(--color-text-muted)]">
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
