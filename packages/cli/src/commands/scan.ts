import ora from "ora";
import { scanAndSave, getCCGatherJsonPath, CCGatherData } from "../lib/ccgather-json.js";
import {
  colors,
  formatNumber,
  formatCost,
  header,
  createBox,
  success,
  error,
  printCompactHeader,
  getCCplanBadge,
} from "../lib/ui.js";

/**
 * Display scan results
 */
function displayResults(data: CCGatherData): void {
  // Usage Summary Box
  console.log();
  const usageLines = [
    `${colors.white.bold("📊 Usage Summary")}`,
    "",
    `${colors.muted("Total Tokens")}    ${colors.primary(formatNumber(data.usage.totalTokens))}`,
    `${colors.muted("Total Cost")}      ${colors.success(formatCost(data.usage.totalCost))}`,
    `${colors.muted("Input Tokens")}    ${colors.white(formatNumber(data.usage.inputTokens))}`,
    `${colors.muted("Output Tokens")}   ${colors.white(formatNumber(data.usage.outputTokens))}`,
  ];

  // Add cache tokens if present
  if (data.usage.cacheReadTokens > 0 || data.usage.cacheWriteTokens > 0) {
    usageLines.push(
      `${colors.muted("Cache Read")}      ${colors.dim(formatNumber(data.usage.cacheReadTokens))}`
    );
    usageLines.push(
      `${colors.muted("Cache Write")}     ${colors.dim(formatNumber(data.usage.cacheWriteTokens))}`
    );
  }

  console.log(createBox(usageLines));

  // Stats Box
  console.log();
  const statsLines = [
    `${colors.white.bold("📈 Statistics")}`,
    "",
    `${colors.muted("Days Tracked")}    ${colors.warning(data.stats.daysTracked.toString())}`,
    `${colors.muted("Sessions")}        ${colors.white(data.stats.sessionsCount.toString())}`,
    `${colors.muted("First Used")}      ${colors.dim(data.stats.firstUsed || "N/A")}`,
    `${colors.muted("Last Used")}       ${colors.dim(data.stats.lastUsed || "N/A")}`,
  ];
  console.log(createBox(statsLines));

  // Account Info (CCplan)
  if (data.account?.ccplan) {
    console.log();
    const badge = getCCplanBadge(data.account.ccplan);
    console.log(`  ${colors.muted("Account Plan:")} ${badge}`);
    if (data.account.rateLimitTier) {
      console.log(`  ${colors.muted("Rate Limit:")}   ${colors.dim(data.account.rateLimitTier)}`);
    }
  }

  // Model breakdown
  if (Object.keys(data.models).length > 0) {
    console.log();
    console.log(`  ${colors.white.bold("🤖 Model Breakdown")}`);
    console.log(colors.dim("  ─".repeat(25)));

    const sortedModels = Object.entries(data.models)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);

    for (const [model, tokens] of sortedModels) {
      const shortModel = model.replace("claude-", "").substring(0, 20);
      console.log(
        `  ${colors.dim("•")} ${colors.white(shortModel.padEnd(22))} ${colors.primary(formatNumber(tokens))}`
      );
    }

    if (Object.keys(data.models).length > 5) {
      console.log(`  ${colors.dim(`... and ${Object.keys(data.models).length - 5} more models`)}`);
    }
  }

  // Top projects (show top 5 by tokens)
  if (data.projects && Object.keys(data.projects).length > 0) {
    console.log();
    console.log(`  ${colors.white.bold("📁 Top Projects")}`);
    console.log(colors.dim("  ─".repeat(25)));

    const sortedProjects = Object.entries(data.projects)
      .sort(([, a], [, b]) => b.tokens - a.tokens)
      .slice(0, 5);

    for (const [name, stats] of sortedProjects) {
      const displayName = name.length > 20 ? name.substring(0, 17) + "..." : name;
      console.log(
        `  ${colors.cyan(displayName.padEnd(20))} ` +
          `${colors.primary(formatNumber(stats.tokens).padStart(8))} ` +
          `${colors.success(formatCost(stats.cost).padStart(10))} ` +
          `${colors.dim(`(${stats.sessions} sess)`)}`
      );
    }

    if (Object.keys(data.projects).length > 5) {
      console.log(
        `  ${colors.dim(`... and ${Object.keys(data.projects).length - 5} more projects`)}`
      );
    }
  }

  // File location
  console.log();
  console.log(colors.dim("  ─".repeat(25)));
  console.log(`  ${colors.muted("Saved to:")} ${colors.dim(getCCGatherJsonPath())}`);
  console.log();
}

/**
 * Scan command - scans JSONL files and creates ccgather.json
 */
export async function scan(): Promise<void> {
  printCompactHeader("1.2.1");
  console.log(header("Scan Claude Code Usage", "🔍"));

  const spinner = ora({
    text: "Scanning JSONL files...",
    color: "cyan",
  }).start();

  const data = scanAndSave();

  if (!data) {
    spinner.fail(colors.error("No usage data found"));
    console.log();
    console.log(`  ${error("Possible reasons:")}`);
    console.log(`  ${colors.dim("•")} Claude Code has not been used yet`);
    console.log(`  ${colors.dim("•")} ~/.claude/projects/ directory is empty`);
    console.log(`  ${colors.dim("•")} No permission to read files`);
    console.log();
    process.exit(1);
  }

  spinner.succeed(colors.success("Scan complete!"));

  displayResults(data);

  // Next steps
  console.log(`  ${colors.muted("Next:")} Run ${colors.white("npx ccgather")} to submit your data`);
  console.log();
}

export default scan;
