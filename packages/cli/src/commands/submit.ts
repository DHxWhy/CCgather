import * as os from "os";
import ora from "ora";
import inquirer from "inquirer";
import type Conf from "conf";
import { getApiUrl, getConfig } from "../lib/config.js";
import type { CliConfig } from "../lib/config.js";
import { getDeviceId } from "../lib/device.js";
import {
  scanAllProjects,
  getAllSessionsCount,
  hasAnySessions,
  CCGatherData,
  DailyUsage,
  SessionFingerprint,
  hasOpusUsageInProject,
  getSessionPathDebugInfo,
} from "../lib/ccgather-json.js";
import { initPricing } from "../lib/pricing.js";
import {
  findCandidateClaudeDirs,
  saveShellClaudeDirs,
  savedShellDirsNotice,
} from "../lib/claude-dirs.js";
import { SCHEDULED_MIN_INTERVAL_MS } from "../lib/autosubmit/shared.js";
import {
  shouldPromptStar,
  shouldRequestStarStatus,
  takeStarPromptTurn,
  promptStarNudge,
  REPO_URL,
} from "../lib/star-nudge.js";
import {
  VERSION,
  colors,
  formatNumber,
  formatCost,
  header,
  error,
  link,
  progressBar,
  getLevelProgress,
  createBox,
  getDisplayWidth,
} from "../lib/ui.js";

interface UsageData {
  totalTokens: number;
  totalCost: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  daysTracked: number;
  firstUsed: string | null;
  lastUsed: string | null;
  // Plan info for badge display (not for league placement)
  ccplan?: string | null;
  rateLimitTier?: string | null;
  authMethod?: string;
  rawSubscriptionType?: string | null;
  dailyUsage: DailyUsage[];
  sessionFingerprint?: SessionFingerprint;
  // Opus detection for badge display
  hasOpusUsage?: boolean;
  opusModels?: string[];
}

export interface SubmitOptions {
  // Scheduler mode (`ccgather submit`): never prompt or animate, print one result
  // line, and exit non-zero on any failure
  nonInteractive?: boolean;
  // The job `ccgather autosubmit` registers (`ccgather submit --scheduled`):
  // non-interactive, and skips a run within SCHEDULED_MIN_INTERVAL_MS of the
  // last submission
  scheduled?: boolean;
}

// The daily trigger and the catch-up or logon trigger can both fire on one day
export { SCHEDULED_MIN_INTERVAL_MS };

interface BadgeInfo {
  id: string;
  name: string;
  icon: string;
  description: string;
  praise?: string;
  rarity: "common" | "rare" | "epic" | "legendary";
  category: "streak" | "tokens" | "rank" | "model" | "social";
  earnedAt?: string;
}

interface PreviousDailyData {
  date: string;
  tokens: number;
  cost: number;
}

interface PreviousSubmission {
  totalTokens: number;
  totalCost: number;
  lastSubmissionAt: string;
  sessionCount?: number;
  previousDates?: string[];
  previousDaily?: PreviousDailyData[];
  previousGlobalRank?: number | null;
  previousCountryRank?: number | null;
  previousLevel?: number;
}

interface DeviceInfo {
  totalDevices: number;
  thisDeviceTokens: number;
  thisDeviceCost: number;
  otherDevicesTokens: number;
  otherDevicesCost: number;
  combinedTokens: number;
  combinedCost: number;
}

interface SubmitResponse {
  success: boolean;
  profileUrl?: string;
  rank?: number;
  countryRank?: number;
  currentLevel?: number;
  newBadges?: BadgeInfo[];
  totalBadges?: number;
  error?: string;
  code?: string; // the server's reason, e.g. DUPLICATE_SESSION
  hint?: string; // the server's next step for the user
  retryAfterMinutes?: number;
  previous?: PreviousSubmission;
  deviceInfo?: DeviceInfo;
  // Server-computed cumulative totals (after this submission was applied).
  // Used for level progress calculation against the true accumulated value.
  accumulatedTokens?: number;
  accumulatedCost?: number;
}

/** Shown once, after the first interactive submit with this version. */
export const COUNTING_NOTICE =
  "This version counts usage the way ccusage does: your token total can rise a little and your cost more (output counted in full, 1-hour cache writes, fast mode). Details: What's new on ccgather.com.";

/** Added to a refused submit when another account owns sessions and extra folders are read. */
export const DUPLICATE_SESSION_ADVICE =
  "If a data folder you added belongs to another CCgather account, choose folders again and uncheck it: npx ccgather > Settings > Data folders.";

/** Added to that advice while CLAUDE_CONFIG_DIR is set: its folders are saved again each time. */
export const SHELL_FOLDER_ADVICE =
  "Folders named in CLAUDE_CONFIG_DIR are always counted, so do this in a terminal without it.";

