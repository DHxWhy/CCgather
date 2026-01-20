import ora from "ora";
import inquirer from "inquirer";
import { getApiUrl, getConfig } from "../lib/config.js";
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
import {
  colors,
  formatNumber,
  formatCost,
  header,
  success,
  error,
  link,
  progressBar,
  sleep,
  getLevelProgress,
  slotMachineRank,
  animatedProgressBar,
  suspenseDots,
  printAnimatedBox,
  printAnimatedLines,
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

interface SubmitOptions {
  // Reserved for future use
}

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

interface SubmitResponse {
  success: boolean;
  profileUrl?: string;
  rank?: number;
  countryRank?: number;
  currentLevel?: number;
  newBadges?: BadgeInfo[];
  totalBadges?: number;
  error?: string;
  retryAfterMinutes?: number;
  previous?: PreviousSubmission;
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
async function submitToServer(data: UsageData): Promise<SubmitResponse> {
  const apiUrl = getApiUrl();
  const config = getConfig();
  const apiToken = config.get("apiToken");

  if (!apiToken) {
    return { success: false, error: "Not authenticated." };
  }

  try {
    const response = await fetch(`${apiUrl}/cli/submit`, {
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
        // Plan info for badge display (not league placement)
        ccplan: data.ccplan,
        rateLimitTier: data.rateLimitTier,
        authMethod: data.authMethod,
        rawSubscriptionType: data.rawSubscriptionType,
        timestamp: new Date().toISOString(),
        dailyUsage: data.dailyUsage,
        // Session fingerprint for duplicate prevention
        sessionFingerprint: data.sessionFingerprint,
        // Opus info for badge display
        hasOpusUsage: data.hasOpusUsage,
        opusModels: data.opusModels,
      }),
    });

    if (!response.ok) {
      const errorData = (await response.json().catch(() => ({}))) as {
        error?: string;
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

      return { success: false, error: errorData.error || `HTTP ${response.status}` };
    }

    const result = (await response.json()) as SubmitResponse;
    return { ...result, success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
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
 * Display newly earned badges with animation
 */
async function displayNewBadges(badges: BadgeInfo[]): Promise<void> {
  if (badges.length === 0) return;

  console.log();

  // Show suspense before revealing badges
  await suspenseDots("Checking achievements", 800);

  for (let i = 0; i < badges.length; i++) {
    const badge = badges[i];
    const rarityColor = getRarityColor(badge.rarity);
    const rarityLabel = badge.rarity.toUpperCase();

    // Dramatic pause before each badge
    if (i > 0) {
      await sleep(300);
    }

    // Badge name with sparkle effect
    console.log(
      `     ✨ ${badge.icon} ${colors.white.bold(badge.name)} ${rarityColor(`[${rarityLabel}]`)}`
    );
    await sleep(100);
    console.log(`        ${colors.muted(badge.description)}`);
    await sleep(80);

    if (badge.praise) {
      console.log(`        ${colors.cyan(`"${badge.praise}"`)}`);
      await sleep(80);
    }

    // Show achieved date for rank badges
    if (badge.category === "rank") {
      console.log(`        ${colors.dim(`📅 Achieved: ${formatBadgeDate(badge.earnedAt)}`)}`);
      await sleep(80);
    }
  }
}

/**
 * Verify token validity with server
 */
async function verifyToken(): Promise<{ valid: boolean; username?: string }> {
  const apiUrl = getApiUrl();
  const config = getConfig();
  const apiToken = config.get("apiToken");

  if (!apiToken) {
    return { valid: false };
  }

  try {
    const response = await fetch(`${apiUrl}/cli/verify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiToken}`,
      },
    });

    if (!response.ok) {
      return { valid: false };
    }

    const data = (await response.json()) as { userId: string; username: string };
    return { valid: true, username: data.username };
  } catch {
    return { valid: false };
  }
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
 */
export async function submit(options: SubmitOptions): Promise<void> {
  console.log(header("Submit Usage Data", "📤"));

  const config = getConfig();

  // Verify token with server FIRST (before any scanning)
  const verifySpinner = ora({
    text: "Verifying authentication...",
    color: "cyan",
  }).start();

  const tokenCheck = await verifyToken();

  if (!tokenCheck.valid) {
    verifySpinner.stop();

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
  verifySpinner.succeed(colors.success(`Authenticated as ${colors.white(username || "unknown")}`));

  // ═══════════════════════════════════════════════════════════════════════════
  // SCAN ALL PROJECTS (v2.0 - Level-based League System)
  // No more per-project selection - scan everything for fair ranking
  // ═══════════════════════════════════════════════════════════════════════════

  // Check if any sessions exist
  if (!hasAnySessions()) {
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
    console.log(`  ${colors.dim("─".repeat(40))}`);
    console.log(`  ${colors.muted("Searched paths:")}`);
    for (const pathInfo of debugInfo.searchedPaths) {
      const status = pathInfo.exists ? colors.success("✓") : colors.error("✗");
      console.log(`    ${status} ${pathInfo.path}`);
    }
    console.log();
    process.exit(1);
  }

  // Scan ALL projects
  console.log(`\n  ${colors.muted("Scanning all Claude Code sessions...")}`);

  const totalSessions = getAllSessionsCount();
  console.log(`  ${colors.dim(`Found ${totalSessions} session file(s)`)}`);

  let lastProgress = 0;
  const scannedData = scanAllProjects({
    onProgress: (current, total) => {
      progressBar(current, total, "Scanning");
      lastProgress = current;
    },
  });

  // Clear progress bar line
  if (lastProgress > 0) {
    process.stdout.write("\r" + " ".repeat(60) + "\r");
  }

  if (!scannedData) {
    console.log(`  ${colors.error("✗")} ${colors.error("No usage data found.")}`);
    console.log(`  ${colors.muted("Make sure you have used Claude Code at least once.")}\n`);
    process.exit(1);
  }

  const usageData = ccgatherToUsageData(scannedData);

  console.log(`  ${colors.success("✔")} ${colors.success("Scan complete!")}`);

  // ═══════════════════════════════════════════════════════════════════════════
  // DISPLAY SUMMARY
  // Plan is shown as badge only (not used for league placement)
  // ═══════════════════════════════════════════════════════════════════════════

  console.log();

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
    ? `${usageData.daysTracked} days ${colors.dim(`(${dateRange})`)}`
    : usageData.daysTracked.toString();

  // Get level info for display
  const levelProgress = getLevelProgress(usageData.totalTokens);
  const currentLevel = levelProgress.current;

  const summaryLines = [
    `${colors.muted("Total Cost")}     💰 ${colors.warning(formatCost(usageData.totalCost))}`,
    `${colors.muted("Total Tokens")}   ⚡ ${colors.primary(formatNumber(usageData.totalTokens))}`,
    `${colors.muted("Period")}         📅 ${colors.white(daysTrackedDisplay)}`,
    `${colors.muted("Level")}          ${currentLevel.icon} ${currentLevel.color(`${currentLevel.name}`)}`,
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

  await printAnimatedBox(summaryLines, 52, 60);
  console.log();

  // Show project count
  const projectCount = Object.keys(scannedData.projects).length;
  console.log(
    `  ${colors.dim(`Scanned ${projectCount} project(s), ${usageData.dailyUsage.length} day(s) of data`)}`
  );
  console.log();

  // Submit to server (no confirmation needed - user already chose "Submit")
  const submitSpinner = ora({
    text: "Submitting to CCgather...",
    color: "cyan",
  }).start();

  const result = await submitToServer(usageData);

  if (result.success) {
    submitSpinner.succeed(colors.success("Successfully submitted!"));
    console.log();

    // Section header with trailing line
    const sectionHeader = (icon: string, title: string) => {
      const text = `${icon} ${title} `;
      const lineLength = 40 - text.length;
      return `  ${colors.white.bold(text)}${colors.dim("─".repeat(Math.max(0, lineLength)))}`;
    };

    // ═══════════════════════════════════════
    // 0. SERVER ACCUMULATED STATS
    // ═══════════════════════════════════════
    if (result.previous) {
      const prev = result.previous;

      console.log(sectionHeader("📦", "Server Records"));
      await sleep(40);
      console.log();

      // Server cumulative total (before this submission)
      const prevTokens = prev.totalTokens || 0;
      const prevCost = prev.totalCost || 0;
      console.log(
        `     ${colors.muted("Accumulated")} ⚡ ${colors.primary(formatNumber(prevTokens))} ${colors.dim("│")} 💰 ${colors.warning(formatCost(prevCost))}`
      );
      await sleep(50);

      console.log();
      await sleep(60);

      // Quick loading animation before ranking
      const rankSpinner = ora({
        text: colors.dim("Calculating ranking..."),
        color: "cyan",
      }).start();
      await sleep(400);
      rankSpinner.stop();
    }

    // ═══════════════════════════════════════
    // 1. RANK (Most Important) - Slot Machine Animation
    // ═══════════════════════════════════════
    if (result.rank || result.countryRank) {
      console.log();
      console.log(sectionHeader("📊", "Your Ranking"));
      console.log();

      // Get previous ranks for change display
      const prevGlobalRank = result.previous?.previousGlobalRank;
      const prevCountryRank = result.previous?.previousCountryRank;

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
        await slotMachineRank(result.rank, "Global:", medal, 12, prevGlobalRank);
      }
      if (result.countryRank) {
        const countryMedal =
          result.countryRank === 1 ? "🥇" : result.countryRank <= 3 ? "🏆" : "🏠";
        await slotMachineRank(result.countryRank, "Country:", countryMedal, 10, prevCountryRank);
      }
    }

    // ═══════════════════════════════════════
    // 2. LEVEL PROGRESS - Animated Progress Bar
    // ═══════════════════════════════════════
    console.log();
    console.log(sectionHeader("⬆️", "Level Progress"));
    console.log();

    // Show current level
    await sleep(200);
    console.log(
      `     ${colors.muted("Lv.")}${colors.white(String(currentLevel.level))} ${currentLevel.icon} ${currentLevel.color(currentLevel.name)}`
    );

    if (!levelProgress.isMaxLevel && levelProgress.next) {
      // Animated progress bar filling up
      await animatedProgressBar(levelProgress.progress, 20, 30);
      console.log(); // New line after progress bar animation

      await sleep(150);
      console.log(
        `     ${colors.dim("→")} ${levelProgress.next.icon} ${colors.white(levelProgress.next.name)} ${colors.muted("in")} ${colors.primary(formatNumber(levelProgress.tokensToNext))}`
      );
    } else {
      await sleep(300);
      console.log(`     ${colors.max("★")} ${colors.max("MAX LEVEL ACHIEVED!")}`);
    }

    // ═══════════════════════════════════════
    // 3. BADGES - Only show when newly earned (Animated)
    // ═══════════════════════════════════════
    if (result.newBadges && result.newBadges.length > 0) {
      console.log();
      console.log(sectionHeader("🎉", "New Badge Unlocked"));
      await displayNewBadges(result.newBadges);
    }

    // ═══════════════════════════════════════
    // Footer
    // ═══════════════════════════════════════
    console.log();
    const leaderboardUrl = `https://ccgather.com/leaderboard?u=${username}`;
    console.log(`  ${colors.dim("─".repeat(40))}`);
    console.log(`  ${colors.muted("View full stats:")} ${link(leaderboardUrl)}`);
    console.log();

    // Regular Submission Reminder
    console.log(
      `  ${colors.warning("💡")} ${colors.white("Claude Code keeps ~30 days of local data.")}`
    );
    console.log(`     ${colors.muted("Submit regularly to preserve your full history!")}`);
    console.log();
  } else {
    submitSpinner.fail(colors.error("Failed to submit"));
    console.log(`\n  ${error(result.error || "Unknown error")}`);

    // Handle rate limit error with retry time
    if (result.retryAfterMinutes) {
      console.log();
      console.log(
        `  ${colors.warning("⏳")} ${colors.muted("Try again in")} ${colors.white(`${result.retryAfterMinutes} minute${result.retryAfterMinutes !== 1 ? "s" : ""}`)}`
      );
    }
    console.log();
    process.exit(1);
  }
}

export default submit;
