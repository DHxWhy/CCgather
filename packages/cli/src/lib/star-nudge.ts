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

// Policy (2026-08-06): stay quiet on the very first submit, then ask on every
// submit until the server confirms a star. Declines are deliberately NOT
// remembered — "keep asking until starred" is the product decision.
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

export async function promptStarNudge(config: Conf<CliConfig>): Promise<void> {
  try {
    console.log();
    console.log(`  ${colors.cyan("Help us grow! ⭐")}`);
    console.log(
      `  ${colors.muted("CCgather is open source — starring helps others discover it.")}`
    );
    console.log(`  ${link(REPO_URL)}`);
    console.log(
      colors.dim("  (Uses your local gh CLI if available, otherwise opens your browser)")
    );
    console.log();

    const answer = await askYesNo(`  ⭐ Would you like to star CCgather? (Y/n): `);

    if (answer === "no") {
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