/** The question about data folders found on disk. */
export function otherFoldersQuestion(count: number): string {
  const found =
    count === 1
      ? "Another Claude Code data folder found on this computer. Count it too?"
      : "Other Claude Code data folders found on this computer. Count them too?";
  return `${found} (CCgather treats one computer as one person; a session found twice counts once)`;
}

/** Added when a non-interactive run finds no sessions but data folders wait for an answer. */
export function unconfirmedFoldersHint(count: number): string {
  return count === 1
    ? "1 other data folder found; run `npx ccgather` once to choose it."
    : `${count} other data folders found; run \`npx ccgather\` once to choose them.`;
}

/** Shown after Settings > Data folders forgets the folder answers. */
export const FOLDER_CHOICES_CLEARED =
  "Folder choices cleared. Your next submit from this menu asks again about other Claude Code data folders it finds (a folder set in CLAUDE_CONFIG_DIR is counted without asking). Until then, scheduled submits read only the default folders.";

/** How long a non-interactive request may wait for the server before it is abandoned */
const NON_INTERACTIVE_TIMEOUT_MS = 120_000;

/** Time limit for a request: only a scheduler run gets one, interactive runs have none */
function requestSignal(nonInteractive: boolean): AbortSignal | undefined {
  return nonInteractive ? AbortSignal.timeout(NON_INTERACTIVE_TIMEOUT_MS) : undefined;
}

/** Error text for a failed request, with a clear message when the time limit was hit */
function describeRequestError(err: unknown): string {
  if (err instanceof Error && err.name === "TimeoutError") {
    return `no response from the server within ${NON_INTERACTIVE_TIMEOUT_MS / 1000} seconds`;
  }
  return err instanceof Error ? err.message : "Unknown error";
}

/**
 * Report submit attempt to server for debugging
 * This helps track users who try to submit but fail before data is sent
 */
async function reportSubmitAttempt(
  reason: "no_sessions" | "no_data" | "scan_failed",
  debugInfo?: { searchedPaths?: { path: string; exists: boolean }[]; projectsFound?: number },
  nonInteractive: boolean = false
): Promise<void> {
  try {
    const config = getConfig();
    const apiUrl = getApiUrl();
    const token = config.get("apiToken");

    await fetch(`${apiUrl}/cli/submit-attempt`, {
      signal: requestSignal(nonInteractive),
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: JSON.stringify({
        reason,
        debugInfo,
        cliVersion: process.env.npm_package_version || "unknown",
        platform: process.platform,
      }),
    });
  } catch {
    // Silently ignore - this is just for logging
  }
}

/**
 * Convert CCGatherData to UsageData
 */
function ccgatherToUsageData(data: CCGatherData): UsageData {
  // Check for Opus usage (for badge display)
  const opusCheck = hasOpusUsageInProject(data.dailyUsage);

  return {
    totalTokens: data.usage.totalTokens,
    totalCost: data.usage.totalCost,
    inputTokens: data.usage.inputTokens,
    outputTokens: data.usage.outputTokens,
    cacheReadTokens: data.usage.cacheReadTokens,
    cacheWriteTokens: data.usage.cacheWriteTokens,
    daysTracked: data.stats.daysTracked,
    firstUsed: data.stats.firstUsed,
    lastUsed: data.stats.lastUsed,
    ccplan: data.account?.ccplan || null,
    rateLimitTier: data.account?.rateLimitTier || null,
    authMethod: data.account?.authMethod || "unknown",
    rawSubscriptionType: data.account?.rawSubscriptionType || null,
    dailyUsage: data.dailyUsage || [],
    sessionFingerprint: data.sessionFingerprint,
    hasOpusUsage: opusCheck.detected,
    opusModels: opusCheck.opusModels,
  };
}

/**
 * Submit data to CCgather API with token authentication
 */
