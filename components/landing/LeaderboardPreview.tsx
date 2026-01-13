"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { FlagIcon } from "@/components/ui/FlagIcon";

// Mock leaderboard data with anime-style avatars
const MOCK_LEADERBOARD = [
  {
    rank: 1,
    username: "user_1",
    displayName: "User1",
    tokens: 12500000000,
    cost: 45230,
    country: "KR",
    level: 42,
    levelName: "Grandmaster",
    levelIcon: "👑",
    globalRank: 1,
    countryRank: 1,
    avgDaily: 342000000,
  },
  {
    rank: 2,
    username: "user_2",
    displayName: "User2",
    tokens: 9800000000,
    cost: 35420,
    country: "US",
    level: 38,
    levelName: "Master",
    levelIcon: "⚔️",
    globalRank: 2,
    countryRank: 1,
    avgDaily: 268000000,
  },
  {
    rank: 3,
    username: "user_3",
    displayName: "User3",
    tokens: 7200000000,
    cost: 26100,
    country: "JP",
    level: 35,
    levelName: "Expert",
    levelIcon: "🎯",
    globalRank: 3,
    countryRank: 1,
    avgDaily: 197000000,
  },
  {
    rank: 4,
    username: "user_4",
    displayName: "User4",
    tokens: 5100000000,
    cost: 18450,
    country: "DE",
    level: 31,
    levelName: "Advanced",
    levelIcon: "🧙",
    globalRank: 4,
    countryRank: 1,
    avgDaily: 139000000,
  },
  {
    rank: 5,
    username: "user_5",
    displayName: "User5",
    tokens: 4300000000,
    cost: 15560,
    country: "GB",
    level: 29,
    levelName: "Skilled",
    levelIcon: "✨",
    globalRank: 5,
    countryRank: 1,
    avgDaily: 117000000,
  },
];

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
  4: { emoji: "#4", bg: "bg-white/5", border: "border-white/10" },
  5: { emoji: "#5", bg: "bg-white/5", border: "border-white/10" },
} as const;

// Get anime-style avatar URL using DiceBear (adventurer style - more anime-like)
function getAvatarUrl(username: string): string {
  return `https://api.dicebear.com/7.x/adventurer/svg?seed=${username}&backgroundColor=transparent`;
}

// Mock activity data for sparkline
const MOCK_ACTIVITY = [30, 45, 25, 60, 80, 55, 70, 90, 65, 85, 75, 95];

// Simple sparkline component
function Sparkline({ data }: { data: number[] }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;

  return (
    <div className="flex items-end gap-[2px] h-8">
      {data.map((value, i) => (
        <div
          key={i}
          className="flex-1 bg-[var(--color-claude-coral)] rounded-t-sm opacity-60 hover:opacity-100 transition-opacity"
          style={{ height: `${((value - min) / range) * 100}%`, minHeight: "4px" }}
        />
      ))}
    </div>
  );
}

// Side Panel Component
function ProfilePanel({ user }: { user: (typeof MOCK_LEADERBOARD)[0] | null }) {
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

  return (
    <motion.div
      key={user.username}
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3 }}
      className="p-4 flex flex-col gap-3"
    >
      {/* Profile Header */}
      <div className="flex items-center gap-3">
        <img
          src={getAvatarUrl(user.username)}
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
              {user.levelIcon} Lv.{user.level}
            </span>
          </div>
          <p className="text-xs text-[var(--color-text-muted)] flex items-center gap-1.5 mt-0.5">
            <FlagIcon countryCode={user.country} size="xs" />
            <span>@{user.username}</span>
          </p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-2">
        <div className="p-3 bg-[var(--color-bg-secondary)] rounded-xl border border-[var(--border-default)]">
          <div className="text-[10px] text-[var(--color-text-muted)] mb-1 flex items-center gap-1">
            <span>🌍</span> Global Rank
          </div>
          <div className="text-xl font-semibold text-[var(--color-text-primary)]">
            #{user.globalRank}
          </div>
        </div>
        <div className="p-3 bg-[var(--color-bg-secondary)] rounded-xl border border-[var(--border-default)]">
          <div className="text-[10px] text-[var(--color-text-muted)] mb-1 flex items-center gap-1">
            <FlagIcon countryCode={user.country} size="xs" />
            <span>Country</span>
          </div>
          <div className="text-xl font-semibold text-[var(--color-text-primary)]">
            #{user.countryRank}
          </div>
        </div>
        <div className="p-3 bg-[var(--color-bg-secondary)] rounded-xl border border-[var(--border-default)]">
          <div className="text-[10px] text-[var(--color-text-muted)] mb-1 flex items-center gap-1">
            <span>💰</span> Total Cost
          </div>
          <div className="text-xl font-semibold text-emerald-400">{formatCost(user.cost)}</div>
        </div>
        <div className="p-3 bg-[var(--color-bg-secondary)] rounded-xl border border-[var(--border-default)]">
          <div className="text-[10px] text-[var(--color-text-muted)] mb-1 flex items-center gap-1">
            <span>🔥</span> Tokens
          </div>
          <div className="text-xl font-semibold text-[var(--color-claude-coral)]">
            {formatNumber(user.tokens)}
          </div>
        </div>
      </div>

      {/* Activity Chart */}
      <div className="p-3 bg-[var(--color-bg-secondary)] rounded-xl border border-[var(--border-default)]">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] text-[var(--color-text-muted)] flex items-center gap-1">
            <span>📈</span> Recent Activity
          </span>
          <span className="text-[9px] text-[var(--color-text-muted)]">Last 12 weeks</span>
        </div>
        <Sparkline data={MOCK_ACTIVITY} />
        <div className="text-[10px] text-[var(--color-text-secondary)] mt-2 pt-2 border-t border-[var(--border-default)] text-center">
          Avg Daily:{" "}
          <span className="font-medium text-[var(--color-claude-coral)]">
            {formatNumber(user.avgDaily)}
          </span>{" "}
          tokens
        </div>
      </div>

      {/* Level Progress */}
      <div className="p-3 bg-[var(--color-bg-secondary)] rounded-xl border border-[var(--border-default)]">
        <div className="flex items-center justify-between text-[10px] mb-1.5">
          <span className="text-[var(--color-text-secondary)] flex items-center gap-1">
            <span>{user.levelIcon}</span> {user.levelName} (Lv.{user.level})
          </span>
          <span className="text-[var(--color-text-muted)]">→ Next Level</span>
        </div>
        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-[var(--color-claude-coral)] rounded-full transition-all duration-500"
            style={{ width: `${65 + user.rank * 5}%` }}
          />
        </div>
      </div>
    </motion.div>
  );
}

