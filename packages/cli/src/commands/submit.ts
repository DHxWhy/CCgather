import chalk from 'chalk';
import ora from 'ora';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { getApiUrl } from '../lib/config.js';
import {
  readCCGatherJson,
  scanAndSave,
  getCCGatherJsonPath,
  CCGatherData,
} from '../lib/ccgather-json.js';

interface UsageData {
  totalTokens: number;
  totalCost: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  daysTracked: number;
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
  };
}

/**
 * Find cc.json file (Claude Code usage summary) - legacy support
 */
function findCcJson(): string | null {
  const possiblePaths = [
    path.join(process.cwd(), 'cc.json'),
    path.join(os.homedir(), 'cc.json'),
    path.join(os.homedir(), '.claude', 'cc.json'),
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
    const content = fs.readFileSync(filePath, 'utf-8');
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
  if (data.daily && typeof data.daily === 'object') {
    return Object.keys(data.daily).length;
  }
  return 1;
}

/**
 * Parse usage from Claude Code JSONL files
 */
function parseUsageFromJsonl(): UsageData | null {
  const projectsDir = path.join(os.homedir(), '.claude', 'projects');

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
        } else if (entry.name.endsWith('.jsonl')) {
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
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n').filter(line => line.trim());

      for (const line of lines) {
        try {
          const event = JSON.parse(line);

          if (event.type === 'assistant' && event.message?.usage) {
            const usage = event.message.usage;
            totalInputTokens += usage.input_tokens || 0;
            totalOutputTokens += usage.output_tokens || 0;
            totalCacheRead += usage.cache_read_input_tokens || 0;
            totalCacheWrite += usage.cache_creation_input_tokens || 0;

            // Track unique dates
            if (event.timestamp) {
              const date = new Date(event.timestamp).toISOString().split('T')[0];
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
 * Format number with commas
 */
function formatNumber(num: number): string {
  return num.toLocaleString();
}

/**
 * Detect GitHub username from git config or repo
 */
async function detectGitHubUsername(): Promise<string | null> {
  try {
    const { execSync } = await import('child_process');

    // Try to get from git config
    try {
      const username = execSync('git config --get user.name', { encoding: 'utf-8' }).trim();
      if (username) return username;
    } catch {
      // Ignore
    }

    // Try to get from remote origin
    try {
      const remote = execSync('git remote get-url origin', { encoding: 'utf-8' }).trim();
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
async function submitToServer(username: string, data: UsageData): Promise<{ success: boolean; profileUrl?: string; error?: string }> {
  const apiUrl = getApiUrl();

  try {
    const response = await fetch(`${apiUrl}/cli/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
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
        timestamp: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return { success: false, error: errorData.error || `HTTP ${response.status}` };
    }

    const result = await response.json();
    return { success: true, profileUrl: result.profileUrl };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * Main submit command
 */
export async function submit(options: SubmitOptions): Promise<void> {
  console.log(chalk.bold('\n🚀 CCgather Submission Tool v1.0.0\n'));

  // Detect GitHub username
  const spinner = ora('Detecting GitHub username...').start();
  let username = await detectGitHubUsername();
  spinner.stop();

  if (username) {
    console.log(chalk.gray(`Detected GitHub username from repository: ${chalk.white(username)}`));
  }

  // Prompt for username confirmation
  const inquirer = await import('inquirer');
  const { confirmedUsername } = await inquirer.default.prompt([
    {
      type: 'input',
      name: 'confirmedUsername',
      message: 'GitHub username:',
      default: username || '',
      validate: (input: string) => input.trim().length > 0 || 'Username is required',
    },
  ]);
  username = confirmedUsername.trim();

  // Find usage data - Priority: ccgather.json > cc.json > JSONL scan
  let usageData: UsageData | null = null;
  let dataSource = '';

  // 1. Try ccgather.json first
  const ccgatherData = readCCGatherJson();
  if (ccgatherData) {
    usageData = ccgatherToUsageData(ccgatherData);
    dataSource = 'ccgather.json';
    console.log(chalk.green(`✓ Found ${dataSource}`));
    console.log(chalk.gray(`  Last scanned: ${new Date(ccgatherData.lastScanned).toLocaleString()}\n`));
  }

  // 2. Try legacy cc.json
  if (!usageData) {
    const ccJsonPath = findCcJson();
    if (ccJsonPath) {
      const { useCcJson } = await inquirer.default.prompt([
        {
          type: 'confirm',
          name: 'useCcJson',
          message: `Found existing cc.json. Use this file?`,
          default: true,
        },
      ]);

      if (useCcJson) {
        usageData = parseCcJson(ccJsonPath);
        dataSource = 'cc.json';
      }
    }
  }

  // 3. Scan JSONL files and create ccgather.json
  if (!usageData) {
    const parseSpinner = ora('Scanning Claude Code usage data...').start();
    const scannedData = scanAndSave();
    parseSpinner.stop();

    if (scannedData) {
      usageData = ccgatherToUsageData(scannedData);
      dataSource = 'Claude Code logs';
      console.log(chalk.green(`✓ Scanned and saved to ccgather.json`));
      console.log(chalk.gray(`  Path: ${getCCGatherJsonPath()}\n`));
    }
  }

  if (!usageData) {
    console.log(chalk.red('\n❌ No usage data found.'));
    console.log(chalk.gray('Make sure you have used Claude Code.'));
    console.log(chalk.gray('Run: npx ccgather scan\n'));
    process.exit(1);
  }

  if (dataSource && dataSource !== 'Claude Code logs') {
    console.log(chalk.green(`✓ Using ${dataSource}\n`));
  }

  // Show summary
  console.log(chalk.bold('Summary:'));
  console.log(chalk.gray(`  Total Cost: ${chalk.green('$' + formatNumber(Math.round(usageData.totalCost)))}`));
  console.log(chalk.gray(`  Total Tokens: ${chalk.cyan(formatNumber(usageData.totalTokens))}`));
  console.log(chalk.gray(`  Days Tracked: ${chalk.yellow(usageData.daysTracked.toString())}`));
  console.log();

  // Confirm submission
  if (!options.yes) {
    const { confirmSubmit } = await inquirer.default.prompt([
      {
        type: 'confirm',
        name: 'confirmSubmit',
        message: 'Submit to CCgather leaderboard?',
        default: true,
      },
    ]);

    if (!confirmSubmit) {
      console.log(chalk.gray('\nSubmission cancelled.'));
      return;
    }
  }

  // Submit to server
  const submitSpinner = ora('Submitting to CCgather...').start();
  const result = await submitToServer(username, usageData);

  if (result.success) {
    submitSpinner.succeed(chalk.green('Successfully submitted to CCgather!'));
    console.log();
    console.log(chalk.gray(`View your profile at: ${chalk.cyan(result.profileUrl || `https://ccgather.dev/u/${username}`)}`));
    console.log();
    console.log(chalk.bold('Done! 🎉'));
  } else {
    submitSpinner.fail(chalk.red('Failed to submit'));
    console.log(chalk.red(result.error || 'Unknown error'));
    process.exit(1);
  }

  console.log();
}

export default submit;