async function submitToServer(
  data: UsageData,
  nonInteractive: boolean,
  scheduled: boolean
): Promise<SubmitResponse> {
  const apiUrl = getApiUrl();
  const config = getConfig();
  const apiToken = config.get("apiToken");

  if (!apiToken) {
    return { success: false, error: "Not authenticated." };
  }

  try {
    const response = await fetch(`${apiUrl}/cli/submit`, {
      signal: requestSignal(nonInteractive),
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiToken}`,
      },
      body: JSON.stringify({
        totalTokens: data.totalTokens,
        totalSpent: data.totalCost,
        inputTokens: data.inputTokens,
        outputTokens: data.outputTokens,
        cacheReadTokens: data.cacheReadTokens,
        cacheWriteTokens: data.cacheWriteTokens,
        daysTracked: data.daysTracked,
        // Plan info for badge display (not league placement). A scheduled run has no shell
        // environment (API key, provider variables) to read it from, so it sends none and
        // the server keeps the stored plan.
        ...(scheduled
          ? {}
          : {
              ccplan: data.ccplan,
              rateLimitTier: data.rateLimitTier,
              authMethod: data.authMethod,
              rawSubscriptionType: data.rawSubscriptionType,
            }),
        timestamp: new Date().toISOString(),
        dailyUsage: data.dailyUsage,
        // Session fingerprint for duplicate prevention
        sessionFingerprint: data.sessionFingerprint,
        // Opus info for badge display
        hasOpusUsage: data.hasOpusUsage,
        opusModels: data.opusModels,
        // Multi-device support
        deviceId: getDeviceId(),
        // Lets the server tell CLI generations apart (e.g. the 2.2 session definition)
        cliVersion: VERSION,
        // The autosubmit job marks its submits; the server records them for the admin page
        ...(scheduled ? { scheduled: true } : {}),
      }),
    });

    if (!response.ok) {
      const errorData = (await response.json().catch(() => ({}))) as {
        error?: string;
        code?: string;
        retryAfterMinutes?: number;
        hint?: string;
      };

      // Handle rate limit error specially
      if (response.status === 429 && errorData.retryAfterMinutes) {
        return {
          success: false,
          error: errorData.error || "Rate limit exceeded",
          retryAfterMinutes: errorData.retryAfterMinutes,
        };
      }

      return {
        success: false,
        error: errorData.error || `HTTP ${response.status}`,
        code: errorData.code,
        hint: errorData.hint,
      };
    }

    const result = (await response.json()) as SubmitResponse;
    return { ...result, success: true };
  } catch (err) {
    return { success: false, error: describeRequestError(err) };
  }
}

/**
 * Get rarity color for badge
 */
function getRarityColor(rarity: string): (text: string) => string {
  switch (rarity) {
    case "legendary":
      return colors.max; // Gold
    case "epic":
      return colors.team; // Purple
    case "rare":
      return colors.pro; // Blue
    default:
      return colors.muted; // Gray
  }
}

/**
 * Format date for display
 */
function formatBadgeDate(dateStr?: string): string {
  if (!dateStr) return new Date().toISOString().split("T")[0].replace(/-/g, ".");
  return dateStr.split("T")[0].replace(/-/g, ".");
}

/**
 * Display newly earned badges (instant, no delays)
 */
function displayNewBadges(badges: BadgeInfo[]): void {
  if (badges.length === 0) return;

  console.log();

  for (const badge of badges) {
    const rarityColor = getRarityColor(badge.rarity);
    const rarityLabel = badge.rarity.toUpperCase();

    console.log(
      `     ✨ ${badge.icon} ${colors.white.bold(badge.name)} ${rarityColor(`[${rarityLabel}]`)}`
    );
    console.log(`        ${colors.muted(badge.description)}`);

    if (badge.praise) {
      console.log(`        ${colors.cyan(`"${badge.praise}"`)}`);
    }

    if (badge.category === "rank") {
      console.log(`        ${colors.dim(`📅 Achieved: ${formatBadgeDate(badge.earnedAt)}`)}`);
    }
  }
}

/**
 * Verify token validity with server
 */
async function verifyToken(
  requestStarStatus: boolean,
  nonInteractive: boolean
): Promise<{
  valid: boolean;
  username?: string;
  hasStarred?: boolean | null;
  // Why verification failed: no saved token, token refused, or server not reachable
  failure?: "missing" | "rejected" | "unavailable";
  error?: string;
}> {
  const apiUrl = getApiUrl();
  const config = getConfig();
  const apiToken = config.get("apiToken");

  if (!apiToken) {
    return { valid: false, failure: "missing" };
  }

  try {
    const response = await fetch(
      `${apiUrl}/cli/verify${requestStarStatus ? "?star_status=1" : ""}`,
      {
        signal: requestSignal(nonInteractive),
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiToken}`,
        },
      }
    );

    if (!response.ok) {
      const rejected = response.status === 401 || response.status === 403;
      return {
        valid: false,
        failure: rejected ? "rejected" : "unavailable",
        error: `HTTP ${response.status}`,
      };
    }

    const data = (await response.json()) as {
      userId: string;
      username: string;
      hasStarred?: boolean | null;
    };
    return { valid: true, username: data.username, hasStarred: data.hasStarred };
  } catch (err) {
    return {
      valid: false,
      failure: "unavailable",
      error: describeRequestError(err),
    };
  }
}

/**
 * Print one plain, timestamped line for scheduler logs (no colour, spinner or link)
 */
export function logResult(message: string, isError: boolean = false): void {
  const line = `[${new Date().toISOString()}] ccgather: ${message}`;
  if (isError) {
    console.error(line);
  } else {
    console.log(line);
  }
}

/**
 * How long ago something happened, rounded down: "less than a minute ago",
 * "5 minutes ago", "3 hours ago"
 */
export function formatAgo(elapsedMs: number): string {
  const minutes = Math.floor(elapsedMs / 60_000);
  if (minutes < 1) return "less than a minute ago";
  if (minutes < 60) return minutes === 1 ? "1 minute ago" : `${minutes} minutes ago`;
  const hours = Math.floor(minutes / 60);
  return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
}

