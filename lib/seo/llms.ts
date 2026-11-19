import { CHANGELOG } from "@/lib/constants/changelog";
import { LEVELS } from "@/lib/constants/levels";
import {
  SITE_FAQ,
  SITE_FEATURES,
  SITE_ONE_LINER,
  SITE_URL,
  badgesSentence,
  formatTokenThreshold,
  raritySentence,
} from "@/lib/seo/site-facts";

/**
 * /llms.txt and /llms-full.txt, built from the same facts as the site's structured data.
 * The format follows llmstxt.org: one H1, a blockquote summary, a body without headings, then
 * H2 sections that hold only `- [name](url): notes` links, with "Optional" last.
 */

export interface LiveNumbers {
  /** UTC date the numbers were read, YYYY-MM-DD */
  asOf: string;
  /** Developers who finished sign-up, as the landing page counts them */
  developers?: number;
  countries?: number;
  tokensAllTime?: number;
  tokens30d?: number;
}

const usable = (n: number | undefined): n is number => typeof n === "number" && n > 0;

export function formatBigNumber(n: number): string {
  if (n >= 1e12) return `${(n / 1e12).toFixed(2)} trillion`;
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)} billion`;
  if (n >= 1e6) return `${Math.round(n / 1e6)} million`;
  return n.toLocaleString("en-US");
}

function liveParagraph(live: LiveNumbers | null): string | null {
  if (!live) return null;
  const sentences: string[] = [];
  if (usable(live.tokensAllTime)) {
    sentences.push(
      `Since launch, developers have logged ${formatBigNumber(live.tokensAllTime)} Claude Code tokens on CCgather.`
    );
  }
  if (usable(live.tokens30d)) {
    const daily = formatBigNumber(live.tokens30d / 30);
    sentences.push(
      `In the last 30 days ${sentences.length ? "they" : "developers"} logged ${formatBigNumber(live.tokens30d)}, about ${daily} a day.`
    );
  }
  if (usable(live.developers) && usable(live.countries)) {
    sentences.push(
      `${live.developers.toLocaleString("en-US")} developers from ${live.countries} countries have joined.`
    );
  }
  if (sentences.length === 0) return null;
  return `**Live (updated hourly, as of ${live.asOf} UTC):** ${sentences.join(" ")}`;
}

function latestUpdate(): string | null {
  const latest = CHANGELOG[0];
  return latest ? `Latest update (${latest.date}): ${latest.title}.`.replace(/\.\.$/, ".") : null;
}

const LINK_SECTIONS: { title: string; links: { name: string; url: string; notes: string }[] }[] = [
  {
    title: "Leaderboard and stats",
    links: [
      {
        name: "Claude Code leaderboard",
        url: `${SITE_URL}/leaderboard`,
        notes:
          "global ranking by tokens or cost, opening on the last 30 days, with 1-day, 7-day and all-time tabs and country leagues",
      },
      {
        name: "All-time Claude Code leaderboard",
        url: `${SITE_URL}/leaderboard?period=all`,
        notes: "every developer ranked by lifetime tokens or cost",
      },
      {
        name: "This month's season",
        url: `${SITE_URL}/stats#season-sprint`,
        notes: "the monthly Season Sprint race; each finished month is kept in the hall of fame",
      },
      {
        name: "Live stats",
        url: `${SITE_URL}/stats`,
        notes: "developers and countries, 30-day tokens and sessions, and the model mix",
      },
      { name: "CCgather home", url: `${SITE_URL}/`, notes: "what CCgather is and how to join" },
    ],
  },
  {
    title: "CLI",
    links: [
      {
        name: "ccgather on npm",
        url: "https://www.npmjs.com/package/ccgather",
        notes:
          "`npx ccgather` opens a menu to sign in, submit, and turn daily auto-submit on or off",
      },
      {
        name: "CLI guide",
        url: "https://github.com/DHxWhy/CCgather#cli",
        notes: "scheduled submits, auto-submit on each OS, exit codes",
      },
    ],
  },
  {
    title: "Project",
    links: [
      {
        name: "Source code",
        url: "https://github.com/DHxWhy/CCgather",
        notes: "the web app (Next.js, Supabase) and the CLI (packages/cli), Apache 2.0",
      },
      {
        name: "DHxWhy on GitHub",
        url: "https://github.com/DHxWhy",
        notes: "the creator of CCgather, a non-developer in South Korea",
      },
      {
        name: "Privacy policy",
        url: `${SITE_URL}/privacy`,
        notes: "what is collected and how to delete your account",
      },
      { name: "Terms of service", url: `${SITE_URL}/terms`, notes: "terms of use" },
    ],
  },
  {
    title: "Optional",
    links: [
      {
        name: "Developer story on Qiita",
        url: "https://qiita.com/DHxWhy/items/bde99e8d6b7192d2adf2",
        notes: "how a non-developer built CCgather with Claude Code",
      },
      {
        name: "Product Hunt launch",
        url: "https://www.producthunt.com/products/ccgather",
        notes: "launch page and user reviews",
      },
      {
        name: "Demo video",
        url: "https://youtu.be/cK-RD1ke73I",
        notes: "a short tour of CCgather",
      },
    ],
  },
];

