import { execFileSync } from "child_process";
import * as readline from "readline";
import open from "open";
import type Conf from "conf";
import type { CliConfig } from "./config.js";
import { colors, link } from "./ui.js";

const REPO_SLUG = "DHxWhy/CCgather";
export const REPO_URL = `https://github.com/${REPO_SLUG}`;
const GH_TIMEOUT_MS = 10_000;

export interface StarPromptState {
  hasStarred: boolean | null | undefined;
  isTTY: boolean;
  starConfirmed?: boolean;
  hasSubmittedBefore: boolean;
}

// After a decline the prompt comes back every STAR_REPROMPT_INTERVAL submits.
export const STAR_REPROMPT_INTERVAL = 2;

export interface StarPromptMessage {
  title: string;
  body: string;
  question: string;
}

// One per decline so far, wrapping around after the last.
export const STAR_PROMPT_MESSAGES: readonly StarPromptMessage[] = [
  {
    title: "Support CCgather with a star ⭐",
    body: "CCgather is free and open source. A star helps other developers find it.",
    question: "Would you like to star CCgather?",
  },
  {
    title: "A star helps us keep going ⭐",
    body: "If CCgather has been useful to you, please consider starring it on GitHub.",
    question: "Would you star CCgather on GitHub?",
  },
  {
    title: "Help more developers find CCgather ⭐",
    body: "Stars are how open source projects get discovered. Yours would help.",
    question: "Will you give CCgather a star?",
  },
  {
    title: "CCgather runs on community support ⭐",
    body: "The leaderboard is free to use. A star is the simplest way to support it.",
    question: "Support CCgather with a star?",
  },
  {
    title: "Thank you for using CCgather ⭐",
    body: "If you'd like to see it keep improving, a GitHub star means a lot to us.",
    question: "Would you consider starring CCgather?",
  },
];

// Policy (2026-10-03): stay quiet on the very first submit, then ask until the
// server confirms a star — "keep asking until starred" is the product decision.
// A decline is remembered only to space the next ask and rotate the message.
export function shouldPromptStar(state: StarPromptState): boolean {
  if (!state.isTTY) {
    return false;
  }
  if (!state.hasSubmittedBefore) {
    return false;
  }
  if (state.starConfirmed) {
    return false;
  }
  if (state.hasStarred === true) {
    return false;
  }
  return true;
}

// The server learns about a star only through this status check, and the
// Stargazer badge depends on it. A star made through the gh CLI sets
// starConfirmed locally but the server has not seen it yet — keep asking.
export function shouldRequestStarStatus(state: {
  hasSubmittedBefore: boolean;
  starServerConfirmed?: boolean;
}): boolean {
  return state.hasSubmittedBefore && !state.starServerConfirmed;
}

// Ctrl+C here must decline-and-continue, not abort the whole submit — inquirer
// turns SIGINT into process.kill(pid), so a plain readline prompt is used instead.
function askYesNo(question: string): Promise<"yes" | "no"> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    let settled = false;
    const settle = (value: "yes" | "no") => {
      if (!settled) {
        settled = true;
        rl.close();
        resolve(value);
      }
    };
    rl.on("SIGINT", () => {
      process.stdout.write("\n");
      settle("no");
    });
    rl.question(question, (answer) => {
      const normalized = answer.trim().toLowerCase();
      settle(normalized === "n" || normalized === "no" ? "no" : "yes");
    });
  });
}

// Call once per eligible submit: true means show the prompt now, false means
// this submit was one of the quiet ones after a decline.
export function takeStarPromptTurn(config: Conf<CliConfig>): boolean {
  const snooze = config.get("starPromptSnooze") ?? 0;
  if (snooze > 0) {
    config.set("starPromptSnooze", snooze - 1);
    return false;
  }
  return true;
}

export async function promptStarNudge(config: Conf<CliConfig>): Promise<void> {
  try {
    const declineCount = config.get("starDeclineCount") ?? 0;
    const message = STAR_PROMPT_MESSAGES[declineCount % STAR_PROMPT_MESSAGES.length];

    console.log();
    console.log(`  ${colors.cyan(message.title)}`);
    console.log(`  ${colors.muted(message.body)}`);
    console.log(`  ${link(REPO_URL)}`);
    console.log(
      colors.dim("  (Uses your local gh CLI if available, otherwise opens your browser)")
    );
    console.log();

    const answer = await askYesNo(`  ⭐ ${message.question} (Y/n): `);

    if (answer === "no") {
      config.set("starDeclineCount", declineCount + 1);
      config.set("starPromptSnooze", STAR_REPROMPT_INTERVAL - 1);
      console.log();
      return;
    }

    const starredViaGh = await starViaGhOrBrowser();
    if (starredViaGh) {
      config.set("starConfirmed", true);
    }
  } catch (error) {
    console.log(
      colors.dim(`  Star prompt skipped: ${error instanceof Error ? error.message : String(error)}`)
    );
  }
}

async function starViaGhOrBrowser(): Promise<boolean> {
  try {
    execFileSync("gh", ["api", "--silent", "--method", "PUT", `/user/starred/${REPO_SLUG}`], {
      stdio: "pipe",
      timeout: GH_TIMEOUT_MS,
    });
    console.log(
      `  ${colors.success("✓")} ${colors.white("Starred via gh CLI! Thank you for your support.")}`
    );
    console.log();
    return true;
  } catch {
    console.log(
      colors.dim("  Couldn't star via gh CLI — opening GitHub in your browser instead...")
    );
  }

  try {
    await open(REPO_URL);
    console.log(`  ${colors.white("Hit the ⭐ button on the opened page to support us!")}`);
  } catch {
    console.log(`  ${colors.muted("Visit")} ${link(REPO_URL)} ${colors.muted("to star us!")}`);
  }
  console.log();
  return false;
}
