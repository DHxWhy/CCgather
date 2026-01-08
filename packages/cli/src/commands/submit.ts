import ora from "ora";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { getApiUrl } from "../lib/config.js";
import {
  readCCGatherJson,
  scanAndSave,
  getCCGatherJsonPath,
  CCGatherData,
} from "../lib/ccgather-json.js";
import {
  colors,
  formatNumber,
  formatCost,
  header,
  divider,
  success,
  error,
  warning,
  link,
  createBox,
  printCompactHeader,
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
}

interface SubmitOptions {
  yes?: boolean;
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
  };
}

/**
 * Find cc.json file (Claude Code usage summary) - legacy support
 */
function findCcJson(): string | null {
  const possiblePaths = [
    path.join(process.cwd(), "cc.json"),
    path.join(os.homedir(), "cc.json"),
    path.join(os.homedir(), ".claude", "cc.json"),
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }
  return null;
}

/**
 * Parse cc.json file - legacy support
 */
function parseCcJson(filePath: string): UsageData | null {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const data = JSON.parse(content);

    return {
      totalTokens: data.totalTokens || data.total_tokens || 0,
      totalCost: data.totalCost || data.total_cost || data.costUSD || 0,
      inputTokens: data.inputTokens || data.input_tokens || 0,
      outputTokens: data.outputTokens || data.output_tokens || 0,
      cacheReadTokens: data.cacheReadTokens || data.cache_read_tokens || 0,
      cacheWriteTokens: data.cacheWriteTokens || data.cache_write_tokens || 0,
      daysTracked: data.daysTracked || data.days_tracked || calculateDaysTracked(data),
    };
  } catch {
    return null;
  }
}

/**
 * Calculate days tracked from data
 */
function calculateDaysTracked(data: Record<string, unknown>): number {
  if (data.dailyStats && Array.isArray(data.dailyStats)) {
    return data.dailyStats.length;
  }
  if (data.daily && typeof data.daily === "object") {
    return Object.keys(data.daily).length;
  }
  return 1;
}

/**
 * Parse usage from Claude Code JSONL files
 */
function parseUsageFromJsonl(): UsageData | null {
  const projectsDir = path.join(os.homedir(), ".claude", "projects");

  if (!fs.existsSync(projectsDir)) {
    return null;
  }

  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalCacheRead = 0;
  let totalCacheWrite = 0;
  const dates = new Set<string>();

  function findJsonlFiles(dir: string): string[] {
    const files: string[] = [];
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          files.push(...findJsonlFiles(fullPath));
        } else if (entry.name.endsWith(".jsonl")) {
          files.push(fullPath);
        }
      }
    } catch {
      // Ignore permission errors
    }
    return files;
  }

  const jsonlFiles = findJsonlFiles(projectsDir);

  for (const filePath of jsonlFiles) {
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      const lines = content.split("\n").filter((line) => line.trim());

      for (const line of lines) {
        try {
          const event = JSON.parse(line);

          if (event.type === "assistant" && event.message?.usage) {
            const usage = event.message.usage;
            totalInputTokens += usage.input_tokens || 0;
            totalOutputTokens += usage.output_tokens || 0;
            totalCacheRead += usage.cache_read_input_tokens || 0;
            totalCacheWrite += usage.cache_creation_input_tokens || 0;

            // Track unique dates
            if (event.timestamp) {
              const date = new Date(event.timestamp).toISOString().split("T")[0];
              dates.add(date);
            }
          }
        } catch {
          // Skip invalid JSON lines
        }
      }
    } catch {
      // Skip unreadable files
    }
  }

  const totalTokens = totalInputTokens + totalOutputTokens;

  if (totalTokens === 0) {
    return null;
  }

  // Estimate cost (rough approximation based on Claude pricing)
  const costPerMillion = 3;
  const totalCost = (totalTokens / 1000000) * costPerMillion;

  return {
    totalTokens,
    totalCost: Math.round(totalCost * 100) / 100,
    inputTokens: totalInputTokens,
    outputTokens: totalOutputTokens,
    cacheReadTokens: totalCacheRead,
    cacheWriteTokens: totalCacheWrite,
    daysTracked: dates.size || 1,
  };
}

/**
 * Detect GitHub username from git config or repo
 */
async function detectGitHubUsername(): Promise<string | null> {
  try {
    const { execSync } = await import("child_process");

    // Try to get from git config
    try {
      const username = execSync("git config --get user.name", { encoding: "utf-8" }).trim();
      if (username) return username;
    } catch {
      // Ignore
    }

    // Try to get from remote origin
    try {
      const remote = execSync("git remote get-url origin", { encoding: "utf-8" }).trim();
      const match = remote.match(/github\.com[:/]([^/]+)/);
      if (match) return match[1];
    } catch {
      // Ignore
    }
  } catch {
    // Ignore
  }
  return null;
}

/**
 * Submit data to CCgather API
 */