function linkSections(): string[] {
  return LINK_SECTIONS.flatMap((section) => [
    `## ${section.title}`,
    "",
    ...section.links.map((link) => `- [${link.name}](${link.url}): ${link.notes}`),
    "",
  ]);
}

const HOW_IT_COUNTS =
  "**How it counts:** Tokens are input + output + cache writes + cache reads, the same definition ccusage uses, and each Claude Code response is counted once. Costs use Anthropic's official API prices, synced hourly.";

const WHAT_IS_SENT =
  "**What the CLI sends:** daily token and cost totals per model, session counts, one-way session fingerprints that stop the same session from being submitted twice, a one-way device ID, the CLI version and your Claude plan type. Never prompts, conversations, code, file contents or file paths. Your GitHub username, avatar and country appear on the public leaderboard.";

const PROFILE_LINKS =
  "**Profile links:** `https://ccgather.com/leaderboard?u={GitHub username}` opens a developer's public profile: level, rank, badges and daily activity.";

const GETTING_STARTED =
  "**Getting started:** sign in with GitHub at https://ccgather.com, run `npx ccgather@latest`, then `npx ccgather@latest autosubmit on` to submit once a day automatically on Windows, macOS or Linux. Claude Code keeps about 30 days of local logs; CCgather keeps your daily totals after that.";

const WHY_IT_EXISTS =
  "**Why it exists:** Claude Code clears its local logs after about 30 days, and the usage history goes with them. CCgather was built by [DHxWhy](https://github.com/DHxWhy), a non-developer in South Korea who wanted to keep that record, because every token is a trace of the spirit of exploration (another attempt, another experiment), not a measure of skill.";

function projectParagraph(): string {
  const update = latestUpdate();
  return `**Project:** free with no paid tier, Apache 2.0 licensed, built with Claude Code and launched on Product Hunt on February 2, 2026.${update ? ` ${update}` : ""}`;
}

const summary = () => `> ${SITE_ONE_LINER.replace("npx ccgather", "`npx ccgather`")}`;

function paragraphs(live: LiveNumbers | null): string[] {
  const numbers = liveParagraph(live);
  return [
    ...(numbers ? [numbers] : []),
    HOW_IT_COUNTS,
    WHAT_IS_SENT,
    PROFILE_LINKS,
    GETTING_STARTED,
    WHY_IT_EXISTS,
    projectParagraph(),
  ].flatMap((paragraph) => [paragraph, ""]);
}

export function buildLlmsTxt(live: LiveNumbers | null): string {
  return ["# CCgather", "", summary(), "", ...paragraphs(live), ...linkSections()]
    .join("\n")
    .trimEnd()
    .concat("\n");
}

export function buildLlmsFullTxt(live: LiveNumbers | null): string {
  const levelRows = LEVELS.map(
    (level, index) =>
      `- Level ${level.level} ${level.icon} ${level.name}: from ${formatTokenThreshold(level.minTokens)} tokens${index === LEVELS.length - 1 ? " and up" : ""}`
  );
  const updates = CHANGELOG.slice(0, 5).flatMap((entry) => [
    `- ${entry.date} (${entry.category}) ${entry.title}: ${entry.summary}`,
    ...(entry.points ?? []).map((point) => `  - ${point}`),
  ]);
  return [
    "# CCgather (full version)",
    "",
    summary(),
    "",
    ...paragraphs(live),
    "## Features",
    "",
    ...SITE_FEATURES.map((feature) => `- ${feature}`),
    "",
    "## Levels",
    "",
    ...levelRows,
    "",
    "## Badges",
    "",
    `${badgesSentence()}. By rarity: ${raritySentence()}.`,
    "",
    "## FAQ",
    "",
    ...SITE_FAQ.flatMap((faq) => [`**${faq.question}** ${faq.answer}`, ""]),
    "## Recent updates",
    "",
    ...updates,
    "",
    ...linkSections(),
  ]
    .join("\n")
    .trimEnd()
    .concat("\n");
}
