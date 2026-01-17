"use client";

import { useState, useEffect } from "react";
import { X as CloseIcon } from "lucide-react";
import { useSignIn, useUser } from "@clerk/nextjs";

type PromptType = "social_link" | "profile_limit";

interface LoginPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: PromptType;
  onContinueAsGuest?: () => void; // Only for social_link type
}

const PROMPT_CONTENT: Record<
  PromptType,
  {
    icon: string;
    title: string;
    description: string;
    showGuestOption: boolean;
  }
> = {
  social_link: {
    icon: "🔗",
    title: "Want to check their social profile?",
    description: "Sign in to view social links and create your own developer profile!",
    showGuestOption: true,
  },
  profile_limit: {
    icon: "👀",
    title: "Want to explore more developers?",
    description:
      "Sign up for free to view unlimited profiles! Connect your CLI to join the leaderboard.",
    showGuestOption: false,
  },
};

export function LoginPromptModal({
  isOpen,
  onClose,
  type,
  onContinueAsGuest,
}: LoginPromptModalProps) {
  const { signIn, isLoaded } = useSignIn();
  const { isSignedIn } = useUser();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const content = PROMPT_CONTENT[type];

  // If already signed in, close modal
  useEffect(() => {
    if (isOpen && isSignedIn) {
      onClose();
    }
  }, [isOpen, isSignedIn, onClose]);

  if (!isOpen) return null;

  const handleOAuthSignIn = async (provider: "oauth_github" | "oauth_google") => {
    setError(null);

    // Check if already signed in
    if (isSignedIn) {
      onClose();
      return;
    }

    if (!isLoaded) {
      setError("Loading... Please wait.");
      return;
    }

    if (!signIn) {
      setError("Authentication unavailable. Please refresh.");
      return;
    }

    setIsLoading(true);
    try {
      await signIn.authenticateWithRedirect({
        strategy: provider,
        redirectUrl: "/sso-callback",
        redirectUrlComplete: window.location.pathname,
      });
    } catch (err: unknown) {
      console.error("OAuth sign in error:", err);
      // Handle "already signed in" error
      const errorMessage = err instanceof Error ? err.message : String(err);
      if (errorMessage.includes("already signed in")) {
        onClose();
        return;
      }
      setError("Connection failed. Please try again.");
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-[61] flex items-center justify-center p-4">
        <div
          className="relative w-full max-w-sm bg-[var(--color-bg-secondary)] border border-[var(--border-default)] rounded-2xl shadow-2xl animate-in zoom-in-95 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-white/10 transition-colors text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
          >
            <CloseIcon className="w-4 h-4" />
          </button>

          {/* Content */}
          <div className="p-6 pt-8 text-center">
            <div className="text-4xl mb-3">{content.icon}</div>
            <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
              {content.title}
            </h3>
            <p className="text-sm text-[var(--color-text-secondary)] mb-6">{content.description}</p>

            {/* Error Message */}
            {error && (
              <div className="mb-4 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs text-center">
                {error}
              </div>
            )}

            {/* OAuth Buttons */}
            <div className="space-y-2">
              <button
                onClick={() => handleOAuthSignIn("oauth_github")}
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#24292e] hover:bg-[#2f363d] text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading || !isLoaded ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                  </svg>
                )}
                {isLoading ? "Connecting..." : !isLoaded ? "Loading..." : "Continue with GitHub"}
              </button>
            </div>

            {/* Guest option */}
            {content.showGuestOption && onContinueAsGuest && (
              <button
                onClick={onContinueAsGuest}
                className="mt-4 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
              >
                Continue without signing in →
              </button>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-3 border-t border-[var(--border-default)] bg-white/[0.02] rounded-b-2xl">
            <p className="text-[10px] text-[var(--color-text-muted)] text-center">
              By signing up, you agree to our{" "}
              <a href="/terms" className="underline hover:text-[var(--color-text-secondary)]">
                Terms of Service
              </a>{" "}
              and{" "}
              <a href="/privacy" className="underline hover:text-[var(--color-text-secondary)]">
                Privacy Policy
              </a>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

export default LoginPromptModal;
