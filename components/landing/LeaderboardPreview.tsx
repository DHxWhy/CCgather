"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { Github, Linkedin, Globe } from "lucide-react";
import { FlagIcon } from "@/components/ui/FlagIcon";
import { formatNumber, formatCost } from "@/lib/utils/format";

// X (formerly Twitter) icon component
function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

// Social Links Display for mock data
function MockSocialLinks({
  socialLinks,
}: {
  socialLinks: { github?: string; twitter?: string; linkedin?: string; website?: string };
}) {
  const links = [
    { key: "github", icon: Github, color: "text-[#a855f7]", hoverColor: "hover:bg-[#a855f7]/20" },
    { key: "twitter", icon: XIcon, color: "text-[#1DA1F2]", hoverColor: "hover:bg-[#1DA1F2]/20" },
    {
      key: "linkedin",
      icon: Linkedin,
      color: "text-[#0A66C2]",
      hoverColor: "hover:bg-[#0A66C2]/20",
    },
    {
      key: "website",
      icon: Globe,
      color: "text-emerald-400",
      hoverColor: "hover:bg-emerald-400/20",
    },
  ] as const;

  const activeLinks = links.filter((link) => socialLinks[link.key as keyof typeof socialLinks]);

  if (activeLinks.length === 0) return null;

  return (
    <div className="flex items-center gap-0.5">
      {activeLinks.map((link) => {
        const Icon = link.icon;
        return (
          <span
            key={link.key}
            className={`p-1.5 rounded-md transition-all ${link.color} ${link.hoverColor} cursor-pointer`}
          >
            <Icon className="w-3.5 h-3.5" />
          </span>
        );
      })}
    </div>
  );
}

// Mock leaderboard data - realistic values based on actual level system (Lv.1-10)
// Level system: Novice(1) → Apprentice(2) → Journeyman(3) → Expert(4) → Master(5)
//               → Grandmaster(6) → Legend(7) → Mythic(8) → Immortal(9) → Transcendent(10)
const MOCK_LEADERBOARD = [
  {
    rank: 1,
    username: "user_1",
    displayName: "User1",
    tokens: 15_000_000_000, // 15B → Level 7 (Legend)
    cost: 54230,
    country: "KR",
    level: 7,
    levelName: "Legend",
    levelIcon: "🌟",
    globalRank: 1,
    countryRank: 1,
    avgDaily: 85_000_000,
    sessions: 1247,
    socialLinks: { github: "user1", twitter: "user1", linkedin: "user1", website: "user1.dev" },
  },
  {
    rank: 2,
    username: "user_2",
    displayName: "User2",
    tokens: 8_500_000_000, // 8.5B → Level 6 (Grandmaster)
    cost: 30720,
    country: "US",
    level: 6,
    levelName: "Grandmaster",
    levelIcon: "👑",
    globalRank: 2,
    countryRank: 1,
    avgDaily: 48_000_000,
    sessions: 892,
    socialLinks: { github: "user2", twitter: "user2" },
  },
  {
    rank: 3,
    username: "user_3",
    displayName: "User3",
    tokens: 4_200_000_000, // 4.2B → Level 6 (Grandmaster)
    cost: 15180,
    country: "JP",
    level: 6,
    levelName: "Grandmaster",
    levelIcon: "👑",
    globalRank: 3,
    countryRank: 1,
    avgDaily: 24_000_000,
    sessions: 654,
    socialLinks: { github: "user3", website: "user3.io" },
  },
  {
    rank: 4,
    username: "user_4",
    displayName: "User4",
    tokens: 2_100_000_000, // 2.1B → Level 5 (Master)
    cost: 7590,
    country: "DE",
    level: 5,
    levelName: "Master",
    levelIcon: "🔥",
    globalRank: 4,
    countryRank: 1,
    avgDaily: 12_000_000,
    sessions: 423,
    socialLinks: { github: "user4", linkedin: "user4" },
  },
  {
    rank: 5,
    username: "user_5",
    displayName: "User5",
    tokens: 1_500_000_000, // 1.5B → Level 5 (Master)
    cost: 5420,
    country: "GB",
    level: 5,
    levelName: "Master",
    levelIcon: "🔥",
    globalRank: 5,
    countryRank: 1,
    avgDaily: 8_500_000,
    sessions: 312,
    socialLinks: { github: "user5" },
  },
];

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

// Mock activity data for line chart
const MOCK_ACTIVITY = [30, 45, 25, 60, 80, 55, 70, 90, 65, 85, 75, 95];

