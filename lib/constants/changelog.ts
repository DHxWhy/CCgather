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
    id: "2026-10-19-cli-large-transcripts",
    date: "2026-10-19",
    category: "fixed",
    title: "The longest Claude Code sessions now count",
    summary:
      "On Node, a transcript over about 512 MiB cannot be read as one string, so the CLI skipped it without a word — and since the longest sessions are usually the heaviest, the biggest totals were the ones missing (one machine: five files, 16.9B tokens). CLI v2.3.1 reads transcripts in chunks and decodes only the lines that hold usage: nothing is skipped, a full scan runs three to four times faster on about a fifth of the memory, and your next submit catches the missing sessions up. From CLI v2.3.2 a job set up through npx runs the newest release each day, so this is the last upgrade it can miss; jobs created with v2.3.0 or v2.3.1 are pinned to that version, so run npx ccgather autosubmit on once (add --pin if you would rather hold a version). From then on the job also reports itself as on, which unlocks the Autopilot badge.",
  },
  {
    id: "2026-10-12-cli-auto-submit",
    date: "2026-10-12",
    category: "new",
    title: "Auto-submit: one command keeps your Claude Code usage current",
    summary:
      "npx ccgather autosubmit on registers a daily job with your operating system's own scheduler (Task Scheduler, launchd, systemd or cron) that runs the CLI's prompt-free submit. It picks the time you turned it on plus five minutes so submissions spread out, catches up after a day the machine was off, skips a run within 20 hours of your last submit, and autosubmit status shows what the last run did. The main menu has the same toggle as its second item. In CLI v2.3.0, contributed by michael-huffaker.",
  },
  {
    id: "2026-10-12-cli-workflow-journal-sessions",
    date: "2026-10-12",
    category: "fixed",
    title: "Workflow journals no longer count as Claude Code sessions",
    summary:
      "A Claude Code workflow run leaves a journal file that holds no usage. The CLI counted each one as a session, so heavy workflow users saw a few extra sessions in their total. CLI v2.3.0 counts a file without a session id only when it holds usage. Token and cost totals are unchanged. Fixed by michael-huffaker.",
  },
  {
    id: "2026-10-11-cli-subagent-usage-counted",
    date: "2026-10-11",
    category: "fixed",
    title: "Claude Code subagent usage now counts toward your totals",
    summary:
      "The CLI treated subagent transcripts as duplicate sessions and dropped them, so anyone using subagents or workflows was under-counted: by about 7% on a typical machine in our tests, and by more than half for heavy subagent users. CLI v2.2.0 counts every transcript once, so your next submit may raise your totals. A session and its subagents now count as one session. Reported and fixed by michael-huffaker.",
  },
  {
    id: "2026-10-11-cli-scheduled-submit",
    date: "2026-10-11",
    category: "new",
    title: "Scheduled submits: ccgather submit runs without prompts",
    summary:
      "ccgather submit sends your Claude Code usage with no menu, spinner or login prompt, prints one result line and exits non-zero on failure, so cron or Task Scheduler can keep your profile current. Requests time out after 120 seconds so a stalled run never hangs. Contributed by michael-huffaker; a one-command auto-submit toggle is next.",
  },
  {
    id: "2026-10-04-smooth-scroll",
    date: "2026-10-04",
    category: "improved",
    title: "Smoother scrolling across the Claude Code leaderboard",
    summary:
      "Mouse-wheel and trackpad scrolling now glides instead of jumping a notch at a time in the developer rankings, top countries, profile panels and the stats page. Touch screens and reduced-motion settings keep native scrolling.",
  },
  {
    id: "2026-10-04-cli-submit-speed",
    date: "2026-10-04",
    category: "improved",
    title: "Faster Claude Code usage submits, no stall at 100%",
    summary:
      "The scan bar used to sit at 100% while the CLI re-read every Claude Code session file for its duplicate-submission check. That check now runs during the scan itself, cutting scan time by 30–50% in our tests. Shipped in CLI v2.1.1.",
  },
  {
    id: "2026-09-29-sonnet-5-5-pricing",
    date: "2026-09-29",
    category: "improved",
    title: "Claude Sonnet 5.5 costs, synced from Anthropic",
    summary:
      "Sonnet 5.5 is priced at $2/$10 with $0.20/MTok cache reads, the same rate as Sonnet 5, picked up automatically from Anthropic's price list. It counts toward the Sonnet family in the model mix.",
  },
  {
    id: "2026-09-24-opus-5-5-pricing",
    date: "2026-09-24",
    category: "improved",
    title: "Claude Opus 5.5 costs, synced from Anthropic",
    summary:
      "Opus 5.5 is priced at $4/$20 with $0.20/MTok cache reads, and new models now follow Anthropic's official price list within the hour.",
  },
  {
    id: "2026-09-05-speed",
    date: "2026-09-05",
    category: "improved",
    title: "The leaderboard loads twice as fast",
    summary:
      "Rankings now arrive with the page itself and the globe waits its turn — first row in about a second instead of two.",
  },
  {
    id: "2026-09-05-security",
    date: "2026-09-05",
    category: "improved",
    title: "Security and dependency refresh",
    summary: "Sign-in, database and framework libraries moved to their latest patched releases.",
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
    id: "2026-09-04-badge-award",
    date: "2026-09-04",
    category: "fixed",
    title: "Session and streak badges now unlock",
    summary: "Four badges could never award because the submit route left their inputs empty.",
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
    id: "2026-07-27-cost-accuracy",
    date: "2026-07-27",
    category: "improved",
    title: "Sharper daily cost calculation",
    summary: "Prices are resolved per model per day instead of once per submission.",
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
    id: "2026-07-08-token-precision",
    date: "2026-07-08",
    category: "fixed",
    title: "Token counting precision restored",
    summary:
      "A CLI aggregation bug could overstate daily totals. Fixed in the CLI and guarded on the server.",
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
    id: "2026-02-06-faq",
    date: "2026-02-06",
    category: "new",
    title: "FAQ in the header",
    summary: "What we collect, what never leaves your machine, and how submissions work.",
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
    id: "2026-01-19-cache-tokens",
    date: "2026-01-19",
    category: "improved",
    title: "Cache tokens counted in your daily stats",
    summary: "Input, output, cache read and cache write are each stored per day.",
  },
  {
    id: "2026-01-14-fingerprint",
    date: "2026-01-14",
    category: "improved",
    title: "Session fingerprints keep the board fair",
    summary:
      "A hash per session stops the same work counting twice. It carries no code and no conversation.",
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
