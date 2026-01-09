import ora from "ora";
import inquirer from "inquirer";
import { getApiUrl, getConfig, isAuthenticated } from "../lib/config.js";
import {
  scanUsageData,
  getSessionFileCount,
  CCGatherData,
  DailyUsage,
} from "../lib/ccgather-json.js";
import {
  colors,
  formatNumber,
  formatCost,
  header,
  success,
  error,
  link,
  createBox,
  progressBar,
  sleep,
  getLevelProgress,
} from "../lib/ui.js";

interface UsageData {
  totalTokens: number;
  totalCost: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  daysTracked: number;
  ccplan?: string | null;
  rateLimitTier?: string | null;
  dailyUsage: DailyUsage[];
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

interface SubmitResponse {
  success: boolean;
  profileUrl?: string;
  rank?: number;
  countryRank?: number;
  newBadges?: BadgeInfo[];
  totalBadges?: number;
  error?: string;
}

/**
 * Convert CCGatherData to UsageData
 */
function ccgatherToUsageData(data: CCGatherData): UsageData {
  return {
    totalTokens: data.usage.totalTokens,
    totalCost: data.usage.totalCost,
    inputTokens: data.usage.inputTokens,
    outputTokens: data.usage.outputTokens,
    cacheReadTokens: data.usage.cacheReadTokens,
    cacheWriteTokens: data.usage.cacheWriteTokens,
    daysTracked: data.stats.daysTracked,
    ccplan: data.account?.ccplan || null,
    rateLimitTier: data.account?.rateLimitTier || null,
    dailyUsage: data.dailyUsage || [],
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
        ccplan: data.ccplan,
        rateLimitTier: data.rateLimitTier,
        timestamp: new Date().toISOString(),
        dailyUsage: data.dailyUsage,
      }),
    });

    if (!response.ok) {
      const errorData = (await response.json().catch(() => ({}))) as { error?: string };
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
 * Display newly earned badges
 */
function displayNewBadges(badges: BadgeInfo[]): void {
  if (badges.length === 0) return;

  console.log();
  for (const badge of badges) {
    const rarityColor = getRarityColor(badge.rarity);
    const rarityLabel = badge.rarity.toUpperCase();

    console.log(
      `     ${badge.icon} ${colors.white.bold(badge.name)} ${rarityColor(`[${rarityLabel}]`)}`
    );
    console.log(`        ${colors.muted(badge.description)}`);
    if (badge.praise) {
      console.log(`        ${colors.cyan(`"${badge.praise}"`)}`);
    }
    // Show achieved date for rank badges
    if (badge.category === "rank") {
      console.log(`        ${colors.dim(`📅 Achieved: ${formatBadgeDate(badge.earnedAt)}`)}`);
    }
  }
}

/**
 * Main submit command
 */
export async function submit(options: SubmitOptions): Promise<void> {
  console.log(header("Submit Usage Data", "📤"));

  // Check authentication first
  if (!isAuthenticated()) {
    console.log(`\n  ${error("Not authenticated.")}`);
    process.exit(1);
  }

  const config = getConfig();
  const username = config.get("username");

  if (username) {
    console.log(`\n  ${colors.muted("Logged in as:")} ${colors.white(username)}`);
  }

  // Always scan fresh data
  let usageData: UsageData | null = null;
  const totalFiles = getSessionFileCount();

  if (totalFiles > 0) {
    console.log(
      `\n  ${colors.muted("Scanning")} ${colors.white(totalFiles.toString())} ${colors.muted("sessions...")}`
    );

    // Scan with progress bar (no file save - send directly to server)
    const scannedData = scanUsageData({
      onProgress: (current, total) => {
        progressBar(current, total, "Scanning");
      },
    });

    await sleep(200); // Brief pause after progress bar completes

    if (scannedData) {
      usageData = ccgatherToUsageData(scannedData);
      console.log(`  ${success("Scan complete!")}`);
    }
  } else {
    const scannedData = scanUsageData();
    if (scannedData) {
      usageData = ccgatherToUsageData(scannedData);
      console.log(`\n  ${success("Scan complete!")}`);
    }
  }

  if (!usageData) {
    console.log(`\n  ${error("No usage data found.")}`);
    console.log(`  ${colors.muted("Make sure you have used Claude Code at least once.")}\n`);
    process.exit(1);
  }

  // Show summary
  console.log();
  const summaryLines = [
    `${colors.muted("Total Cost")}     ${colors.success(formatCost(usageData.totalCost))}`,
    `${colors.muted("Total Tokens")}   ${colors.primary(formatNumber(usageData.totalTokens))}`,
    `${colors.muted("Days Tracked")}   ${colors.warning(usageData.daysTracked.toString())}`,
  ];

  if (usageData.ccplan) {
    summaryLines.push(
      `${colors.muted("CCplan")}         ${colors.cyan(usageData.ccplan.toUpperCase())}`
    );
  }

  console.log(createBox(summaryLines));
  console.log();

  // Confirm submission
  const { confirmSubmit } = await inquirer.prompt([
    {
      type: "confirm",
      name: "confirmSubmit",
      message: "Submit to CCgather leaderboard?",
      default: true,
    },
  ]);

  if (!confirmSubmit) {
    console.log(`\n  ${colors.muted("Submission cancelled.")}\n`);
    return;
  }

  // Submit to server
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
    // 1. RANK (Most Important)
    // ═══════════════════════════════════════
    if (result.rank || result.countryRank) {
      console.log();
      console.log(sectionHeader("📊", "Your Ranking"));
      console.log();
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
          `     ${medal} ${colors.muted("Global:")} ${colors.primary.bold(`#${result.rank}`)}`
        );
      }
      if (result.countryRank) {
        const countryMedal =
          result.countryRank === 1 ? "🥇" : result.countryRank <= 3 ? "🏆" : "🏠";
        console.log(
          `     ${countryMedal} ${colors.muted("Country:")} ${colors.primary.bold(`#${result.countryRank}`)}`
        );
      }
    }

    // ═══════════════════════════════════════
    // 2. LEVEL PROGRESS
    // ═══════════════════════════════════════
    console.log();
    console.log(sectionHeader("⬆️", "Level Progress"));
    console.log();

    const levelProgress = getLevelProgress(usageData.totalTokens);
    const currentLevel = levelProgress.current;

    console.log(
      `     ${currentLevel.icon} ${currentLevel.color(`Level ${currentLevel.level}`)} ${colors.muted("•")} ${colors.white(currentLevel.name)}`
    );

    if (!levelProgress.isMaxLevel && levelProgress.next) {
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
    console.log(`  ${colors.dim("─".repeat(40))}`);
    console.log(`  ${colors.muted("View full stats:")} ${link(leaderboardUrl)}`);
    console.log();
  } else {
    submitSpinner.fail(colors.error("Failed to submit"));
    console.log(`\n  ${error(result.error || "Unknown error")}`);

    // If authentication error, suggest re-auth
    if (result.error?.includes("auth") || result.error?.includes("token")) {
      console.log();
      console.log(`  ${colors.muted("Try re-authenticating from Settings menu.")}`);
    }
    console.log();
    process.exit(1);
  }
}

export default submit;