// Line chart component (mimics actual recharts style)
function MiniLineChart({ data }: { data: number[] }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const width = 100;
  const height = 32;
  const padding = 2;

  // Generate SVG path for smooth line
  const points = data.map((value, i) => ({
    x: padding + (i / (data.length - 1)) * (width - padding * 2),
    y: padding + (1 - (value - min) / range) * (height - padding * 2),
  }));

  const pathD = points.reduce((acc, point, i) => {
    if (i === 0) return `M ${point.x} ${point.y}`;
    return `${acc} L ${point.x} ${point.y}`;
  }, "");

  // Area fill path
  const areaD = `${pathD} L ${points[points.length - 1]?.x ?? 0} ${height - padding} L ${padding} ${height - padding} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-8">
      {/* Grid lines */}
      <line
        x1={padding}
        y1={height / 2}
        x2={width - padding}
        y2={height / 2}
        stroke="var(--border-default)"
        strokeWidth="0.5"
        strokeDasharray="2,2"
      />
      {/* Area fill */}
      <path d={areaD} fill="var(--color-claude-coral)" fillOpacity="0.1" />
      {/* Line */}
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

// Side Panel Component - matching real ProfileSidePanel layout
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
      {/* 1. Profile Header */}
      <div className="flex items-start gap-3">
        <Image
          src={getAvatarUrl(user.username)}
          alt={user.displayName}
          width={48}
          height={48}
          className="w-12 h-12 rounded-full bg-[var(--color-bg-secondary)] flex-shrink-0"
        />
        <div className="min-w-0 flex-1">
          {/* Name + Level Badge + Social Icons */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              <h3 className="text-base font-semibold text-[var(--color-text-primary)] truncate">
                {user.displayName}
              </h3>
              <span
                className="px-1.5 py-0.5 rounded text-[9px] font-medium flex-shrink-0"
                style={{ backgroundColor: "rgba(218, 119, 86, 0.2)", color: "#DA7756" }}
              >
                {user.levelIcon} Lv.{user.level}
              </span>
            </div>
            {/* Social Links - right of name */}
            {user.socialLinks && (
              <div className="flex-shrink-0">
                <MockSocialLinks socialLinks={user.socialLinks} />
              </div>
            )}
          </div>
          <p className="text-xs text-[var(--color-text-muted)] flex items-center gap-1.5 mt-0.5">
            <FlagIcon countryCode={user.country} size="xs" />
            <span>@{user.username}</span>
          </p>
        </div>
      </div>

      {/* 2. Level Progress (moved up to match real panel) */}
      <div className="p-3 bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--border-default)]">
        <div className="flex items-center justify-between text-[10px] mb-1.5">
          <span className="text-[var(--color-text-secondary)] flex items-center gap-1">
            <span>{user.levelIcon}</span> {user.levelName} (Lv.{user.level})
          </span>
          {user.level < 10 && (
            <span className="text-[var(--color-text-muted)]">
              →{" "}
              {user.level === 7
                ? "🏆 Mythic"
                : user.level === 6
                  ? "🌟 Legend"
                  : user.level === 5
                    ? "👑 Grandmaster"
                    : "🔥 Master"}
            </span>
          )}
        </div>
        <div className="h-2.5 bg-white/10 rounded-full overflow-hidden border border-[var(--border-default)]">
          <div
            className="h-full bg-[var(--color-claude-coral)] rounded-full transition-all duration-500"
            style={{ width: `${65 + user.rank * 5}%` }}
          />
        </div>
        <div className="text-[9px] text-[var(--color-text-muted)] mt-1.5">
          Current Range:{" "}
          <span className="text-[var(--color-text-secondary)]">
            {user.level === 7
              ? "10B ~ 30B"
              : user.level === 6
                ? "3B ~ 10B"
                : user.level === 5
                  ? "1B ~ 3B"
                  : "500M ~ 1B"}
          </span>{" "}
          ({user.levelName})
        </div>
      </div>

      {/* 3. Stats Grid (Global Rank / Country Rank / Sessions, Cost / Tokens) */}
      <div className="grid grid-cols-6 gap-2">
        {/* Top row: Global Rank, Country Rank, Sessions */}
        <div className="col-span-2 p-3 bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--border-default)]">
          <div className="text-[10px] text-[var(--color-text-muted)] mb-1 flex items-center gap-1">
            🌍 Global
          </div>
          <div className="text-base font-semibold text-[var(--color-text-primary)]">
            #{user.globalRank}
          </div>
        </div>
        <div className="col-span-2 p-3 bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--border-default)]">
          <div className="text-[10px] text-[var(--color-text-muted)] mb-1 flex items-center gap-1">
            <FlagIcon countryCode={user.country} size="xs" />
            <span>Country</span>
          </div>
          <div className="text-base font-semibold text-[var(--color-text-primary)]">
            #{user.countryRank}
          </div>
        </div>
        <div className="col-span-2 p-3 bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--border-default)]">
          <div className="text-[10px] text-[var(--color-text-muted)] mb-1">💻 Sessions</div>
          <div className="text-base font-semibold text-[var(--color-text-primary)]">
            {user.sessions.toLocaleString()}
          </div>
        </div>
        {/* Bottom row: Cost, Tokens */}
        <div className="col-span-3 p-3 bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--border-default)]">
          <div className="text-[10px] text-[var(--color-text-muted)] mb-1">💰 Costs</div>
          <div className="text-base font-medium text-[var(--color-cost)]">
            ${user.cost >= 1000 ? `${(user.cost / 1000).toFixed(1)}K` : user.cost.toLocaleString()}
          </div>
        </div>
        <div className="col-span-3 p-3 bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--border-default)]">
          <div className="text-[10px] text-[var(--color-text-muted)] mb-1">⚡ Tokens</div>
          <div className="text-base font-medium text-[var(--color-claude-coral)]">
            {formatNumber(user.tokens)}
          </div>
        </div>
      </div>

      {/* 4. Usage History - Line Chart Style - faded */}
      <div className="p-3 bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--border-default)] opacity-40">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide flex items-center gap-1">
            <span>📈</span> Usage History
          </span>
          <span className="text-[9px] text-[var(--color-text-muted)]">All Time</span>
        </div>
        <MiniLineChart data={MOCK_ACTIVITY} />
        <div className="text-[10px] text-[var(--color-text-secondary)] mt-2 pt-2 border-t border-[var(--border-default)] text-center">
          Avg Daily:{" "}
          <span className="font-medium text-[var(--color-claude-coral)]">
            {formatNumber(user.avgDaily)}
          </span>{" "}
          tokens
        </div>
      </div>
    </motion.div>
  );
}

export function LeaderboardPreview() {
  const [selectedUser, setSelectedUser] = useState<(typeof MOCK_LEADERBOARD)[0] | null>(
    MOCK_LEADERBOARD[0] ?? null
  );

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
            <div className="px-2 sm:px-4 py-2 sm:py-3 border-b border-[var(--border-default)] bg-white/[0.02]">
              {/* Scope + Period - all elements h-7 (28px) */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  {/* Scope icons */}
                  <div className="flex items-center h-7 rounded overflow-hidden border border-white/10">
                    <button className="h-full px-2 sm:px-2.5 bg-[var(--color-claude-coral)] text-white flex items-center justify-center">
                      <span className="text-sm sm:text-base">🌐</span>
                    </button>
                    <button className="h-full px-2 sm:px-2.5 bg-[var(--color-bg-secondary)] flex items-center justify-center">
                      <FlagIcon countryCode="KR" size="sm" />
                    </button>
                  </div>

                  {/* Period tabs */}
                  <div className="flex items-center h-7 rounded overflow-hidden border border-white/10 bg-[var(--color-bg-secondary)]">
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

                {/* My Rank */}
                <button className="hidden min-[360px]:flex items-center gap-1.5 h-7 px-3 sm:px-4 rounded text-[11px] sm:text-xs font-medium bg-[var(--color-bg-secondary)] border border-white/10 text-[var(--color-text-secondary)]">
                  <span>🏅</span> <span className="hidden sm:inline">My Rank</span>{" "}
                  <span className="text-[var(--color-claude-coral)]">#1</span>
                </button>
              </div>
            </div>

            {/* Header row - Mobile optimized */}
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
              {MOCK_LEADERBOARD.map((user, index) => {
                const style = RANK_STYLES[user.rank as keyof typeof RANK_STYLES];
                const isSelected = selectedUser?.username === user.username;
                // Progressive opacity: 100% -> 100% -> 70% -> 50% -> 35%
                const rowOpacity = index <= 1 ? 1 : index === 2 ? 0.7 : index === 3 ? 0.5 : 0.35;
                return (
                  <motion.div
                    key={user.rank}
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
                      <Image
                        src={getAvatarUrl(user.username)}
                        alt={user.displayName}
                        width={28}
                        height={28}
                        className="w-5 h-5 sm:w-7 sm:h-7 rounded-full bg-[var(--color-bg-secondary)]"
                      />
                      <span className="text-[11px] sm:text-sm font-medium text-[var(--color-text-primary)] truncate">
                        {user.displayName}
                      </span>
                    </div>

                    {/* Level - Orange badge style matching actual design - hidden on mobile */}
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
                      <span className="text-[11px] sm:text-sm font-mono text-emerald-400">
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

        {/* View full leaderboard button - below entire layout */}
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
