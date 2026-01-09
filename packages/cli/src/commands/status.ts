import ora from "ora";
import { getConfig, isAuthenticated } from "../lib/config.js";
import { getStatus as getApiStatus } from "../lib/api.js";
import {
  colors,
  formatNumber,
  formatCost,
  getRankMedal,
  getCCplanBadge,
  getLevelInfo,
  countryCodeToFlag,
  header,
  createBox,
  error,
  link,
} from "../lib/ui.js";

interface StatusOptions {
  // Reserved for future use
}

export async function status(options: StatusOptions): Promise<void> {
  // Check authentication
  if (!isAuthenticated()) {
    console.log(`\n  ${error("Not authenticated.")}`);
    process.exit(1);
  }

  const spinner = ora({
    text: "Fetching your stats...",
    color: "cyan",
  }).start();

  const result = await getApiStatus();

  if (!result.success) {
    spinner.fail(colors.error("Failed to fetch status"));
    console.log(`\n  ${error(result.error || "Unknown error")}\n`);
    process.exit(1);
  }

  const stats = result.data!;
  const config = getConfig();
  const username = config.get("username");

  spinner.succeed(colors.success("Status retrieved"));

  // Print header
  console.log(header("Your CCgather Stats", "📊"));

  // Level info
  const levelInfo = getLevelInfo(stats.totalTokens);

  // Rank display - Global
  const medal = getRankMedal(stats.rank);
  console.log();
  console.log(`  🌍 ${colors.muted("Global")}   ${medal} ${colors.white.bold(`#${stats.rank}`)}`);

  // Rank display - Country (if available)
  if (stats.countryRank && stats.countryCode) {
    const countryFlag = countryCodeToFlag(stats.countryCode);
    const countryMedal = getRankMedal(stats.countryRank);
    console.log(
      `  ${countryFlag} ${colors.muted("Country")}  ${countryMedal} ${colors.white.bold(`#${stats.countryRank}`)}`
    );
  }

  console.log(`  ${colors.dim(`Top ${stats.percentile.toFixed(1)}% globally`)}`);

  // Level display
  console.log();
  console.log(
    `  ${levelInfo.icon} ${levelInfo.color(`Level ${levelInfo.level} - ${levelInfo.name}`)}`
  );

  // CCplan badge
  if (stats.tier) {
    const badge = getCCplanBadge(stats.tier);
    if (badge) {
      console.log(`  ${badge}`);
    }
  }

  // Stats box
  console.log();
  const statsLines = [
    `${colors.muted("Total Tokens")}   ${colors.primary(formatNumber(stats.totalTokens))}`,
    `${colors.muted("Total Spent")}    ${colors.success(formatCost(stats.totalSpent))}`,
    `${colors.muted("CCplan")}         ${colors.cyan(stats.tier || "Unknown")}`,
  ];
  console.log(createBox(statsLines));

  // Badges
  if (stats.badges && stats.badges.length > 0) {
    console.log();
    console.log(`  ${colors.muted("Badges")}`);
    console.log(`  ${stats.badges.join("  ")}`);
  }

  // Footer with user-specific leaderboard URL
  const leaderboardUrl = `https://ccgather.com/leaderboard?u=${username}`;
  console.log();
  console.log(colors.dim("  ─".repeat(25)));
  console.log(`  ${colors.muted("View on leaderboard:")} ${link(leaderboardUrl)}`);
  console.log();
}

export default status;
