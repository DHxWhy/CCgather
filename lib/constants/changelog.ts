export type ChangelogCategory = "new" | "improved" | "fixed";

export interface ChangelogEntry {
  id: string;
  date: string;
  category: ChangelogCategory;
  title: string;
  summary: string;
}

export const CHANGELOG_CATEGORY = {
  new: { label: "new", mark: "+" },
  improved: { label: "improved", mark: "~" },
  fixed: { label: "fixed", mark: "!" },
} as const satisfies Record<ChangelogCategory, { label: string; mark: string }>;

export const CHANGELOG: readonly ChangelogEntry[] = [
  {
    id: "2026-09-05-speed",
    date: "2026-09-05",
    category: "improved",
    title: "The leaderboard loads twice as fast",
    summary:
      "Rankings now arrive with the page itself and the globe waits its turn — first row in about a second instead of two.",
  },
  {
    id: "2026-09-04-badges",
    date: "2026-09-04",
    category: "new",
    title: "40 enamel-pin badges with rarity tiers",
    summary:
      "A redrawn board of pins — common, rare, epic and legendary — with a reveal the moment you earn one.",
  },
  {
    id: "2026-09-02-fable-pricing",
    date: "2026-09-02",
    category: "improved",
    title: "Accurate costs for Claude Fable 5.1",
    summary: "Cache reads use the official $0.25/MTok rate; Sonnet 5 is priced at $2/$10.",
  },
  {
    id: "2026-08-06-star",
    date: "2026-08-06",
    category: "new",
    title: "Star the repo from the CLI",
    summary: "One tap after a sync, verified server-side. Shipped in CLI v2.1.0.",
  },
  {
    id: "2026-07-28-globe-flags",
    date: "2026-07-28",
    category: "new",
    title: "Country flags on the globe",
    summary: "Every participating country shows its flag, sized by rank.",
  },
  {
    id: "2026-07-24-sprint",
    date: "2026-07-24",
    category: "new",
    title: "Season Sprint board",
    summary: "Monthly ranking with your gap to the next rank and to #1.",
  },
  {
    id: "2026-07-14-hall-of-fame",
    date: "2026-07-14",
    category: "new",
    title: "Season 1 · Hall of Fame",
    summary: "Monthly champions in tokens, cost and sessions, plus the country race.",
  },
  {
    id: "2026-07-13-stats",
    date: "2026-07-13",
    category: "new",
    title: "Public growth dashboard",
    summary:
      "The numbers we watch — developers, countries, sessions and live syncs — opened at /stats.",
  },
  {
    id: "2026-06-30-profile-link",
    date: "2026-06-30",
    category: "new",
    title: "Share your profile with a link",
    summary: "A direct link opens your card on the leaderboard and highlights your row.",
  },
  {
    id: "2026-05-29-model-badges",
    date: "2026-05-29",
    category: "new",
    title: "Model badges are back",
    summary: "Opus, Sonnet, Haiku and Fable badges, worked out from your daily history.",
  },
  {
    id: "2026-05-24-signup",
    date: "2026-05-24",
    category: "improved",
    title: "Sign-up without the paperwork",
    summary: "Your country is detected automatically and onboarding is no longer forced.",
  },
  {
    id: "2026-03-19-yearly-history",
    date: "2026-03-19",
    category: "new",
    title: "A year of usage in one chart",
    summary: "Your profile opens the full history, not just the last month.",
  },
  {
    id: "2026-02-08-multi-device",
    date: "2026-02-08",
    category: "new",
    title: "Multi-device support",
    summary:
      "Sync from every machine you code on — the CLI shows the breakdown and the leaderboard uses the combined total.",
  },
  {
    id: "2026-02-07-live-pricing",
    date: "2026-02-07",
    category: "improved",
    title: "Live model pricing",
    summary:
      "Costs are recomputed on the server from current published rates instead of fixed tables.",
  },
  {
    id: "2026-02-03-avatar",
    date: "2026-02-03",
    category: "new",
    title: "Custom avatars",
    summary: "Generate your own avatar instead of carrying over your provider photo.",
  },
  {
    id: "2026-01-31-github-sync",
    date: "2026-01-31",
    category: "new",
    title: "GitHub profile sync",
    summary: "Your name, photo and links stay in step with GitHub.",
  },
  {
    id: "2026-01-24-theme",
    date: "2026-01-24",
    category: "new",
    title: "Light and dark themes",
    summary: "A toggle in the header, remembered in your browser.",
  },
  {
    id: "2026-01-21-invite",
    date: "2026-01-21",
    category: "new",
    title: "Invite other developers",
    summary: "Share an invite link and collect social badges.",
  },
  {
    id: "2026-01-20-globe-leagues",
    date: "2026-01-20",
    category: "new",
    title: "The globe, and level-based leagues",
    summary: "A 3D globe on the leaderboard, and CLI v2.0 placing you in a league by level.",
  },
  {
    id: "2026-01-09-badges",
    date: "2026-01-09",
    category: "new",
    title: "Badges and level progress",
    summary: "Automatic unlocks as your totals grow.",
  },
  {
    id: "2026-01-08-cli-auth",
    date: "2026-01-08",
    category: "new",
    title: "Sign in from your terminal",
    summary: "Device authorization in the CLI, then your usage submits on its own.",
  },
  {
    id: "2026-01-07-launch",
    date: "2026-01-07",
    category: "new",
    title: "CCgather is live",
    summary:
      "A leaderboard for Claude Code developers — install the CLI, sync your usage, see where you stand.",
  },
];

export const CHANGELOG_LATEST_ID = CHANGELOG[0]?.id ?? "";

export const WHATS_NEW_SEEN_KEY = "ccgather:whats-new:seen";

export function readSeenId(storage: Pick<Storage, "getItem">): string | null {
  try {
    return storage.getItem(WHATS_NEW_SEEN_KEY);
  } catch {
    return null;
  }
}

export function hasUnseenUpdate(seenId: string | null, latestId: string): boolean {
  return latestId !== "" && seenId !== latestId;
}