export function LeaderboardPreview() {
  const [selectedUser, setSelectedUser] = useState<(typeof MOCK_LEADERBOARD)[0] | null>(
    MOCK_LEADERBOARD[0]
  );

  return (
    <section className="py-20 px-6">
      <div className="max-w-5xl mx-auto">
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
          <div className="flex-1 glass rounded-2xl border border-[var(--border-default)] overflow-hidden">
            {/* Header row */}
            <div className="grid grid-cols-12 gap-2 px-4 py-3 border-b border-[var(--border-default)] text-xs text-[var(--color-text-muted)]">
              <div className="col-span-1 text-center">Rank</div>
              <div className="col-span-1 text-center"></div>
              <div className="col-span-5">User</div>
              <div className="col-span-2 text-right">Cost</div>
              <div className="col-span-3 text-right">Tokens</div>
            </div>

            {/* Rows */}
            <div className="divide-y divide-[var(--border-default)]">
              {MOCK_LEADERBOARD.map((user, index) => {
                const style = RANK_STYLES[user.rank as keyof typeof RANK_STYLES];
                const isSelected = selectedUser?.username === user.username;
                return (
                  <motion.div
                    key={user.rank}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.1, duration: 0.4 }}
                    onClick={() => setSelectedUser(user)}
                    className={`grid grid-cols-12 gap-2 px-4 py-3 items-center cursor-pointer transition-colors ${
                      isSelected
                        ? "bg-[var(--color-claude-coral)]/10 border-l-2 border-l-[var(--color-claude-coral)]"
                        : `${style.bg} hover:bg-white/5`
                    }`}
                  >
                    {/* Rank */}
                    <div className="col-span-1 text-center">
                      <span
                        className={`text-sm font-semibold ${user.rank <= 3 ? "text-lg" : "text-[var(--color-text-muted)]"}`}
                      >
                        {style.emoji}
                      </span>
                    </div>

                    {/* Country */}
                    <div className="col-span-1 flex justify-center">
                      <FlagIcon countryCode={user.country} size="sm" />
                    </div>

                    {/* User */}
                    <div className="col-span-5 flex items-center gap-2">
                      <img
                        src={getAvatarUrl(user.username)}
                        alt={user.displayName}
                        className="w-7 h-7 rounded-full bg-[var(--color-bg-secondary)]"
                      />
                      <span className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                        {user.displayName}
                      </span>
                    </div>

                    {/* Cost */}
                    <div className="col-span-2 text-right">
                      <span className="text-sm font-mono text-emerald-400">
                        {formatCost(user.cost)}
                      </span>
                    </div>

                    {/* Tokens */}
                    <div className="col-span-3 text-right">
                      <span className="text-sm font-mono text-[var(--color-claude-coral)] font-semibold">
                        {formatNumber(user.tokens)}
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="px-4 py-4 border-t border-[var(--border-default)] bg-white/[0.02] text-center">
              <Link
                href="/leaderboard"
                className="inline-flex items-center gap-2 text-sm text-[var(--color-claude-coral)] hover:underline font-medium"
              >
                View full leaderboard
                <span>→</span>
              </Link>
            </div>
          </div>

          {/* Side Panel - Hidden on mobile */}
          <div className="hidden md:block w-72 lg:w-80 glass rounded-2xl border border-[var(--border-default)] overflow-hidden">
            <ProfilePanel user={selectedUser} />
          </div>
        </div>

        {/* Question prompt */}
        <p className="text-center text-sm text-[var(--color-text-muted)] mt-6">
          How does your journey compare? 🚀
        </p>
      </div>
    </section>
  );
}
