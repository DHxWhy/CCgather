"use client";

import Link from "next/link";
import Image from "next/image";
import { SignUp } from "@clerk/nextjs";
import { AuthLeftPanel } from "@/components/auth/AuthLeftPanel";

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen bg-[var(--color-bg-primary)]">
      {/* Left Panel - Brand & Visual (hidden on mobile/tablet) */}
      <div className="hidden lg:flex lg:w-[55%] relative">
        <AuthLeftPanel />
      </div>

      {/* Right Panel - Sign Up Form */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 lg:px-12">
        <div className="w-full max-w-sm">
          {/* Mobile/Tablet Header */}
          <div className="lg:hidden text-center mb-8">
            <Link href="/" className="inline-flex items-center gap-2 mb-6">
              <Image
                src="/logo.png"
                alt="CCgather Logo"
                width={40}
                height={40}
                className="rounded-lg"
              />
              <span className="text-xl font-bold text-white">CCgather</span>
            </Link>
            <p className="text-sm text-[var(--color-text-muted)]">
              Your AI coding journey starts here
            </p>
          </div>

          {/* Desktop Header */}
          <div className="hidden lg:block mb-8">
            <Link href="/" className="inline-flex items-center gap-2 mb-6">
              <Image
                src="/logo.png"
                alt="CCgather Logo"
                width={36}
                height={36}
                className="rounded-lg"
              />
              <span className="text-lg font-bold text-white">CCgather</span>
            </Link>
            <h1 className="text-2xl font-bold text-white mb-2">Create your account</h1>
            <p className="text-[var(--color-text-muted)]">
              Join the global Claude Code leaderboard
            </p>
          </div>

          {/* Clerk Sign Up */}
          <SignUp
            appearance={{
              elements: {
                rootBox: "w-full",
                card: "bg-transparent shadow-none p-0 w-full",
                headerTitle: "hidden",
                headerSubtitle: "hidden",
                socialButtonsBlockButton: `
                  bg-white/5
                  border border-white/10
                  text-white
                  hover:bg-white/10
                  transition-all
                  rounded-xl
                  py-3
                  font-medium
                `,
                socialButtonsBlockButtonText: "text-white font-medium",
                socialButtonsProviderIcon: "w-5 h-5",
                dividerLine: "bg-white/10",
                dividerText: "text-[var(--color-text-muted)] text-xs uppercase",
                formFieldInput: `
                  bg-[var(--color-bg-card)]
                  border-white/10
                  text-white
                  rounded-xl
                  py-3
                  focus:border-[var(--color-claude-coral)]
                  focus:ring-1
                  focus:ring-[var(--color-claude-coral)]/20
                  placeholder:text-[var(--color-text-muted)]
                `,
                formFieldLabel: "text-[var(--color-text-secondary)] text-sm mb-1.5",
                formButtonPrimary: `
                  bg-[var(--color-claude-coral)]
                  hover:opacity-90
                  transition-all
                  rounded-xl
                  py-3
                  font-semibold
                `,
                footerActionText: "text-[var(--color-text-muted)]",
                footerActionLink:
                  "text-[var(--color-claude-coral)] hover:text-[var(--color-claude-peach)] font-medium",
                identityPreviewText: "text-white",
                identityPreviewEditButton: "text-[var(--color-claude-coral)]",
                formFieldInputShowPasswordButton: "text-[var(--color-text-muted)]",
                alert: "bg-red-500/10 border-red-500/20 text-red-400",
                alertText: "text-red-400",
              },
              layout: {
                socialButtonsPlacement: "top",
                socialButtonsVariant: "blockButton",
              },
            }}
          />

          {/* Footer */}
          <div className="mt-8 pt-6 border-t border-white/10">
            <p className="text-xs text-[var(--color-text-muted)] text-center">
              By signing up, you agree to our{" "}
              <Link
                href="/terms"
                className="text-[var(--color-claude-coral)] hover:underline"
              >
                Terms
              </Link>{" "}
              and{" "}
              <Link
                href="/privacy"
                className="text-[var(--color-claude-coral)] hover:underline"
              >
                Privacy Policy
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