/**
 * Keep a scheduled run's result line for `autosubmit status`. Writing it is
 * best effort: it must never change the run's output or exit code.
 */
function recordScheduledRun(
  config: Conf<CliConfig>,
  message: string,
  summary: string,
  isError: boolean
): void {
  try {
    config.set("lastScheduledRun", {
      at: new Date().toISOString(),
      ok: !isError,
      message,
      summary,
    });
  } catch {
    // The run's own log line is the record of last resort
  }
}

/**
 * Other Claude Code data folders on this computer (one computer is one person). Folders the
 * shell's CLAUDE_CONFIG_DIR points to are saved without asking, so a scheduled run, which
 * does not get the variable, reads them too; folders found on disk are asked about once.
 */
async function confirmOtherClaudeDirs(config: Conf<CliConfig>): Promise<void> {
  const fromShell = saveShellClaudeDirs(config, process.env, os.homedir());
  if (fromShell.length > 0) {
    console.log(`\n  ${colors.muted(savedShellDirsNotice(fromShell))}`);
  }

  const claudeDirs = config.get("claudeDirs") ?? [];
  const declinedClaudeDirs = config.get("declinedClaudeDirs") ?? [];
  const candidates = findCandidateClaudeDirs(process.env, os.homedir(), {
    claudeDirs,
    declinedClaudeDirs,
  });
  if (candidates.length === 0) return;

  console.log();
  const { include } = await inquirer.prompt([
    {
      type: "checkbox",
      name: "include",
      message: otherFoldersQuestion(candidates.length),
      choices: candidates.map((dir) => ({ name: dir, value: dir, checked: true })),
    },
  ]);
  const chosen = Array.isArray(include)
    ? include.filter((dir): dir is string => typeof dir === "string")
    : [];
  config.set("claudeDirs", [...claudeDirs, ...chosen]);
  config.set("declinedClaudeDirs", [
    ...declinedClaudeDirs,
    ...candidates.filter((dir) => !chosen.includes(dir)),
  ]);
}

// The server refuses sessions another account already submitted. With extra data folders
// counted, the likely cause is a folder that belongs to someone else's CCgather account.
function duplicateSessionAdvice(config: Conf<CliConfig>, result: SubmitResponse): string | null {
  if (result.code !== "DUPLICATE_SESSION") return null;
  if ((config.get("claudeDirs") ?? []).length === 0) return null;
  return process.env.CLAUDE_CONFIG_DIR?.trim()
    ? `${DUPLICATE_SESSION_ADVICE} ${SHELL_FOLDER_ADVICE}`
    : DUPLICATE_SESSION_ADVICE;
}

/**
 * Get plan display color
 */
function getPlanColor(plan: string): (text: string) => string {
  switch (plan.toLowerCase()) {
    case "max":
      return colors.max;
    case "pro":
      return colors.pro;
    case "team":
      return colors.team;
    case "enterprise":
      return colors.team;
    default:
      return colors.free;
  }
}

/**
 * Main submit command (v2.0 - Level-based league system)
 *
 * Simplified flow:
 * 1. Authenticate
 * 2. Scan ALL projects (no per-project selection)
 * 3. Display summary with plan badge
 * 4. Submit to leaderboard
 *
 * Ranking is now based purely on token usage (level-based leagues)
 *
 * With options.nonInteractive the same pipeline runs without any prompt,
 * header, spinner or progress bar, and every failure exits with code 1.
 */