async function submitToServer(
  username: string,
  data: UsageData
): Promise<{ success: boolean; profileUrl?: string; rank?: number; error?: string }> {
  const apiUrl = getApiUrl();

  try {
    const response = await fetch(`${apiUrl}/cli/submit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username,
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
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return { success: false, error: errorData.error || `HTTP ${response.status}` };
    }

    const result = await response.json();
    return { success: true, profileUrl: result.profileUrl, rank: result.rank };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

/**
 * Main submit command
 */
export async function submit(options: SubmitOptions): Promise<void> {
  printCompactHeader("1.2.1");
  console.log(header("Submit Usage Data", "📤"));

  // Detect GitHub username
  const spinner = ora({
    text: "Detecting GitHub username...",
    color: "cyan",
  }).start();
  let username = await detectGitHubUsername();
  spinner.stop();

  if (username) {
    console.log(`\n  ${colors.muted("Detected:")} ${colors.white(username)}`);
  }

  // Prompt for username confirmation
  const inquirer = await import("inquirer");
  const { confirmedUsername } = await inquirer.default.prompt([
    {
      type: "input",
      name: "confirmedUsername",
      message: colors.muted("GitHub username:"),
      default: username || "",
      validate: (input: string) => input.trim().length > 0 || "Username is required",
    },
  ]);
  username = confirmedUsername.trim();

  // Find usage data - Priority: ccgather.json > cc.json > JSONL scan
  let usageData: UsageData | null = null;
  let dataSource = "";

  // 1. Try ccgather.json first
  const ccgatherData = readCCGatherJson();
  if (ccgatherData) {
    usageData = ccgatherToUsageData(ccgatherData);
    dataSource = "ccgather.json";
    console.log(`\n  ${success(`Found ${dataSource}`)}`);
    console.log(
      `  ${colors.dim(`Last scanned: ${new Date(ccgatherData.lastScanned).toLocaleString()}`)}`
    );

    // Show CCplan if detected
    if (usageData.ccplan) {
      console.log(`  ${colors.dim("CCplan:")} ${colors.primary(usageData.ccplan.toUpperCase())}`);
    }
  }

  // 2. Try legacy cc.json
  if (!usageData) {
    const ccJsonPath = findCcJson();
    if (ccJsonPath) {
      const { useCcJson } = await inquirer.default.prompt([
        {
          type: "confirm",
          name: "useCcJson",
          message: "Found existing cc.json. Use this file?",
          default: true,
        },
      ]);

      if (useCcJson) {
        usageData = parseCcJson(ccJsonPath);
        dataSource = "cc.json";
      }
    }
  }

  // 3. Scan JSONL files and create ccgather.json
  if (!usageData) {
    const parseSpinner = ora({
      text: "Scanning Claude Code usage data...",
      color: "cyan",
    }).start();
    const scannedData = scanAndSave();
    parseSpinner.stop();

    if (scannedData) {
      usageData = ccgatherToUsageData(scannedData);
      dataSource = "Claude Code logs";
      console.log(`\n  ${success("Scanned and saved to ccgather.json")}`);
      console.log(`  ${colors.dim(`Path: ${getCCGatherJsonPath()}`)}`);
    }
  }

  if (!usageData) {
    console.log(`\n  ${error("No usage data found.")}`);
    console.log(`  ${colors.muted("Make sure you have used Claude Code.")}`);
    console.log(`  ${colors.muted("Run:")} ${colors.white("npx ccgather scan")}\n`);
    process.exit(1);
  }

  if (dataSource && dataSource !== "Claude Code logs") {
    console.log(`\n  ${success(`Using ${dataSource}`)}`);
  }

  // Prompt for CCplan selection if not detected
  if (!usageData.ccplan) {
    const { selectedCCplan } = await inquirer.default.prompt([
      {
        type: "list",
        name: "selectedCCplan",
        message: colors.muted("Select your Claude plan:"),
        choices: [
          { name: "🚀 Max", value: "max" },
          { name: "⚡ Pro", value: "pro" },
          { name: "⚪ Free", value: "free" },
          { name: "👥 Team", value: "team" },
          { name: "⏭️  Skip", value: null },
        ],
        default: "free",
      },
    ]);
    usageData.ccplan = selectedCCplan;
  }

  // Show summary in a box
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
  if (!options.yes) {
    const { confirmSubmit } = await inquirer.default.prompt([
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
  }

  // Submit to server
  const submitSpinner = ora({
    text: "Submitting to CCgather...",
    color: "cyan",
  }).start();
  const result = await submitToServer(username, usageData);

  if (result.success) {
    submitSpinner.succeed(colors.success("Successfully submitted to CCgather!"));
    console.log();

    // Success box
    const successLines = [
      `${colors.success("✓")} ${colors.white.bold("Submission Complete!")}`,
      "",
      `${colors.muted("Profile:")} ${link(result.profileUrl || `https://ccgather.dev/u/${username}`)}`,
    ];

    if (result.rank) {
      successLines.push(`${colors.muted("Rank:")}    ${colors.warning(`#${result.rank}`)}`);
    }

    console.log(createBox(successLines));
    console.log();
    console.log(`  ${colors.dim("View leaderboard:")} ${link("https://ccgather.dev/leaderboard")}`);
    console.log();
  } else {
    submitSpinner.fail(colors.error("Failed to submit"));
    console.log(`\n  ${error(result.error || "Unknown error")}\n`);
    process.exit(1);
  }
}

export default submit;
