"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";

const StarsCanvas = dynamic(
  () => import("@/components/ui/stars-canvas").then((mod) => ({ default: mod.StarsCanvas })),
  { ssr: false, loading: () => null }
);

interface InviterInfo {
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  total_tokens: number | null;
  global_rank: number | null;
  hidden?: boolean;
}

export default function JoinPage() {
  const router = useRouter();
  const params = useParams();
  const code = params.code as string;

  const [inviter, setInviter] = useState<InviterInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchInviter() {
      try {
        const res = await fetch(`/api/referral/${code}`);
        if (res.ok) {
          const data = await res.json();
          setInviter(data.inviter);
          // Store referral code in localStorage for sign-up
          localStorage.setItem("ccgather_referral_code", code);
        } else if (res.status === 404) {
          setError("Invalid invite link");
        } else {
          setError("Something went wrong");
        }
      } catch {
        setError("Failed to load invite");
      } finally {
        setLoading(false);
      }
    }

    if (code) {
      fetchInviter();
    }
  }, [code]);

  const formatTokens = (num: number): string => {
    if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1)}B`;
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
    if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
    return num.toLocaleString();
  };

  const handleJoin = () => {
    router.push("/sign-up");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-bg-primary)] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[var(--color-bg-primary)] flex flex-col items-center justify-center p-4">
        <StarsCanvas starCount={200} />
        <div className="relative z-10 text-center">
          <div className="text-6xl mb-4">😕</div>
          <h1 className="text-xl font-bold text-white mb-2">{error}</h1>
          <p className="text-[var(--color-text-muted)] mb-6">
            This invite link may have expired or is invalid.
          </p>
          <Link
            href="/sign-up"
            className="inline-flex items-center gap-2 px-6 py-3 bg-[var(--color-claude-coral)] hover:bg-[var(--color-claude-terracotta)] text-white font-medium rounded-xl transition-colors"
          >
            Sign up anyway
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] flex flex-col items-center justify-center p-4 sm:p-6">
      <StarsCanvas starCount={300} />

      <div className="relative z-10 w-full max-w-md">
        {/* Invite Card */}
        <div className="backdrop-blur-sm bg-white/[0.02] border border-white/[0.08] rounded-2xl p-6 sm:p-8 text-center">
          {/* Logo */}
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <Image
              src="/logos/logo.png"
              alt="CCgather Logo"
              width={40}
              height={40}
              className="rounded-lg"
            />
            <span className="text-xl font-bold text-white">CCgather</span>
          </Link>

          {/* Invitation Message */}
          <div className="mb-6">
            <p className="text-[var(--color-text-muted)] text-sm mb-2">
              You&apos;ve been invited by
            </p>

            {/* Inviter Profile */}
            <div className="flex items-center justify-center gap-3 mb-4">
              {inviter?.hidden ? (
                // Hidden profile - show minimal info
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[var(--color-section-bg)] to-[var(--color-bg-secondary)] flex items-center justify-center text-lg">
                  👤
                </div>
              ) : inviter?.avatar_url ? (
                <Image
                  src={inviter.avatar_url}
                  alt={inviter.username}
                  width={48}
                  height={48}
                  className="w-12 h-12 rounded-full object-cover"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-[#F7931E] flex items-center justify-center text-lg font-semibold text-white">
                  {inviter?.username.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="text-left">
                <h2 className="text-lg font-semibold text-white">
                  {inviter?.hidden
                    ? "A Passionate CCgather Member"
                    : inviter?.display_name || inviter?.username}
                </h2>
              </div>
            </div>

            {/* Inviter Stats - only show if not hidden and meaningful */}
            {!inviter?.hidden && (
              <div className="flex items-center justify-center gap-3 text-sm flex-wrap">
                {inviter?.global_rank && inviter.global_rank <= 500 ? (
                  <div className="px-3 py-1.5 bg-[var(--color-section-bg)] rounded-full">
                    <span className="text-[var(--color-text-muted)]">🌍 </span>
                    <span className="font-medium text-white">Rank #{inviter.global_rank}</span>
                  </div>
                ) : (
                  <div className="px-3 py-1.5 bg-[var(--color-section-bg)] rounded-full">
                    <span className="text-[var(--color-text-muted)]">🌱 </span>
                    <span className="font-medium text-white">Explorer</span>
                  </div>
                )}
                {inviter && (inviter.total_tokens || 0) >= 1000 ? (
                  <div className="px-3 py-1.5 bg-[var(--color-section-bg)] rounded-full">
                    <span className="text-[var(--color-text-muted)]">🔥 </span>
                    <span className="font-medium text-[var(--color-claude-coral)]">
                      {formatTokens(inviter.total_tokens || 0)}
                    </span>
                  </div>
                ) : (
                  <div className="px-3 py-1.5 bg-[var(--color-section-bg)] rounded-full">
                    <span className="font-medium text-[var(--color-text-secondary)]">
                      Active Member
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="border-t border-white/10 my-6" />

          {/* Call to Action */}
          <div className="mb-6">
            <h3 className="text-white font-medium mb-2">Join the Claude Code Leaderboard</h3>
            <p className="text-[var(--color-text-muted)] text-sm">
              Track your AI coding journey and compete globally
            </p>
          </div>

          {/* Join Button */}
          <button
            onClick={handleJoin}
            className="w-full flex items-center justify-center gap-3 px-4 py-3.5 bg-[var(--color-claude-coral)] hover:bg-[var(--color-claude-terracotta)] text-white font-medium rounded-xl transition-colors"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
            </svg>
            Join with GitHub
          </button>

          {/* Already have account */}
          <p className="mt-4 text-sm text-[var(--color-text-muted)]">
            Already have an account?{" "}
            <Link
              href="/sign-in"
              className="text-[var(--color-claude-coral)] hover:text-[var(--color-claude-peach)]"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