export async function submit(options: SubmitOptions = {}): Promise<void> {
  const scheduled = options.scheduled === true;
  const nonInteractive = options.nonInteractive === true || scheduled;

  if (!nonInteractive) {
    console.log(header("Submit Usage Data", "📤"));
  }

  const config = getConfig();

  // The one result line of a non-interactive run; a scheduled run also keeps it,
  // with a short summary for `autosubmit status`
  const report = (message: string, summary: string, isError: boolean = false): void => {
    logResult(message, isError);
    if (scheduled) recordScheduledRun(config, message, summary, isError);
  };

  if (scheduled) {
    const lastSync = config.get("lastSync");
    const age = lastSync ? Date.now() - Date.parse(lastSync) : Number.NaN;
    // A lastSync in the future (clock moved back) does not count as recent
    if (age >= 0 && age < SCHEDULED_MIN_INTERVAL_MS) {
      report(`Skipped: submitted ${formatAgo(age)}.`, `skipped: submitted ${formatAgo(age)}`);
      return;
    }
  }

  const isInteractive = !nonInteractive && Boolean(process.stdout.isTTY && process.stdin.isTTY);
  const starState = {
    isTTY: isInteractive,
    starConfirmed: config.get("starConfirmed") === true,
    hasSubmittedBefore: Boolean(config.get("lastSync")),
  };
  const starPromptCandidate = shouldPromptStar({ ...starState, hasStarred: null });
  const requestStarStatus = shouldRequestStarStatus({
    hasSubmittedBefore: starState.hasSubmittedBefore,
    starServerConfirmed: config.get("starServerConfirmed") === true,
  });

  // Verify token with server FIRST (before any scanning)
  const verifySpinner = nonInteractive
    ? null
    : ora({
        text: "Verifying authentication...",
        color: "cyan",
      }).start();

  const tokenCheck = await verifyToken(requestStarStatus, nonInteractive);

  if (!tokenCheck.valid && nonInteractive) {
    // Keep the saved token: a scheduled run cannot log in again, and a server
    // or network error must not wipe a token that is still valid
    if (tokenCheck.failure === "missing") {
      report("Not logged in. Run `npx ccgather` to log in.", "failed: not logged in", true);
    } else if (tokenCheck.failure === "rejected") {
      report(
        `Authentication refused by server (${tokenCheck.error}). If this keeps happening, run \`npx ccgather\` to log in again.`,
        `failed: authentication refused by server (${tokenCheck.error})`,
        true
      );
    } else {
      report(
        `Could not verify authentication (${tokenCheck.error}). Try again later.`,
        `failed: could not verify authentication (${tokenCheck.error})`,
        true
      );
    }
    process.exit(1);
  }

  if (!tokenCheck.valid) {
    verifySpinner?.stop();

    // Clear invalid token from local config
    config.delete("apiToken");
    config.delete("userId");
    config.delete("username");

    console.log();
    console.log(`  ${colors.warning("🔐")} ${colors.muted("Authentication required")}`);
    console.log();

    const { startAuth } = await inquirer.prompt([
      {
        type: "confirm",
        name: "startAuth",
        message: "Would you like to authenticate now?",
        default: true,
      },
    ]);

    if (startAuth) {
      const { auth } = await import("./auth.js");
      await auth({});
      console.log();
      // After successful auth, retry submit
      return submit(options);
    }
    return;
  }

  const username = tokenCheck.username || config.get("username");
  verifySpinner?.succeed(colors.success(`Authenticated as ${colors.white(username || "unknown")}`));

  if (tokenCheck.hasStarred === true) {
    config.set("starConfirmed", true);
    config.set("starServerConfirmed", true);
  } else if (
    starPromptCandidate &&
    shouldPromptStar({ ...starState, hasStarred: tokenCheck.hasStarred }) &&
    takeStarPromptTurn(config)
  ) {
    await promptStarNudge(config);
  }

  // Initialize dynamic pricing from LiteLLM (cached, non-blocking fallback)
  await initPricing();

  // Other Claude Code data folders on this computer (another account's CLAUDE_CONFIG_DIR):
  // one computer is one person, so ask once which to count and remember the answer. A
  // non-interactive run never asks; a manual one still saves the shell's folders, so the
  // scheduled runs after it count the same folders. A scheduled run reads the saved list.
  if (!nonInteractive) await confirmOtherClaudeDirs(config);
  else if (!scheduled) saveShellClaudeDirs(config, process.env, os.homedir());

  // ═══════════════════════════════════════════════════════════════════════════
  // SCAN ALL PROJECTS (v2.0 - Level-based League System)
  // No more per-project selection - scan everything for fair ranking
  // ═══════════════════════════════════════════════════════════════════════════

  // Check if any sessions exist
  if (!hasAnySessions()) {
    if (nonInteractive) {
      const debugInfo = getSessionPathDebugInfo();
      const searched = debugInfo.searchedPaths.map((pathInfo) => pathInfo.path).join(", ");
      const unconfirmed = findCandidateClaudeDirs(process.env, os.homedir(), {
        claudeDirs: config.get("claudeDirs") ?? [],
        declinedClaudeDirs: config.get("declinedClaudeDirs") ?? [],
      }).length;
      const hint = unconfirmed > 0 ? ` ${unconfirmedFoldersHint(unconfirmed)}` : "";
      report(
        `No Claude Code sessions found (searched: ${searched}).${hint}`,
        "failed: no Claude Code sessions found",
        true
      );
      await reportSubmitAttempt("no_sessions", debugInfo, true);
      process.exit(1);
    }

    console.log(`\n  ${error("No Claude Code sessions found.")}`);
    console.log();
    console.log(`  ${colors.muted("This usually means:")}`);
    console.log(`  ${colors.muted("  • You haven't used Claude Code yet, or")}`);
    console.log(`  ${colors.muted("  • You ran Claude Code but didn't send any messages")}`);
    console.log();
    console.log(
      `  ${colors.warning("💡 Tip:")} ${colors.muted("Sessions are only created after you")}`
    );
    console.log(`  ${colors.muted("   send at least one message in Claude Code.")}`);
    console.log();

    // Show debug info
    const debugInfo = getSessionPathDebugInfo();
    console.log(`  ${colors.dim("─".repeat(48))}`);
    console.log(`  ${colors.muted("Searched paths:")}`);
    for (const pathInfo of debugInfo.searchedPaths) {
      const status = pathInfo.exists ? colors.success("✓") : colors.error("✗");
      console.log(`    ${status} ${pathInfo.path}`);
    }
    console.log();

    // Report attempt to server for debugging (non-blocking)
    await reportSubmitAttempt("no_sessions", debugInfo);

    process.exit(1);
  }

  // Scan ALL projects
  let scannedData: CCGatherData | null;
  if (nonInteractive) {
    // A scheduled run sends no plan, so it does not read the sign-in (no Keychain prompt
    // from a LaunchAgent).
    scannedData = scanAllProjects({ readAccount: !scheduled });
  } else {
    console.log(`\n  ${colors.muted("Scanning all Claude Code sessions...")}`);

    const totalSessions = getAllSessionsCount();
    console.log(`  ${colors.dim(`Found ${totalSessions} session file(s)`)}`);

    let lastProgress = 0;
    scannedData = scanAllProjects({
      onProgress: (current, total) => {
        progressBar(current, total, "Scanning");
        lastProgress = current;
        // The bar is full but the scan has not returned yet — never leave a blank line
        if (current >= total) {
          process.stdout.write(`  ${colors.muted("Processing...")}`);
        }
      },
    });

    // Clear progress bar line and show processing message
    if (lastProgress > 0) {
      process.stdout.write("\r" + " ".repeat(60) + "\r");
    }
    process.stdout.write(`  ${colors.muted("Processing...")}`);
  }

  if (!scannedData) {
    if (nonInteractive) {
      report("No usage data found in Claude Code sessions.", "failed: no usage data found", true);
      await reportSubmitAttempt("no_data", undefined, true);
      process.exit(1);
    }

    process.stdout.write("\r" + " ".repeat(40) + "\r");
    console.log(`  ${colors.error("✗")} ${colors.error("No usage data found.")}`);
    console.log(`  ${colors.muted("Make sure you have used Claude Code at least once.")}\n`);

    // Report attempt to server for debugging (non-blocking)
    await reportSubmitAttempt("no_data");

    process.exit(1);
  }

  // Data processing (synchronous)
  const usageData = ccgatherToUsageData(scannedData);

  // Clear processing message and start submit spinner
  if (!nonInteractive) {
    process.stdout.write("\r" + " ".repeat(40) + "\r");
  }
  const submitSpinner = nonInteractive
    ? null
    : ora({
        text: "Submitting to CCgather...",
        color: "cyan",
      }).start();

  const result = await submitToServer(usageData, nonInteractive, scheduled);

  if (nonInteractive) {
    if (result.success) {
      config.set("lastSync", new Date().toISOString());
      const rank = result.rank ? `, global rank #${result.rank}` : "";
      const days = usageData.daysTracked;
      report(
        `Submitted ${formatNumber(usageData.totalTokens)} tokens (${formatCost(usageData.totalCost)}) as ${username || "unknown"}${rank}.`,
        `submitted ${days} ${days === 1 ? "day" : "days"}`
      );
      return;
    }

    if (result.retryAfterMinutes) {
      report(
        `Submission limit reached. Try again in ${result.retryAfterMinutes} minute(s).`,
        `failed: submission limit reached, try again in ${result.retryAfterMinutes} minute(s)`,
        true
      );
    } else {
      const advice = duplicateSessionAdvice(config, result);
      const reason = (result.error || "Unknown error").replace(/\.$/, "");
      report(
        `Failed to submit: ${reason}.${advice ? ` ${advice}` : ""}`,
        `failed: ${result.error || "unknown error"}`,
        true
      );
    }
    process.exit(1);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DISPLAY SUMMARY (after submission)
  // Plan is shown as badge only (not used for league placement)
  // ═══════════════════════════════════════════════════════════════════════════

  // Format date range (YYMMDD format)
  const formatDate = (dateStr: string | null): string => {
    if (!dateStr) return "------";
    const d = new Date(dateStr);
    const yy = String(d.getFullYear()).slice(2);
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yy}${mm}${dd}`;
  };

  const dateRange =
    usageData.firstUsed && usageData.lastUsed
      ? `${formatDate(usageData.firstUsed)} ~ ${formatDate(usageData.lastUsed)}`
      : "";

  const daysTrackedDisplay = dateRange
    ? `${usageData.daysTracked}d ${colors.dim(`(${dateRange})`)}`
    : usageData.daysTracked.toString();

  // Summary lines (Level will be added after we have server response)
  const summaryLines = [
    `${colors.muted("Total Cost")}     💰 ${colors.warning(formatCost(usageData.totalCost))}`,
    `${colors.muted("Total Tokens")}   ⚡ ${colors.primary(formatNumber(usageData.totalTokens))}`,
    `${colors.muted("Period")}         📅 ${colors.white(daysTrackedDisplay)}`,
  ];

  // Show plan if detected
  if (usageData.ccplan) {
    const planColor = getPlanColor(usageData.ccplan);
    const planIcon = usageData.ccplan.toLowerCase() === "max" ? "🚀 " : "";
    summaryLines.push(
      `${colors.muted("Plan")}           ${planIcon}${planColor(usageData.ccplan.toUpperCase())}`
    );
  }

  // Show Opus badge if detected
  if (usageData.hasOpusUsage) {
    summaryLines.push(`${colors.muted("Models")}         ${colors.max("✦ Opus User")}`);
  }

  // Project count for display
  const projectCount = Object.keys(scannedData.projects).length;

  if (result.success) {
    submitSpinner?.succeed(colors.success("Successfully submitted!"));
    config.set("lastSync", new Date().toISOString());
    console.log();

    // Once per computer: 2.3.3 counts usage like ccusage, so the numbers can move. A first
    // submit has no earlier total to compare, so it only marks the notice as seen. The server's
    // previous record also counts: CLI 2.0.x and older never saved lastSync.
    if (config.get("countingNoticeShown") !== true) {
      if (starState.hasSubmittedBefore || result.previous) {
        console.log(`  ${colors.muted(COUNTING_NOTICE)}`);
        console.log();
      }
      config.set("countingNoticeShown", true);
    }

    // Section header with trailing line (aligned to box width: 48 = 2 indent + 46 content + 2 borders)
    const sectionHeader = (icon: string, title: string) => {
      const text = `${icon} ${title} `;
      const textWidth = getDisplayWidth(text);
      const lineLength = 48 - textWidth;
      return `  ${colors.white.bold(text)}${colors.dim("─".repeat(Math.max(0, lineLength)))}`;
    };

    // Calculate level based on accumulated server tokens (if available)
    const accumulatedTokens =
      result.accumulatedTokens || result.previous?.totalTokens || usageData.totalTokens;
    const levelProgress = getLevelProgress(accumulatedTokens);
    const currentLevel = levelProgress.current;

    // Add Level to summary lines
    summaryLines.push(
      `${colors.muted("Level")}          ${currentLevel.icon} ${currentLevel.color(`${currentLevel.name}`)}`
    );

    // ═══════════════════════════════════════
    // 0. LOCAL SCAN SUMMARY
    // ═══════════════════════════════════════
    console.log(createBox(summaryLines, 46));
    console.log(
      `  ${colors.dim(`Scanned ${projectCount} project(s), ${usageData.dailyUsage.length} day(s) of data`)}`
    );

    // ═══════════════════════════════════════
    // 1. SERVER ACCUMULATED STATS
    // ═══════════════════════════════════════
    if (result.previous) {
      const prev = result.previous;
      console.log();
      console.log(sectionHeader("📦", "Server Records"));
      console.log();

      // Server cumulative total (post-submission accurate values)
      const prevTokens = result.accumulatedTokens || prev.totalTokens || 0;
      const prevCost = result.accumulatedCost || prev.totalCost || 0;
      console.log(
        `     ${colors.muted("Accumulated")} ⚡ ${colors.primary(formatNumber(prevTokens))} ${colors.dim("│")} 💰 ${colors.warning(formatCost(prevCost))}`
      );
    }

    // ═══════════════════════════════════════
    // 1.5. MULTI-DEVICE (only if > 1 device)
    // ═══════════════════════════════════════
    if (result.deviceInfo && result.deviceInfo.totalDevices > 1) {
      const di = result.deviceInfo;
      const otherCount = di.totalDevices - 1;
      console.log();
      console.log(sectionHeader("🖥️", "Multi-Device"));
      console.log();
      console.log(
        `     ${colors.muted("This PC")}     ⚡ ${colors.primary(formatNumber(di.thisDeviceTokens))} ${colors.dim("│")} 💰 ${colors.warning(formatCost(di.thisDeviceCost))}`
      );
      console.log(
        `     ${colors.muted(`+ ${otherCount} other`)}   ⚡ ${colors.primary(formatNumber(di.otherDevicesTokens))} ${colors.dim("│")} 💰 ${colors.warning(formatCost(di.otherDevicesCost))}`
      );
      console.log(`     ${colors.dim("─".repeat(45))}`);
      console.log(
        `     ${colors.white.bold("Combined")}    ⚡ ${colors.primary(formatNumber(di.combinedTokens))} ${colors.dim("│")} 💰 ${colors.warning(formatCost(di.combinedCost))}  ${colors.success("✓")}`
      );
    }

    // ═══════════════════════════════════════
    // 2. RANK (Most Important)
    // ═══════════════════════════════════════
    if (result.rank || result.countryRank) {
      console.log();
      console.log(sectionHeader("📊", "Your Ranking"));
      console.log();

      // Get previous ranks for change display
      const prevGlobalRank = result.previous?.previousGlobalRank;
      const prevCountryRank = result.previous?.previousCountryRank;

      // Helper to format rank change
      const formatRankChange = (current: number, previous?: number | null): string => {
        if (!previous || previous === current) return "";
        const change = previous - current;
        if (change > 0) return ` ${colors.success(`↑${change}`)}`;
        return ` ${colors.error(`↓${Math.abs(change)}`)}`;
      };

      if (result.rank) {
        const medal =
          result.rank === 1
            ? "🥇"
            : result.rank === 2
              ? "🥈"
              : result.rank === 3
                ? "🥉"
                : result.rank <= 10
                  ? "🏅"
                  : "🌍";
        console.log(
          `     ${medal} ${colors.muted("Global:")} ${colors.primary.bold(`#${result.rank}`)}${formatRankChange(result.rank, prevGlobalRank)}`
        );
      }
      if (result.countryRank) {
        const countryMedal =
          result.countryRank === 1 ? "🥇" : result.countryRank <= 3 ? "🏆" : "🏠";
        console.log(
          `     ${countryMedal} ${colors.muted("Country:")} ${colors.primary.bold(`#${result.countryRank}`)}${formatRankChange(result.countryRank, prevCountryRank)}`
        );
      }
    }

    // ═══════════════════════════════════════
    // 2. LEVEL PROGRESS (based on accumulated server total)
    // ═══════════════════════════════════════
    console.log();
    console.log(sectionHeader("⬆️ ", "Level Progress"));
    console.log();

    // Show current level (using levelProgress calculated above)
    console.log(
      `     ${colors.muted("Lv.")}${colors.white(String(currentLevel.level))} ${currentLevel.icon} ${currentLevel.color(currentLevel.name)}`
    );

    if (!levelProgress.isMaxLevel && levelProgress.next) {
      // Progress bar (instant)
      const barWidth = 20;
      const filled = Math.round((levelProgress.progress / 100) * barWidth);
      const empty = barWidth - filled;
      const bar = colors.primary("█".repeat(filled)) + colors.dim("░".repeat(empty));
      console.log(`     [${bar}] ${colors.white(`${levelProgress.progress}%`)}`);

      console.log(
        `     ${colors.dim("→")} ${levelProgress.next.icon} ${colors.white(levelProgress.next.name)} ${colors.muted("in")} ${colors.primary(formatNumber(levelProgress.tokensToNext))}`
      );
    } else {
      console.log(`     ${colors.max("★")} ${colors.max("MAX LEVEL ACHIEVED!")}`);
    }

    // ═══════════════════════════════════════
    // 3. BADGES - Only show when newly earned
    // ═══════════════════════════════════════
    if (result.newBadges && result.newBadges.length > 0) {
      console.log();
      console.log(sectionHeader("🎉", "New Badge Unlocked"));
      displayNewBadges(result.newBadges);
    }

    // ═══════════════════════════════════════
    // Footer
    // ═══════════════════════════════════════
    console.log();
    const leaderboardUrl = `https://ccgather.com/leaderboard?u=${username}`;
    console.log(`  ${colors.dim("─".repeat(48))}`);
    console.log(`  ${colors.muted("View full stats:")} ${link(leaderboardUrl)}`);
    if (config.get("starConfirmed") !== true) {
      console.log(`  ${colors.muted("Enjoying CCgather? Star us:")} ${link(REPO_URL)}`);
    }
    console.log();

    // Regular Submission Reminder
    console.log(
      `  ${colors.warning("💡")} ${colors.white("Claude Code keeps ~30 days of local data.")}`
    );
    console.log(`     ${colors.muted("Submit regularly to preserve your full history!")}`);
    console.log();
  } else {
    // Handle rate limit error with friendly message
    if (result.retryAfterMinutes) {
      submitSpinner?.fail(colors.warning("Submission limit reached"));
      console.log();
      console.log(
        `  ${colors.muted("To keep our service stable, you can submit up to 2 times per hour.")}`
      );
      console.log(
        `  ${colors.muted("Your data is safely stored locally - submit anytime later!")}`
      );
      console.log();
      console.log(
        `  ${colors.warning("⏳")} ${colors.white("Ready to submit again in")} ${colors.primary(`${result.retryAfterMinutes} minute${result.retryAfterMinutes !== 1 ? "s" : ""}`)}`
      );
    } else {
      submitSpinner?.fail(colors.error("Failed to submit"));
      console.log(`\n  ${error(result.error || "Unknown error")}`);
      if (result.hint) console.log(`  ${colors.muted(result.hint)}`);
      const advice = duplicateSessionAdvice(config, result);
      if (advice) console.log(`  ${colors.muted(advice)}`);
    }
    console.log();
    process.exit(1);
  }
}

export default submit;
