import ora from "ora";
import inquirer from "inquirer";
import { getApiUrl, getConfig, isAuthenticated } from "../lib/config.js";
import {
  scanUsageData,
  getSessionFileCount,
  hasProjectSessions,
  getCurrentProjectName,
  CCGatherData,
  DailyUsage,
  SessionFingerprint,
  hasOpusUsageInProject,
  hasOldData,
} from "../lib/ccgather-json.js";
import {
  colors,
  formatNumber,
  formatCost,
  header,
  success,
  error,
  warning,
  link,
  createBox,
  progressBar,
  sleep,
  getLevelProgress,
  slotMachineRank,
  animatedProgressBar,
  suspenseDots,
  planDetectionSection,
  maxVerifiedMessage,
  pastDataWarningMessage,
  trustMessage,
  currentPlanMessage,
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
  ccplan?: string | null;
  rateLimitTier?: string | null;
  authMethod?: string; // "oauth" | "api_key" | "unknown"
  rawSubscriptionType?: string | null; // Original value for discovery
  dailyUsage: DailyUsage[];
  sessionFingerprint?: SessionFingerprint;
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
  retryAfterMinutes?: number;
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
    firstUsed: data.stats.firstUsed,
    lastUsed: data.stats.lastUsed,
    ccplan: data.account?.ccplan || null,
    rateLimitTier: data.account?.rateLimitTier || null,
    authMethod: data.account?.authMethod || "unknown",
    rawSubscriptionType: data.account?.rawSubscriptionType || null,
    dailyUsage: data.dailyUsage || [],
    sessionFingerprint: data.sessionFingerprint,
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
        authMethod: data.authMethod,
        rawSubscriptionType: data.rawSubscriptionType,
        timestamp: new Date().toISOString(),
        dailyUsage: data.dailyUsage,
        // Session fingerprint for duplicate prevention
        sessionFingerprint: data.sessionFingerprint,
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
 * Main submit command
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

  verifySpinner.succeed(colors.success("Authenticated"));

  const username = tokenCheck.username || config.get("username");

  if (username) {
    console.log(`\n  ${colors.muted("Logged in as:")} ${colors.white(username)}`);
  }

  // Check if current project has Claude Code sessions
  const projectName = getCurrentProjectName();

  if (!hasProjectSessions()) {
    console.log(`\n  ${error("No Claude Code sessions found for this project.")}`);
    console.log(`  ${colors.muted("Project:")} ${colors.white(projectName)}`);
    console.log();
    console.log(`  ${colors.muted("Make sure you:")}`);
    console.log(`  ${colors.muted("  1. Run this command from a project directory")}`);
    console.log(`  ${colors.muted("  2. Have used Claude Code in this project at least once")}`);
    console.log();
    process.exit(1);
  }

  // Always scan fresh data (current project only)
  let usageData: UsageData | null = null;
  const totalFiles = getSessionFileCount();

  console.log(`\n  ${colors.muted("Project:")} ${colors.white(projectName)}`);

  if (totalFiles > 0) {
    console.log(
      `  ${colors.muted("Scanning")} ${colors.white(totalFiles.toString())} ${colors.muted("sessions...")}`
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

  // ═══════════════════════════════════════════════════════════
  // PLAN DETECTION LOGIC - Fair League Placement
  // Priority: 1. Opus usage → Max | 2. Recent → Current | 3. Old → User choice
  // ═══════════════════════════════════════════════════════════

  const opusCheck = hasOpusUsageInProject(usageData.dailyUsage);
  const oldDataCheck = hasOldData(usageData.dailyUsage, 30);
  let finalPlan: string = usageData.ccplan || "free";
  let planDetectionReason: "opus" | "current" | "user_choice" = "current";

  // Case 1: Opus usage detected anywhere → Max (verified)
  if (opusCheck.detected) {
    finalPlan = "max";
    planDetectionReason = "opus";

    console.log(planDetectionSection("Plan Detection", "🚀"));
    for (const line of maxVerifiedMessage(opusCheck.opusModels)) {
      console.log(line);
    }
  }
  // Case 2: No Opus + Old data (>30 days) → User choice
  else if (oldDataCheck.hasOldData) {
    planDetectionReason = "user_choice";

    console.log(planDetectionSection("Past Data Detected", "📅"));
    for (const line of pastDataWarningMessage(
      oldDataCheck.oldestDate || "",
      oldDataCheck.daysSinceOldest
    )) {
      console.log(line);
    }
    for (const line of trustMessage()) {
      console.log(line);
    }

    // User selection prompt
    const planChoices = [
      {
        name: `${colors.pro("⚡")} Pro plan`,
        value: "pro",
        short: "Pro",
      },
      {
        name: `${colors.free("⚪")} Free plan`,
        value: "free",
        short: "Free",
      },
      {
        name: `${colors.dim("?")} Can't remember ${colors.dim("(submit as Free)")}`,
        value: "free_default",
        short: "Free (default)",
      },
    ];

    const { selectedPlan } = await inquirer.prompt([
      {
        type: "list",
        name: "selectedPlan",
        message: "Which plan were you using at that time?",
        choices: planChoices,
        default: 0,
      },
    ]);

    // "Can't remember" → Free (more conservative/fair approach)
    finalPlan = selectedPlan === "free_default" ? "free" : selectedPlan;
    console.log();
    console.log(`  ${success(`Selected: ${finalPlan.toUpperCase()}`)}`);
  }
  // Case 3: No Opus + Recent data (≤30 days) → Current plan from credentials
  else {
    // Use current plan from credentials (already set in usageData.ccplan)
    planDetectionReason = "current";
    // Only show if plan is detected
    if (usageData.ccplan) {
      for (const line of currentPlanMessage(usageData.ccplan)) {
        console.log(line);
      }
    }
  }

  // Apply final plan to all daily usage records
  usageData.ccplan = finalPlan;
  usageData.dailyUsage = usageData.dailyUsage.map((daily) => ({
    ...daily,
    ccplan: finalPlan,
  }));

  // Show summary
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

  const summaryLines = [
    `${colors.muted("Total Cost")}     ${colors.success(formatCost(usageData.totalCost))}`,
    `${colors.muted("Total Tokens")}   ${colors.primary(formatNumber(usageData.totalTokens))}`,
    `${colors.muted("Period")}         ${colors.warning(daysTrackedDisplay)}`,
  ];

  if (usageData.ccplan) {
    summaryLines.push(
      `${colors.muted("CCplan")}         ${colors.cyan(usageData.ccplan.toUpperCase())}`
    );
  }

  console.log(createBox(summaryLines));
  console.log();

  // Debug: Show daily usage count
  if (usageData.dailyUsage.length > 0) {
    console.log(`  ${colors.dim(`Daily records: ${usageData.dailyUsage.length} days`)}`);
  }

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
    // 1. RANK (Most Important) - Slot Machine Animation
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
        await slotMachineRank(result.rank, "Global:", medal);
      }
      if (result.countryRank) {
        const countryMedal =
          result.countryRank === 1 ? "🥇" : result.countryRank <= 3 ? "🏆" : "🏠";
        await slotMachineRank(result.countryRank, "Country:", countryMedal, 10);
      }
    }

    // ═══════════════════════════════════════
    // 2. LEVEL PROGRESS - Animated Progress Bar
    // ═══════════════════════════════════════
    console.log();
    console.log(sectionHeader("⬆️", "Level Progress"));
    console.log();

    const levelProgress = getLevelProgress(usageData.totalTokens);
    const currentLevel = levelProgress.current;

    // Show level with slight delay
    await sleep(200);
    console.log(
      `     ${currentLevel.icon} ${currentLevel.color(`Level ${currentLevel.level}`)} ${colors.muted("•")} ${colors.white(currentLevel.name)}`
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
