"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { FlagIcon } from "@/components/ui/FlagIcon";
import { getLevelByNumber } from "@/lib/constants/levels";

interface LeaderboardUser {
  rank: number;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  tokens: number;
  cost: number;
  country: string;
  level: number;
  levelName: string;
  levelIcon: string;
  globalRank: number;
  countryRank: number;
}

interface ApiUser {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  country_code: string | null;
  current_level: number;
  global_rank: number;
  country_rank: number;
  total_tokens: number;
  total_cost: number;
  ccplan: string | null;
}

function formatNumber(num: number): string {
  if (num >= 1e12) return `${(num / 1e12).toFixed(1)}T`;
  if (num >= 1e9) return `${(num / 1e9).toFixed(1)}B`;
  if (num >= 1e6) return `${(num / 1e6).toFixed(1)}M`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(1)}K`;
  return num.toString();
}

function formatCost(cost: number): string {
  if (cost >= 1e6) return `$${(cost / 1e6).toFixed(1)}M`;
  if (cost >= 1e3) return `$${(cost / 1e3).toFixed(1)}K`;
  return `$${cost.toFixed(0)}`;
}

const RANK_STYLES = {
  1: { emoji: "🥇", bg: "bg-amber-500/10", border: "border-amber-500/30" },
  2: { emoji: "🥈", bg: "bg-slate-400/10", border: "border-slate-400/30" },
  3: { emoji: "🥉", bg: "bg-orange-600/10", border: "border-orange-600/30" },
  4: { emoji: "#4", bg: "bg-white/5", border: "border-[var(--border-default)]" },
  5: { emoji: "#5", bg: "bg-white/5", border: "border-[var(--border-default)]" },
} as const;

// Get anime-style avatar URL using DiceBear (adventurer style - more anime-like)
function getAvatarUrl(username: string, avatarUrl: string | null): string {
  if (avatarUrl) return avatarUrl;
  return `https://api.dicebear.com/7.x/adventurer/svg?seed=${username}&backgroundColor=transparent`;
}

