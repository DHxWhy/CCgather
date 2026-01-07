import ora from "ora";
import { isAuthenticated } from "../lib/config.js";
import { getStatus as getApiStatus } from "../lib/api.js";
import {
  colors,
  formatNumber,
  formatCost,
  getRankMedal,
  getCCplanBadge,
  getLevelInfo,
  header,
  createBox,
  divider,
  error,
  link,
  printCompactHeader,
} from "../lib/ui.js";

interface StatusOptions {
  json?: boolean;
}

export async function status(options: StatusOptions): Promise<void> {
  // Check authentication
  if (!isAuthenticated()) {
    if (options.json) {
      console.log(JSON.stringify({ error: "Not authenticated" }));
    } else {
      console.log(`\n  ${error("Not authenticated.")}`);
      console.log(`  ${colors.muted("Run:")} ${colors.white("npx ccgather auth")}\n`);
    }
    process.exit(1);
  }

  const spinner = options.json
    ? null
    : ora({
        text: "Fetching your stats...",
        color: "cyan",
      }).start();

  const result = await getApiStatus();

  if (!result.success) {
    if (spinner) spinner.fail(colors.error("Failed to fetch status"));
    if (options.json) {
      console.log(JSON.stringify({ error: result.error }));
    } else {
      console.log(`\n  ${error(result.error || "Unknown error")}\n`);
    }
    process.exit(1);
  }

  const stats = result.data!;

  if (options.json) {
    console.log(JSON.stringify(stats, null, 2));
    return;
  }

  spinner?.succeed(colors.success("Status retrieved"));

  // Print header
  printCompactHeader("1.2.1");
  console.log(header("Your CCgather Stats", "📊"));

  // Level info
  const levelInfo = getLevelInfo(stats.totalTokens);

  // Rank display
  const medal = getRankMedal(stats.rank);
  console.log();
  console.log(`  ${medal} ${colors.white.bold(`Rank #${stats.rank}`)}`);
  console.log(`  ${colors.dim(`Top ${stats.percentile.toFixed(1)}% of all users`)}`);

  // Level display
  console.log();
  console.log(
    `  ${levelInfo.icon} ${levelInfo.color(`Level ${levelInfo.level} • ${levelInfo.name}`)}`
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
    `${colors.muted("Tier")}           ${colors.cyan(stats.tier || "Unknown")}`,
  ];
  console.log(createBox(statsLines));

  // Badges
  if (stats.badges && stats.badges.length > 0) {
    console.log();
    console.log(`  ${colors.muted("Badges")}`);
    console.log(`  ${stats.badges.join("  ")}`);
  }

  // Footer
  console.log();
  console.log(colors.dim("  ─".repeat(25)));
  console.log(`  ${colors.muted("View leaderboard:")} ${link("https://ccgather.dev/leaderboard")}`);
  console.log();
}

export default status;
