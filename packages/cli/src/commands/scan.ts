import chalk from "chalk";
import ora from "ora";
import { scanAndSave, getCCGatherJsonPath, CCGatherData } from "../lib/ccgather-json.js";

/**
 * Format number with commas and units
 */
function formatNumber(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(2)}K`;
  return num.toLocaleString();
}

/**
 * Display scan results in a nice box
 */
function displayResults(data: CCGatherData): void {
  const orange = chalk.hex("#FF6B35");
  const green = chalk.hex("#10B981");
  const gray = chalk.gray;
  const white = chalk.white;
  const bold = chalk.bold;
  const cyan = chalk.cyan;

  console.log();
  console.log(gray("  ┌─────────────────────────────────────────────────────┐"));
  console.log(
    gray("  │") + white("  📊 Usage Summary") + gray("                                   │")
  );
  console.log(gray("  ├─────────────────────────────────────────────────────┤"));
  console.log(
    gray("  │") +
      `  Total Tokens:   ${orange(formatNumber(data.usage.totalTokens).padEnd(15))}` +
      gray("            │")
  );
  console.log(
    gray("  │") +
      `  Total Cost:     ${green("$" + data.usage.totalCost.toFixed(2).padEnd(14))}` +
      gray("            │")
  );
  console.log(
    gray("  │") +
      `  Input Tokens:   ${white(formatNumber(data.usage.inputTokens).padEnd(15))}` +
      gray("            │")
  );
  console.log(
    gray("  │") +
      `  Output Tokens:  ${white(formatNumber(data.usage.outputTokens).padEnd(15))}` +
      gray("            │")
  );
  console.log(gray("  ├─────────────────────────────────────────────────────┤"));
  console.log(
    gray("  │") + white("  📈 Stats") + gray("                                           │")
  );
  console.log(
    gray("  │") +
      `  Days Tracked:   ${white(data.stats.daysTracked.toString().padEnd(15))}` +
      gray("            │")
  );
  console.log(
    gray("  │") +
      `  Sessions:       ${white(data.stats.sessionsCount.toString().padEnd(15))}` +
      gray("            │")
  );
  console.log(
    gray("  │") +
      `  First Used:     ${gray((data.stats.firstUsed || "N/A").padEnd(15))}` +
      gray("            │")
  );
  console.log(
    gray("  │") +
      `  Last Used:      ${gray((data.stats.lastUsed || "N/A").padEnd(15))}` +
      gray("            │")
  );
  console.log(gray("  └─────────────────────────────────────────────────────┘"));

  // Model breakdown
  if (Object.keys(data.models).length > 0) {
    console.log();
    console.log(gray("  ") + bold("Model Breakdown:"));
    for (const [model, tokens] of Object.entries(data.models)) {
      const shortModel = model.replace("claude-", "").substring(0, 20);
      console.log(gray("    • ") + white(shortModel.padEnd(22)) + orange(formatNumber(tokens)));
    }
  }

  // Top projects (show top 5 by tokens)
  if (data.projects && Object.keys(data.projects).length > 0) {
    console.log();
    console.log(gray("  ") + bold("Top Projects:"));

    const sortedProjects = Object.entries(data.projects)
      .sort(([, a], [, b]) => b.tokens - a.tokens)
      .slice(0, 5);

    for (const [name, stats] of sortedProjects) {
      const displayName = name.length > 25 ? name.substring(0, 22) + "..." : name;
      console.log(
        gray("    📁 ") +
          cyan(displayName.padEnd(25)) +
          orange(formatNumber(stats.tokens).padStart(8)) +
          green(` $${stats.cost.toFixed(2).padStart(8)}`) +
          gray(` (${stats.sessions} sessions)`)
      );
    }

    if (Object.keys(data.projects).length > 5) {
      console.log(gray(`    ... and ${Object.keys(data.projects).length - 5} more projects`));
    }
  }

  console.log();
  console.log(gray(`  📁 Saved to: ${getCCGatherJsonPath()}`));
  console.log();
}

/**
 * Scan command - scans JSONL files and creates ccgather.json
 */
export async function scan(): Promise<void> {
  console.log(chalk.bold("\n🔍 Scanning Claude Code Usage\n"));

  const spinner = ora("Scanning JSONL files...").start();

  const data = scanAndSave();

  if (!data) {
    spinner.fail(chalk.red("No usage data found"));
    console.log(chalk.gray("\nPossible reasons:"));
    console.log(chalk.gray("  • Claude Code has not been used yet"));
    console.log(chalk.gray("  • ~/.claude/projects/ directory is empty"));
    console.log(chalk.gray("  • No permission to read files\n"));
    process.exit(1);
  }

  spinner.succeed(chalk.green("Scan complete!"));

  displayResults(data);
}

export default scan;