// Mini line chart component
function MiniLineChart({ data }: { data: number[] }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const width = 100;
  const height = 32;
  const padding = 2;

  const points = data.map((value, i) => ({
    x: padding + (i / (data.length - 1)) * (width - padding * 2),
    y: padding + (1 - (value - min) / range) * (height - padding * 2),
  }));

  const pathD = points.reduce((acc, point, i) => {
    if (i === 0) return `M ${point.x} ${point.y}`;
    return `${acc} L ${point.x} ${point.y}`;
  }, "");

  const areaD = `${pathD} L ${points[points.length - 1]?.x ?? 0} ${height - padding} L ${padding} ${height - padding} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-8">
      <line
        x1={padding}
        y1={height / 2}
        x2={width - padding}
        y2={height / 2}
        stroke="var(--border-default)"
        strokeWidth="0.5"
        strokeDasharray="2,2"
      />
      <path d={areaD} fill="var(--color-claude-coral)" fillOpacity="0.1" />
      <path
        d={pathD}
        fill="none"
        stroke="var(--color-claude-coral)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Side Panel Component
function ProfilePanel({ user }: { user: LeaderboardUser | null }) {
  if (!user) {
    return (
      <div className="h-full flex items-center justify-center text-[var(--color-text-muted)] text-sm">
        <div className="text-center">
          <div className="text-3xl mb-2">👆</div>
          <p>Click a user to see details</p>
        </div>
      </div>
    );
  }

  const levelInfo = getLevelByNumber(user.level);
  const nextLevelInfo = user.level < 10 ? getLevelByNumber(user.level + 1) : null;

  // Calculate progress percentage (simplified)
  const progressPercent = 65 + (5 - user.rank) * 7;

  return (
    <motion.div
      key={user.username}
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3 }}
      className="p-4 flex flex-col gap-3"
    >
      {/* 1. Profile Header */}
      <div className="flex items-center gap-3">
        <img
          src={getAvatarUrl(user.username, user.avatarUrl)}
          alt={user.displayName}
          className="w-12 h-12 rounded-full bg-[var(--color-bg-secondary)]"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-[var(--color-text-primary)] truncate">
              {user.displayName}
            </h3>
            <span
              className="px-1.5 py-0.5 rounded text-[9px] font-medium"
              style={{ backgroundColor: "rgba(218, 119, 86, 0.2)", color: "#DA7756" }}
            >
              {levelInfo.icon} Lv.{user.level}
            </span>
          </div>
          <p className="text-xs text-[var(--color-text-muted)] flex items-center gap-1.5 mt-0.5">
            <FlagIcon countryCode={user.country} size="xs" />
            <span>@{user.username}</span>
          </p>
        </div>
      </div>

      {/* 2. Level Progress */}
      <div className="p-3 bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--border-default)]">
        <div className="flex items-center justify-between text-[10px] mb-1.5">
          <span className="text-[var(--color-text-secondary)] flex items-center gap-1">
            <span>{levelInfo.icon}</span> {levelInfo.name} (Lv.{user.level})
          </span>
          {nextLevelInfo && (
            <span className="text-[var(--color-text-muted)]">
              → {nextLevelInfo.icon} {nextLevelInfo.name}
            </span>
          )}
        </div>
        <div className="h-2.5 bg-white/10 rounded-full overflow-hidden border border-[var(--border-default)]">
          <div
            className="h-full bg-[var(--color-claude-coral)] rounded-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="text-[9px] text-[var(--color-text-muted)] mt-1.5">
          Current Range:{" "}
          <span className="text-[var(--color-text-secondary)]">
            {formatNumber(levelInfo.minTokens)} ~{" "}
            {levelInfo.maxTokens === Infinity ? "∞" : formatNumber(levelInfo.maxTokens)}
          </span>{" "}
          ({levelInfo.name})
        </div>
      </div>

      {/* 3. Stats Grid */}
      <div className="grid grid-cols-2 gap-2">
        <div className="p-3 bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--border-default)]">
          <div className="text-[10px] text-[var(--color-text-muted)] mb-1 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span> Global Rank
          </div>
          <div className="text-xl font-semibold text-[var(--color-text-primary)]">
            #{user.globalRank}
          </div>
        </div>
        <div className="p-3 bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--border-default)]">
          <div className="text-[10px] text-[var(--color-text-muted)] mb-1">All Time Cost $</div>
          <div className="text-xl font-semibold text-amber-500">{user.cost.toLocaleString()}</div>
        </div>
        <div className="p-3 bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--border-default)] opacity-70">
          <div className="text-[10px] text-[var(--color-text-muted)] mb-1 flex items-center gap-1">
            <FlagIcon countryCode={user.country} size="xs" />
            <span>Country Rank</span>
          </div>
          <div className="text-xl font-semibold text-[var(--color-text-primary)]">
            #{user.countryRank}
          </div>
        </div>
        <div className="p-3 bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--border-default)] opacity-70">
          <div className="text-[10px] text-[var(--color-text-muted)] mb-1">All Time Tokens</div>
          <div className="text-lg font-semibold text-[var(--color-claude-coral)]">
            {formatNumber(user.tokens)}
          </div>
        </div>
      </div>

      {/* 4. Usage History placeholder */}
      <div className="p-3 bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--border-default)] opacity-40">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide flex items-center gap-1">
            <span>📈</span> Usage History
          </span>
          <span className="text-[9px] text-[var(--color-text-muted)]">All Time</span>
        </div>
        <MiniLineChart data={[30, 45, 25, 60, 80, 55, 70, 90, 65, 85, 75, 95]} />
        <div className="text-[10px] text-[var(--color-text-secondary)] mt-2 pt-2 border-t border-[var(--border-default)] text-center">
          Avg Daily:{" "}
          <span className="font-medium text-[var(--color-claude-coral)]">
            {formatNumber(Math.round(user.tokens / 30))}
          </span>{" "}
          tokens
        </div>
      </div>
    </motion.div>
  );
}

// Pioneer placeholder component when no users yet
function PioneerPlaceholder() {
  return (
    <section className="py-20 px-4">
      <div className="max-w-[1000px] mx-auto">
        <div className="text-center mb-10">
          <h2 className="text-2xl md:text-3xl font-bold text-[var(--color-text-primary)] mb-2">
            Claude Code Rankings
          </h2>
          <p className="text-sm text-[var(--color-claude-coral)] font-medium mb-3">
            Global or by country
          </p>
          <p className="text-sm text-[var(--color-text-muted)]">
            See who&apos;s going all in on Claude Code.
          </p>
        </div>

        <div className="glass rounded-lg border border-[var(--border-default)] p-8 text-center">
          <div className="text-6xl mb-4">🚀</div>
          <h3 className="text-xl font-semibold text-[var(--color-text-primary)] mb-2">
            Be the First Pioneer!
          </h3>
          <p className="text-[var(--color-text-muted)] mb-6 max-w-md mx-auto">
            The leaderboard is waiting for its first champions. Submit your Claude Code usage and
            claim the #1 spot!
          </p>
          <Link
            href="/leaderboard"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--color-claude-coral)] text-white text-sm font-semibold hover:opacity-90 transition-all"
          >
            Join the Leaderboard
            <span>→</span>
          </Link>
        </div>
      </div>
    </section>
  );
}

export function LeaderboardPreview() {
  const [users, setUsers] = useState<LeaderboardUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<LeaderboardUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchLeaderboard() {
      try {
        const response = await fetch("/api/leaderboard?limit=5");
        if (!response.ok) throw new Error("Failed to fetch");
        const data = await response.json();

        // Transform API response to component format
        const transformedUsers: LeaderboardUser[] = (data.users || []).map(
          (u: ApiUser, idx: number) => {
            const levelInfo = getLevelByNumber(u.current_level || 1);
            return {
              rank: idx + 1,
              username: u.username,
              displayName: u.display_name || u.username,
              avatarUrl: u.avatar_url,
              tokens: u.total_tokens || 0,
              cost: u.total_cost || 0,
              country: u.country_code || "UN",
              level: u.current_level || 1,
              levelName: levelInfo.name,
              levelIcon: levelInfo.icon,
              globalRank: u.global_rank || idx + 1,
              countryRank: u.country_rank || 1,
            };
          }
        );

        setUsers(transformedUsers);
        if (transformedUsers.length > 0) {
          setSelectedUser(transformedUsers[0] ?? null);
        }
      } catch (error) {
        console.error("Failed to fetch leaderboard:", error);
        setUsers([]);
      } finally {
        setLoading(false);
      }
    }

    fetchLeaderboard();
  }, []);

  // Loading state
  if (loading) {
    return (
      <section className="py-20 px-4">
        <div className="max-w-[1000px] mx-auto">
          <div className="text-center mb-10">
            <div className="h-8 w-64 bg-white/10 rounded mx-auto mb-2 animate-pulse" />
            <div className="h-5 w-40 bg-white/10 rounded mx-auto animate-pulse" />
          </div>
          <div className="flex gap-4">
            <div className="flex-1 glass rounded-lg border border-[var(--border-default)] p-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-14 bg-white/5 rounded mb-2 animate-pulse" />
              ))}
            </div>
            <div className="hidden md:block w-72 lg:w-80 glass rounded-lg border border-[var(--border-default)] p-4">
              <div className="h-full bg-white/5 rounded animate-pulse" />
            </div>
          </div>
        </div>
      </section>
    );
  }

  // Pioneer mode - no users yet
  if (users.length === 0) {
    return <PioneerPlaceholder />;
  }

  return (
    <section className="py-20 px-4">
      <div className="max-w-[1000px] mx-auto">
        {/* Section header */}
        <div className="text-center mb-10">
          <h2 className="text-2xl md:text-3xl font-bold text-[var(--color-text-primary)] mb-2">
            Claude Code Rankings
          </h2>
          <p className="text-sm text-[var(--color-claude-coral)] font-medium mb-3">
            Global or by country
          </p>
          <p className="text-sm text-[var(--color-text-muted)]">
            See who&apos;s going all in on Claude Code.
          </p>
        </div>

        {/* Table + Panel Layout */}
        <div className="flex gap-4">
          {/* Leaderboard Table */}
          <div className="flex-1 glass rounded-lg border border-[var(--border-default)] overflow-hidden">
            {/* Filter Bar - Mobile optimized */}
            <div className="px-2 sm:px-4 py-2 sm:py-3 border-b border-[var(--border-default)] bg-white/[0.02] space-y-2">
              {/* Row 1: League Tabs - scrollable on mobile */}
              <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
                <button className="flex-shrink-0 flex items-center gap-1 px-2 sm:px-3 py-1 sm:py-1.5 rounded-md text-[10px] sm:text-xs font-medium bg-white/10 border border-[var(--border-hover)] text-[var(--color-text-primary)]">
                  <span>🏆</span> All<span className="hidden sm:inline"> League</span>
                </button>
                <button className="flex-shrink-0 flex items-center gap-1 px-2 sm:px-3 py-1 sm:py-1.5 rounded-md text-[10px] sm:text-xs text-[var(--color-text-muted)]">
                  <span>🚀</span> Max
                </button>
                <button className="flex-shrink-0 flex items-center gap-1 px-2 sm:px-3 py-1 sm:py-1.5 rounded-md text-[10px] sm:text-xs text-[var(--color-text-muted)]">
                  <span>⚡</span> Pro
                </button>
                <button className="flex-shrink-0 flex items-center gap-1 px-2 sm:px-3 py-1 sm:py-1.5 rounded-md text-[10px] sm:text-xs text-[var(--color-text-muted)]">
                  <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-zinc-500"></span> Free
                </button>
              </div>

              {/* Row 2: Scope + Period */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <div className="flex items-center h-7 rounded overflow-hidden border border-[var(--border-default)]">
                    <button className="h-full px-2 sm:px-2.5 bg-[var(--color-claude-coral)] text-white flex items-center justify-center">
                      <span className="text-sm sm:text-base">🌐</span>
                    </button>
                    <button className="h-full px-2 sm:px-2.5 bg-[var(--color-bg-secondary)] flex items-center justify-center">
                      <FlagIcon countryCode="KR" size="sm" />
                    </button>
                  </div>

                  <div className="flex items-center h-7 rounded overflow-hidden border border-[var(--border-default)] bg-[var(--color-bg-secondary)]">
                    <button className="h-full px-3 sm:px-4 text-[11px] sm:text-xs font-medium bg-white/10 text-[var(--color-text-primary)]">
                      All
                    </button>
                    <button className="h-full px-2.5 sm:px-3 text-[11px] sm:text-xs text-[var(--color-text-muted)]">
                      7D
                    </button>
                    <button className="h-full px-2.5 sm:px-3 text-[11px] sm:text-xs text-[var(--color-text-muted)]">
                      30D
                    </button>
                  </div>
                </div>

                <button className="hidden min-[360px]:flex items-center gap-1.5 h-7 px-3 sm:px-4 rounded text-[11px] sm:text-xs font-medium bg-[var(--color-bg-secondary)] border border-[var(--border-default)] text-[var(--color-text-secondary)]">
                  <span>🏅</span> <span className="hidden sm:inline">My Rank</span>{" "}
                  <span className="text-[var(--color-claude-coral)]">#?</span>
                </button>
              </div>
            </div>

            {/* Header row */}
            <div className="grid grid-cols-12 gap-1 sm:gap-2 px-2 sm:px-4 py-2 sm:py-3 border-b border-[var(--border-default)] text-[9px] sm:text-xs text-[var(--color-text-muted)]">
              <div className="col-span-1 text-center">#</div>
              <div className="col-span-1 text-center"></div>
              <div className="col-span-4 sm:col-span-3">User</div>
              <div className="col-span-2 text-center hidden sm:block">Level</div>
              <div className="col-span-3 sm:col-span-2 text-right">Cost</div>
              <div className="col-span-3 sm:col-span-3 text-right">Tokens</div>
            </div>

            {/* Rows with progressive opacity fade */}
            <div className="divide-y divide-[var(--border-default)]">
              {users.map((user, index) => {
                const style = RANK_STYLES[user.rank as keyof typeof RANK_STYLES] || RANK_STYLES[5];
                const isSelected = selectedUser?.username === user.username;
                const rowOpacity = index <= 1 ? 1 : index === 2 ? 0.7 : index === 3 ? 0.5 : 0.35;
                return (
                  <motion.div
                    key={user.username}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: rowOpacity, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.1, duration: 0.4 }}
                    onClick={() => setSelectedUser(user)}
                    style={{ opacity: rowOpacity }}
                    className={`grid grid-cols-12 gap-1 sm:gap-2 px-2 sm:px-4 py-2 sm:py-3 items-center cursor-pointer transition-colors ${
                      isSelected
                        ? "bg-[var(--color-claude-coral)]/10 border-l-2 border-l-[var(--color-claude-coral)]"
                        : `${style.bg} hover:bg-white/5`
                    }`}
                  >
                    {/* Rank */}
                    <div className="col-span-1 text-center">
                      <span
                        className={`text-xs sm:text-sm font-semibold ${user.rank <= 3 ? "sm:text-lg" : "text-[var(--color-text-muted)]"}`}
                      >
                        {style.emoji}
                      </span>
                    </div>

                    {/* Country */}
                    <div className="col-span-1 flex justify-center">
                      <FlagIcon countryCode={user.country} size="xs" className="sm:hidden" />
                      <FlagIcon countryCode={user.country} size="sm" className="hidden sm:block" />
                    </div>

                    {/* User */}
                    <div className="col-span-4 sm:col-span-3 flex items-center gap-1 sm:gap-2">
                      <img
                        src={getAvatarUrl(user.username, user.avatarUrl)}
                        alt={user.displayName}
                        className="w-5 h-5 sm:w-7 sm:h-7 rounded-full bg-[var(--color-bg-secondary)]"
                      />
                      <span className="text-[11px] sm:text-sm font-medium text-[var(--color-text-primary)] truncate">
                        {user.displayName}
                      </span>
                    </div>

                    {/* Level */}
                    <div className="col-span-2 hidden sm:flex justify-center">
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium"
                        style={{ backgroundColor: "rgba(249, 115, 22, 0.2)", color: "#F97316" }}
                      >
                        <span>{user.levelIcon}</span>
                        <span>Lv.{user.level}</span>
                      </span>
                    </div>

                    {/* Cost */}
                    <div className="col-span-3 sm:col-span-2 text-right">
                      <span className="text-[11px] sm:text-sm font-mono text-amber-500">
                        {formatCost(user.cost)}
                      </span>
                    </div>

                    {/* Tokens */}
                    <div className="col-span-3 text-right">
                      <span className="text-[11px] sm:text-sm font-mono text-[var(--color-claude-coral)] font-semibold">
                        {formatNumber(user.tokens)}
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Side Panel - Hidden on mobile */}
          <div className="hidden md:block w-72 lg:w-80 glass rounded-lg border border-[var(--border-default)] overflow-hidden">
            <ProfilePanel user={selectedUser} />
          </div>
        </div>

        {/* View full leaderboard button */}
        <div className="mt-5 text-center">
          <Link
            href="/leaderboard"
            className="inline-flex items-center gap-2 text-sm text-[var(--color-claude-coral)] hover:underline font-medium"
          >
            View full leaderboard
            <span>→</span>
          </Link>
        </div>

        {/* Question prompt */}
        <p className="text-center text-sm text-[var(--color-text-muted)] mt-4">
          How does your journey compare?
        </p>
      </div>
    </section>
  );
}
