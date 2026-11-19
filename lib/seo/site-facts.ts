import { BADGES, type Badge } from "@/lib/constants/badges";
import { LEVELS } from "@/lib/constants/levels";

/**
 * What CCgather says about itself in structured data, llms.txt and the README. Counts come from
 * the badge and level definitions, so a new badge or level cannot leave these texts behind.
 */
export const SITE_URL = "https://ccgather.com";

export const SITE_ONE_LINER =
  "CCgather is a free, open-source leaderboard for Claude Code usage. Run npx ccgather to sync your daily Claude Code token usage and estimated cost, then see where you rank worldwide, in your country and in monthly seasons.";

const BADGE_CATEGORY_WORDS: Record<Badge["category"], string> = {
  streak: "daily streaks",
  tokens: "token milestones",
  rank: "rank",
  model: "models",
  journey: "sessions and spend",
  community: "referrals, a GitHub star and auto-submit",
};

const RARITY_ORDER: Badge["rarity"][] = ["common", "rare", "epic", "legendary"];

function joinWithAnd(items: string[]): string {
  return items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

export function formatTokenThreshold(tokens: number): string {
  if (tokens >= 1_000_000_000) return `${tokens / 1_000_000_000}B`;
  if (tokens >= 1_000_000) return `${tokens / 1_000_000}M`;
  return tokens.toLocaleString("en-US");
}

export function badgesSentence(): string {
  const categories = (Object.keys(BADGE_CATEGORY_WORDS) as Badge["category"][])
    .map((category) => ({
      word: BADGE_CATEGORY_WORDS[category],
      count: BADGES.filter((badge) => badge.category === category).length,
    }))
    .filter((category) => category.count > 0);
  return `${BADGES.length} badges in ${categories.length} categories: ${joinWithAnd(
    categories.map((category) => `${category.word} (${category.count})`)
  )}`;
}

export function raritySentence(): string {
  return joinWithAnd(
    RARITY_ORDER.map(
      (rarity) => `${BADGES.filter((badge) => badge.rarity === rarity).length} ${rarity}`
    )
  );
}

export function levelsSentence(): string {
  return joinWithAnd(
    LEVELS.map((level, index) => {
      const from = formatTokenThreshold(level.minTokens);
      return `${level.name} (${from}${index === LEVELS.length - 1 ? "+" : ""})`;
    })
  );
}

export const SITE_FEATURES: string[] = [
  "Claude Code leaderboard ranked by tokens or cost over 1 day, 7 days, 30 days or all time",
  "Country leagues: the same ranking among developers in your country",
  "Live stats: developers, countries, 30-day tokens and sessions, and the model mix",
  "Monthly Season Sprint, with a hall of fame for every finished month",
  `Developer profiles with ${LEVELS.length} levels, ${BADGES.length} badges, a daily activity heatmap and the Claude plan`,
  "Daily auto-submit through the operating system's scheduler on Windows, macOS and Linux",
  "Tokens counted the way ccusage counts them, priced at Anthropic's official API rates",
  "Installable web app with push notifications",
  "Open source under the Apache 2.0 license",
];

export const SITE_FAQ: { question: string; answer: string }[] = [
  {
    question: "What is CCgather?",
    answer: `${SITE_ONE_LINER} It is free and open source under the Apache 2.0 license.`,
  },
  {
    question: "How do I track my Claude Code usage?",
    answer:
      "Sign in with GitHub at ccgather.com and run npx ccgather@latest in your terminal. To submit once a day automatically, run npx ccgather@latest autosubmit on (Windows, macOS and Linux). Claude Code keeps about 30 days of local logs; CCgather keeps your daily totals after that.",
  },
  {
    question: "What does CCgather show?",
    answer:
      "A Claude Code leaderboard by tokens or cost over 1 day, 7 days, 30 days or all time, with country leagues; live stats with a monthly Season Sprint and hall of fame; and a profile for every developer with their level, badges, daily activity heatmap and Claude plan.",
  },
  {
    question: "Why was CCgather built?",
    answer:
      "Claude Code clears its local logs after about 30 days, and the usage history goes with them. CCgather's creator, a non-developer in South Korea, wanted to keep that record, because every token is a trace of the spirit of exploration (another attempt, another experiment), not a measure of skill.",
  },
  {
    question: "Is CCgather free to use?",
    answer:
      "Yes. CCgather is free and open source under the Apache 2.0 license, with no paid tier. The source code is on GitHub at github.com/DHxWhy/CCgather.",
  },
  {
    question: "Does CCgather collect my code or prompts?",
    answer:
      "No. The CLI sends daily token and cost totals per model, session counts, one-way session fingerprints that stop the same session from being submitted twice, a one-way device ID, the CLI version and your Claude plan type. Prompts, conversations, code, file contents and file paths never leave your machine. Your GitHub username, avatar and country appear on the public leaderboard.",
  },
  {
    question: "How does CCgather count tokens?",
    answer:
      "Tokens are input + output + cache writes + cache reads, the same definition ccusage uses, and each Claude Code response is counted once. Costs use Anthropic's official API prices, synced hourly.",
  },
  {
    question: "How do levels and badges work?",
    answer: `There are ${LEVELS.length} levels by total tokens: ${levelsSentence()}. There are ${badgesSentence()}.`,
  },
  {
    question: "What is the CCgather CLI?",
    answer:
      "The ccgather package on npm. npx ccgather opens a menu to sign in, submit and turn daily auto-submit on or off; npx ccgather@latest submit submits without any prompt, so a scheduler can run it.",
  },
];
