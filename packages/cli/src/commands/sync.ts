import chalk from "chalk";
import ora from "ora";
import { getConfig, isAuthenticated } from "../lib/config.js";
import { syncUsage } from "../lib/api.js";
import { readClaudeUsage, isClaudeCodeInstalled, getMockUsageData } from "../lib/claude.js";

interface SyncOptions {
  force?: boolean;
  verbose?: boolean;
}

function formatNumber(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(2)}K`;
  return num.toString();
}

export async function sync(options: SyncOptions): Promise<void> {
  const config = getConfig();

  console.log(chalk.bold("\n🔄 CCgather Sync\n"));

  // Check authentication
  if (!isAuthenticated()) {
    console.log(chalk.red("Not authenticated."));
    console.log(chalk.gray("Run: npx ccgather auth\n"));
    process.exit(1);
  }

  // Check if Claude Code is installed
  if (!isClaudeCodeInstalled()) {
    console.log(chalk.yellow("⚠️  Claude Code installation not detected."));
    console.log(
      chalk.gray("Make sure Claude Code is installed and has been used at least once.\n")
    );

    // For demo purposes, offer to sync mock data
    if (process.env.CCGATHER_DEMO === "true") {
      console.log(chalk.gray("Demo mode: Using mock data..."));
    } else {
      process.exit(1);
    }
  }

  // Check last sync time (rate limiting)
  const lastSync = config.get("lastSync");
  if (lastSync && !options.force) {
    const lastSyncDate = new Date(lastSync);
    const minInterval = 5 * 60 * 1000; // 5 minutes
    const timeSinceSync = Date.now() - lastSyncDate.getTime();

    if (timeSinceSync < minInterval) {
      const remaining = Math.ceil((minInterval - timeSinceSync) / 1000 / 60);
      console.log(chalk.yellow(`⏳ Please wait ${remaining} minutes before syncing again.`));
      console.log(chalk.gray("Use --force to override.\n"));
      process.exit(0);
    }
  }

  // Read usage data
  const spinner = ora("Reading Claude Code usage data...").start();

  let usageData = readClaudeUsage();

  // Use mock data for demo if no real data
  if (!usageData && process.env.CCGATHER_DEMO === "true") {
    usageData = getMockUsageData();
  }

  if (!usageData) {
    spinner.fail(chalk.red("Failed to read usage data"));
    console.log(chalk.gray("\nPossible reasons:"));
    console.log(chalk.gray("  - Claude Code has not been used yet"));
    console.log(chalk.gray("  - Usage data file is missing or corrupted"));
    console.log(chalk.gray("  - Insufficient permissions to read the file\n"));
    process.exit(1);
  }

  spinner.text = "Syncing to CCgather...";

  // Sync to API
  const result = await syncUsage({
    totalTokens: usageData.totalTokens,
    totalSpent: usageData.totalSpent,
    modelBreakdown: usageData.modelBreakdown,
    timestamp: usageData.lastUpdated,
  });

  if (!result.success) {
    spinner.fail(chalk.red("Sync failed"));
    console.log(chalk.red(`Error: ${result.error}\n`));
    process.exit(1);
  }

  // Update last sync time
  config.set("lastSync", new Date().toISOString());

  spinner.succeed(chalk.green("Sync complete!"));

  // Display summary
  console.log("\n" + chalk.gray("─".repeat(40)));
  console.log(chalk.bold("📊 Your Stats"));
  console.log(chalk.gray("─".repeat(40)));
  console.log(`  ${chalk.gray("Tokens:")}     ${chalk.white(formatNumber(usageData.totalTokens))}`);
  console.log(
    `  ${chalk.gray("Spent:")}      ${chalk.green("$" + usageData.totalSpent.toFixed(2))}`
  );
  console.log(`  ${chalk.gray("Rank:")}       ${chalk.yellow("#" + result.data?.rank)}`);

  if (options.verbose) {
    console.log("\n" + chalk.gray("Model Breakdown:"));
    for (const [model, tokens] of Object.entries(usageData.modelBreakdown)) {
      const shortModel = model.replace("claude-", "").replace(/-\d+$/, "");
      console.log(`  ${chalk.gray(shortModel + ":")} ${formatNumber(tokens as number)}`);
    }
  }

  console.log(chalk.gray("─".repeat(40)));
  console.log(chalk.gray("\nView full leaderboard: https://ccgather.com/leaderboard\n"));
}
