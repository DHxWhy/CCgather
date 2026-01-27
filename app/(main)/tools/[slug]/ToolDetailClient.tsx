"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ExternalLink,
  Globe,
  Users,
  MessageSquare,
  Loader2,
  ChevronUp,
  Tag,
  ChevronRight,
} from "lucide-react";
import { useAuth } from "@clerk/nextjs";
import { cn } from "@/lib/utils";
import { ProfileSidePanel } from "@/components/leaderboard/ProfileSidePanel";
import type { ToolWithInteraction } from "@/lib/types/tools";
import type { LeaderboardUser } from "@/lib/types";
import { CATEGORY_META, PRICING_META, isNewTool, isHotTool } from "@/lib/types/tools";

// =====================================================
// Types
// =====================================================

interface DisplayUser extends LeaderboardUser {
  rank: number;
  isCurrentUser?: boolean;
}

interface ToolDetailClientProps {
  initialTool: ToolWithInteraction | null;
  slug: string;
}

// =====================================================
// Loading Skeleton
// =====================================================

function ToolDetailSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      {/* Header skeleton */}
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-lg bg-[var(--color-bg-elevated)]" />
        <div className="flex-1 space-y-2">
          <div className="h-6 w-48 bg-[var(--color-bg-elevated)] rounded" />
          <div className="h-4 w-full max-w-sm bg-[var(--color-bg-elevated)] rounded" />
          <div className="flex gap-2">
            <div className="h-6 w-24 bg-[var(--color-bg-elevated)] rounded" />
            <div className="h-6 w-20 bg-[var(--color-bg-elevated)] rounded" />
          </div>
        </div>
      </div>

      {/* Description skeleton */}
      <div className="p-5 rounded-xl bg-[var(--color-section-bg)] border border-[var(--border-default)] space-y-3">
        <div className="h-6 w-32 bg-[var(--color-bg-elevated)] rounded" />
        <div className="h-4 w-full bg-[var(--color-bg-elevated)] rounded" />
        <div className="h-4 w-3/4 bg-[var(--color-bg-elevated)] rounded" />
      </div>

      {/* Links skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="h-20 bg-[var(--color-bg-elevated)] rounded-xl" />
        <div className="h-20 bg-[var(--color-bg-elevated)] rounded-xl" />
      </div>
    </div>
  );
}

// =====================================================
// Main Component
// =====================================================

export default function ToolDetailClient({ initialTool, slug }: ToolDetailClientProps) {
  const router = useRouter();
  const { isSignedIn } = useAuth();

  // State
  const [tool, setTool] = useState<ToolWithInteraction | null>(initialTool);
  const [loading, setLoading] = useState(!initialTool);
  const [error, setError] = useState<string | null>(null);
  const [voted, setVoted] = useState(initialTool?.is_voted || false);
  const [voteCount, setVoteCount] = useState(initialTool?.upvote_count || 0);
  const [isVoting, setIsVoting] = useState(false);

  // Profile Panel State
  const [selectedUser, setSelectedUser] = useState<DisplayUser | null>(null);
  const [profilePanelOpen, setProfilePanelOpen] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(false);

  // =====================================================
  // Data Fetching (for client-side interactions like vote status)
  // =====================================================

  useEffect(() => {
    async function fetchTool() {
      if (!slug || initialTool) return;

      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/tools/${slug}`);

        if (res.status === 404) {
          setError("Tool not found");
          return;
        }

        if (!res.ok) {
          throw new Error("Failed to fetch tool");
        }

        const data = await res.json();
        setTool(data);
        setVoted(data.is_voted || false);
        setVoteCount(data.upvote_count || 0);
      } catch (err) {
        console.error("Error fetching tool:", err);
        setError("Failed to load tool");
      } finally {
        setLoading(false);
      }
    }

    fetchTool();
  }, [slug, initialTool]);

  // Refresh vote status when signed in
  useEffect(() => {
    async function refreshVoteStatus() {
      if (!isSignedIn || !slug) return;

      try {
        const res = await fetch(`/api/tools/${slug}`);
        if (res.ok) {
          const data = await res.json();
          setVoted(data.is_voted || false);
          setVoteCount(data.upvote_count || 0);
        }
      } catch {
        // Ignore errors
      }
    }

    if (initialTool) {
      refreshVoteStatus();
    }
  }, [isSignedIn, slug, initialTool]);

  // =====================================================
  // Handlers
  // =====================================================

  const handleVote = async () => {
    if (!isSignedIn) {
      router.push(`/sign-in?redirect_url=/tools/${slug}`);
      return;
    }

    if (isVoting || !tool) return;

    setIsVoting(true);
    try {
      const res = await fetch(`/api/tools/vote/${tool.id}`, {
        method: "POST",
      });

      if (res.ok) {
        const data = await res.json();
        setVoted(data.voted);
        setVoteCount(data.new_count);
      }
    } catch (err) {
      console.error("Vote error:", err);
    } finally {
      setIsVoting(false);
    }
  };

  const handleUserClick = async (userId: string) => {
    if (loadingProfile) return;

    setLoadingProfile(true);
    setProfilePanelOpen(true);

    try {
      const res = await fetch(`/api/users/${userId}/profile`);
      if (!res.ok) throw new Error("Failed to fetch user profile");

      const data = await res.json();
      if (data.user) {
        setSelectedUser({
          ...data.user,
          rank: data.user.global_rank || 0,
        });
      }
    } catch (err) {
      console.error("Error fetching user profile:", err);
      setProfilePanelOpen(false);
    } finally {
      setLoadingProfile(false);
    }
  };

  const handleCloseProfilePanel = () => {
    setProfilePanelOpen(false);
    setTimeout(() => setSelectedUser(null), 300);
  };

  // =====================================================
  // Render
  // =====================================================

  if (loading) {
    return (
      <article className="mx-auto max-w-4xl px-4 lg:px-6 py-8 md:py-10">
        <Link
          href="/tools"
          className="inline-flex items-center gap-2 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors mb-6 text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Tools
        </Link>
        <ToolDetailSkeleton />
      </article>
    );
  }

  if (error || !tool) {
    return (
      <article className="mx-auto max-w-4xl px-4 lg:px-6 py-8 md:py-10">
        <Link
          href="/tools"
          className="inline-flex items-center gap-2 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors mb-6 text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Tools
        </Link>
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <span className="text-6xl mb-4">🔍</span>
          <h1 className="text-2xl md:text-3xl font-bold text-[var(--color-text-primary)] mb-2">
            Tool Not Found
          </h1>
          <p className="text-[var(--color-text-secondary)] mb-6">
            The tool you&apos;re looking for doesn&apos;t exist or has been removed.
          </p>
          <Link
            href="/tools"
            className="px-4 py-2 rounded-lg bg-[var(--color-claude-coral)] text-[var(--color-text-primary)] hover:bg-[var(--color-claude-rust)] transition-colors"
          >
            Browse Tools
          </Link>
        </div>
      </article>
    );
  }

  const categoryMeta = CATEGORY_META[tool.category];
  const pricingMeta = PRICING_META[tool.pricing_type];
  const isNew = isNewTool(tool.created_at);
  const isHot = isHotTool(tool.upvote_count, tool.created_at);
  const isFeatured = tool.status === "featured";

  return (
    <>
      <article className="mx-auto max-w-4xl px-4 lg:px-6 py-8 md:py-10">
        {/* Back Navigation */}
        <Link
          href="/tools"
          className="inline-flex items-center gap-2 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors mb-6 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 focus-visible:ring-offset-black rounded"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Tools
        </Link>

        {/* Header Section */}
        <header className="mb-8">
          <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-6">
            {/* Logo */}
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex-shrink-0"
            >
              {tool.logo_url ? (
                <Image
                  src={tool.logo_url}
                  alt={tool.name}
                  width={40}
                  height={40}
                  className="rounded-lg object-cover"
                  sizes="40px"
                  quality={60}
                />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-[var(--color-bg-elevated)] flex items-center justify-center text-xl">
                  {categoryMeta.emoji}
                </div>
              )}
            </motion.div>

            {/* Title & Meta */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  {/* Title */}
                  <h1 className="text-lg md:text-xl font-bold text-[var(--color-text-primary)] mb-2 leading-tight">
                    {tool.name}
                  </h1>
                  {/* Tagline */}
                  <p className="text-sm text-[var(--color-text-secondary)] mb-3">{tool.tagline}</p>
                </div>

                {/* Vote Button - Desktop */}
                <motion.button
                  onClick={handleVote}
                  disabled={isVoting}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={cn(
                    "hidden sm:flex flex-col items-center gap-1 px-5 py-3 rounded-lg border transition-all",
                    voted
                      ? "bg-[var(--color-claude-coral)]/20 border-[var(--color-claude-coral)]/50 text-[var(--color-claude-coral)]"
                      : "bg-[var(--color-bg-card)] border-[var(--border-default)] text-[var(--color-text-secondary)] hover:border-[var(--color-claude-coral)]/30"
                  )}
                >
                  {isVoting ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <ChevronUp
                      className={cn("w-5 h-5", voted && "text-[var(--color-claude-coral)]")}
                    />
                  )}
                  <span className="text-xl font-bold">{voteCount}</span>
                </motion.button>
              </div>

              {/* Badges */}
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium"
                  style={{
                    backgroundColor: `var(--color-cat-${tool.category}, rgba(139, 92, 246, 0.2))`,
                  }}
                >
                  {categoryMeta.emoji} {categoryMeta.label}
                </span>

                <span
                  className={cn(
                    "px-2.5 py-1 rounded-md font-medium",
                    pricingMeta.color === "green" && "bg-green-500/20 text-green-400",
                    pricingMeta.color === "blue" && "bg-blue-500/20 text-blue-400",
                    pricingMeta.color === "purple" && "bg-purple-500/20 text-purple-400",
                    pricingMeta.color === "cyan" && "bg-cyan-500/20 text-cyan-400"
                  )}
                >
                  {pricingMeta.label}
                </span>

                {isFeatured && (
                  <span className="px-2.5 py-1 rounded-md font-medium bg-gradient-to-r from-[var(--color-claude-coral)]/20 to-purple-500/20 text-[var(--color-claude-coral)]">
                    ⭐ Featured
                  </span>
                )}
                {isHot && !isFeatured && (
                  <span className="px-2.5 py-1 rounded-md font-medium bg-orange-500/20 text-orange-400">
                    🔥 Hot
                  </span>
                )}
                {isNew && !isHot && !isFeatured && (
                  <span className="px-2.5 py-1 rounded-md font-medium bg-green-500/20 text-green-400">
                    NEW
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Vote Button - Mobile */}
          <motion.button
            onClick={handleVote}
            disabled={isVoting}
            whileTap={{ scale: 0.98 }}
            className={cn(
              "sm:hidden w-full mt-4 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border transition-all",
              voted
                ? "bg-[var(--color-claude-coral)]/20 border-[var(--color-claude-coral)]/50 text-[var(--color-claude-coral)]"
                : "bg-[var(--color-bg-card)] border-[var(--border-default)] text-[var(--color-text-secondary)]"
            )}
          >
            {isVoting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <ChevronUp className={cn("w-5 h-5", voted && "text-[var(--color-claude-coral)]")} />
                <span className="font-bold">{voteCount} Upvotes</span>
              </>
            )}
          </motion.button>
        </header>

        {/* About / Description */}
        {tool.description && (
          <section className="mb-8 p-5 rounded-xl bg-[var(--color-section-bg)] border border-[var(--border-default)]">
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
              📝 About
            </h2>
            <p className="text-[15px] text-[var(--color-text-secondary)] leading-relaxed whitespace-pre-wrap">
              {tool.description}
            </p>
          </section>
        )}

        {/* Tags */}
        {tool.tags && tool.tags.length > 0 && (
          <section className="mb-8">
            <div className="flex items-center gap-2 flex-wrap">
              <Tag className="w-4 h-4 text-[var(--color-text-muted)]" />
              {tool.tags.map((tag, i) => (
                <span
                  key={i}
                  className="px-2.5 py-1 rounded-md text-sm bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)]"
                >
                  {tag}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Quick Links */}
        <section className="mb-8 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Website Link */}
          <a
            href={tool.website_url}
            target="_blank"
            rel="noopener noreferrer"
            className="group p-4 rounded-xl bg-[var(--color-bg-card)] border border-[var(--border-default)] hover:border-[var(--color-claude-coral)]/30 transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[var(--color-bg-elevated)] flex items-center justify-center">
                <Globe className="w-5 h-5 text-[var(--color-text-muted)]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-[var(--color-text-primary)] group-hover:text-[var(--color-claude-coral)] transition-colors">
                  Visit Website
                </div>
                <div className="text-xs text-[var(--color-text-muted)] truncate">
                  {new URL(tool.website_url).hostname}
                </div>
              </div>
              <ExternalLink className="w-4 h-4 text-[var(--color-text-muted)] group-hover:text-[var(--color-claude-coral)] transition-colors" />
            </div>
          </a>

          {/* Stats Card */}
          <div className="p-4 rounded-xl bg-[var(--color-bg-card)] border border-[var(--border-default)]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[var(--color-bg-elevated)] flex items-center justify-center">
                <Users className="w-5 h-5 text-[var(--color-text-muted)]" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium text-[var(--color-text-primary)]">
                  Statistics
                </div>
                <div className="text-xs text-[var(--color-text-muted)]">
                  {voteCount} votes • Added{" "}
                  {new Date(tool.created_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Suggested By */}
        {tool.submitter && (
          <section className="mb-8">
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
              👤 Suggested by
            </h2>
            <button
              onClick={() => handleUserClick(tool.submitter!.id)}
              className="w-full p-4 rounded-xl bg-[var(--color-bg-card)] border border-[var(--border-default)] hover:border-[var(--color-claude-coral)]/30 transition-all text-left group"
            >
              <div className="flex items-center gap-3">
                {tool.submitter.avatar_url ? (
                  <Image
                    src={tool.submitter.avatar_url}
                    alt={tool.submitter.username}
                    width={40}
                    height={40}
                    className="rounded-full"
                    sizes="40px"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-[var(--color-bg-elevated)] flex items-center justify-center text-sm font-medium text-[var(--color-text-primary)]">
                    {tool.submitter.username.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex-1">
                  <div className="text-sm font-medium text-[var(--color-text-primary)] group-hover:text-[var(--color-claude-coral)] transition-colors">
                    @{tool.submitter.username}
                  </div>
                  <div className="text-xs text-[var(--color-text-muted)]">
                    Level {tool.submitter.current_level}
                    {tool.submitter.global_rank && ` • Global #${tool.submitter.global_rank}`}
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-[var(--color-text-muted)] opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </button>
          </section>
        )}

        {/* Voters */}
        {tool.voters && tool.voters.length > 0 && (
          <section className="mb-8">
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
              🗳️ Voters ({tool.voters.length})
            </h2>
            <div className="p-4 rounded-xl bg-[var(--color-bg-card)] border border-[var(--border-default)]">
              <div className="flex flex-wrap gap-2">
                {tool.voters.map((voter) => (
                  <button
                    key={voter.user_id}
                    onClick={() => handleUserClick(voter.user_id)}
                    className="group flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--color-bg-elevated)] hover:bg-[var(--color-bg-card-hover)] transition-colors"
                    title={`@${voter.username}`}
                  >
                    {voter.avatar_url ? (
                      <Image
                        src={voter.avatar_url}
                        alt={voter.username}
                        width={24}
                        height={24}
                        className="rounded-full"
                        sizes="24px"
                      />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-[var(--color-bg-card)] flex items-center justify-center text-[10px] font-medium text-[var(--color-text-primary)]">
                        {voter.username.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className="text-xs text-[var(--color-text-secondary)] group-hover:text-[var(--color-claude-coral)] transition-colors">
                      @{voter.username}
                    </span>
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-[var(--color-text-muted)] mt-3">
                Click on a voter to view their profile
              </p>
            </div>
          </section>
        )}

        {/* Top Comment */}
        {tool.top_comment && (
          <section className="mb-8">
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4 flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              Top Comment
            </h2>
            <div className="p-4 rounded-xl bg-[var(--color-bg-card)] border border-[var(--border-default)]">
              <p className="text-[15px] text-[var(--color-text-secondary)] italic mb-3">
                &quot;{tool.top_comment.comment}&quot;
              </p>
              <div className="flex items-center gap-2">
                {tool.top_comment.avatar_url ? (
                  <Image
                    src={tool.top_comment.avatar_url}
                    alt={tool.top_comment.username}
                    width={20}
                    height={20}
                    className="rounded-full"
                    sizes="20px"
                  />
                ) : (
                  <div className="w-5 h-5 rounded-full bg-[var(--color-bg-elevated)] flex items-center justify-center text-[9px] text-[var(--color-text-primary)]">
                    {tool.top_comment.username.charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="text-xs text-[var(--color-text-muted)]">
                  @{tool.top_comment.username}
                </span>
              </div>
            </div>
          </section>
        )}

        {/* Footer */}
        <footer className="pt-6 border-t border-[var(--border-default)]">
          <p className="text-[11px] text-[var(--color-text-muted)] text-center leading-relaxed">
            Tool information is provided by the community.{" "}
            <a
              href={tool.website_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] underline underline-offset-2"
            >
              Visit official website
            </a>{" "}
            for accurate details.
          </p>
        </footer>
      </article>

      {/* Profile Side Panel */}
      <ProfileSidePanel
        user={selectedUser}
        isOpen={profilePanelOpen}
        onClose={handleCloseProfilePanel}
        periodFilter="all"
        scopeFilter="global"
      />

      {/* Loading Overlay for Profile */}
      {loadingProfile && profilePanelOpen && !selectedUser && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/20">
          <div className="bg-[var(--color-bg-card)] rounded-lg p-4 shadow-xl flex items-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-[var(--color-claude-coral)]" />
            <span className="text-sm text-[var(--color-text-secondary)]">Loading profile...</span>
          </div>
        </div>
      )}
    </>
  );
}
