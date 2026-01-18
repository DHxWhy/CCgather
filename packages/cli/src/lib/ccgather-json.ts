import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as crypto from "crypto";
import { readCredentials } from "./credentials.js";

export interface DailyUsage {
  date: string; // YYYY-MM-DD
  tokens: number;
  cost: number;
  inputTokens: number;
  outputTokens: number;
  cacheWriteTokens: number;
  cacheReadTokens: number;
  sessions: number;
  models: Record<string, number>;
  ccplan?: string; // Plan at submission time (for fair league placement)
}

/**
 * Check if any daily usage contains Opus model usage
 * Opus models are only available on Max plan, so this is definitive proof
 */
export function hasOpusUsageInProject(dailyUsage: DailyUsage[]): {
  detected: boolean;
  opusModels: string[];
  opusDates: string[];
} {
  const opusModels = new Set<string>();
  const opusDates: string[] = [];

  for (const daily of dailyUsage) {
    for (const model of Object.keys(daily.models)) {
      if (model.toLowerCase().includes("opus")) {
        opusModels.add(model);
        opusDates.push(daily.date);
      }
    }
  }

  return {
    detected: opusModels.size > 0,
    opusModels: Array.from(opusModels),
    opusDates,
  };
}

/**
 * Check if project has data older than specified days
 */
export function hasOldData(
  dailyUsage: DailyUsage[],
  days: number = 30
): {
  hasOldData: boolean;
  oldestDate: string | null;
  daysSinceOldest: number;
} {
  if (dailyUsage.length === 0) {
    return { hasOldData: false, oldestDate: null, daysSinceOldest: 0 };
  }

  const sortedDates = dailyUsage.map((d) => d.date).sort((a, b) => a.localeCompare(b));

  const oldestDate = sortedDates[0];
  const oldestDateObj = new Date(oldestDate);
  const now = new Date();
  const diffTime = now.getTime() - oldestDateObj.getTime();
  const daysSinceOldest = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  return {
    hasOldData: daysSinceOldest > days,
    oldestDate,
    daysSinceOldest,
  };
}

export interface SessionFingerprint {
  sessionHashes: string[]; // SHA256 hashes of each session file
  combinedHash: string; // SHA256 of all session hashes combined
  sessionCount: number; // Number of sessions included
}

export interface CCGatherData {
  version: string;
  lastUpdated: string;
  lastScanned: string;
  usage: {
    totalTokens: number;
    totalCost: number;
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheWriteTokens: number;
  };
  stats: {
    daysTracked: number;
    sessionsCount: number;
    firstUsed: string | null;
    lastUsed: string | null;
  };
  models: Record<string, number>;
  projects: Record<
    string,
    {
      tokens: number;
      cost: number;
      sessions: number;
      models: Record<string, number>;
    }
  >;
  dailyUsage: DailyUsage[];
  account?: {
    ccplan: string | null;
    rateLimitTier: string | null;
    authMethod?: string; // "oauth" | "api_key" | "unknown"
    rawSubscriptionType?: string | null; // Original value for discovery
  };
  sessionFingerprint?: SessionFingerprint;
}

const CCGATHER_JSON_VERSION = "1.2.0";

/**
 * Extract project name from file path
 */
function extractProjectName(filePath: string): string {
  // Path format: ~/.claude/projects/{encoded-path}/{session}.jsonl
  const parts = filePath.split(/[/\\]/);
  const projectsIndex = parts.findIndex((p) => p === "projects");

  if (projectsIndex >= 0 && parts[projectsIndex + 1]) {
    // Decode the project path (it's URL encoded)
    try {
      const encoded = parts[projectsIndex + 1];
      const decoded = decodeURIComponent(encoded);
      // Get last part of the path as project name
      const pathParts = decoded.split(/[/\\]/);
      return pathParts[pathParts.length - 1] || decoded;
    } catch {
      return parts[projectsIndex + 1];
    }
  }

  return "unknown";
}

/**
 * Get Claude Code projects directory
 */
function getClaudeProjectsDir(): string {
  return path.join(os.homedir(), ".claude", "projects");
}

/**
 * Encode a path the same way Claude Code does
 * Claude Code replaces special chars and non-ASCII with '-'
 */
function encodePathLikeClaude(inputPath: string): string {
  // Replace non-ASCII characters (like Korean, Chinese, etc.) with '-'
  // Replace special characters (/, \, :, spaces) with '-'
  return inputPath
    .split("")
    .map((char) => {
      const code = char.charCodeAt(0);
      // Keep ASCII alphanumeric and some safe chars
      if (
        (code >= 48 && code <= 57) || // 0-9
        (code >= 65 && code <= 90) || // A-Z
        (code >= 97 && code <= 122) || // a-z
        char === "-" ||
        char === "_" ||
        char === "."
      ) {
        return char;
      }
      // Replace everything else with '-'
      return "-";
    })
    .join("");
}

/**
 * Get the current project's session directory
 * Claude Code encodes project paths and stores them in ~/.claude/projects/{encoded-path}/
 */
function getCurrentProjectDir(): string | null {
  const projectsDir = getClaudeProjectsDir();
  if (!fs.existsSync(projectsDir)) {
    return null;
  }

  const cwd = process.cwd();
  const encodedCwd = encodePathLikeClaude(cwd);

  try {
    const entries = fs.readdirSync(projectsDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      // Direct match with encoded path
      if (entry.name === encodedCwd) {
        return path.join(projectsDir, entry.name);
      }

      // Case-insensitive match (Windows paths)
      if (entry.name.toLowerCase() === encodedCwd.toLowerCase()) {
        return path.join(projectsDir, entry.name);
      }
    }
  } catch {
    return null;
  }

  return null;
}

/**
 * Recursively find all .jsonl files
 */
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

/**
 * Estimate cost based on model and tokens (including cache tokens)
 */
function estimateCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
  cacheWriteTokens: number = 0,
  cacheReadTokens: number = 0
): number {
  // Pricing per million tokens (official Claude pricing)
  const pricing: Record<
    string,
    { input: number; output: number; cacheWrite: number; cacheRead: number }
  > = {
    "claude-opus-4": { input: 15, output: 75, cacheWrite: 18.75, cacheRead: 1.5 },
    "claude-sonnet-4": { input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.3 },
    "claude-haiku": { input: 0.25, output: 1.25, cacheWrite: 0.3125, cacheRead: 0.025 },
    default: { input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.3 },
  };

  let modelKey = "default";
  for (const key of Object.keys(pricing)) {
    if (model.includes(key.replace("claude-", ""))) {
      modelKey = key;
      break;
    }
  }

  const price = pricing[modelKey];
  const inputCost = (inputTokens / 1_000_000) * price.input;
  const outputCost = (outputTokens / 1_000_000) * price.output;
  const cacheWriteCost = (cacheWriteTokens / 1_000_000) * price.cacheWrite;
  const cacheReadCost = (cacheReadTokens / 1_000_000) * price.cacheRead;

  return Math.round((inputCost + outputCost + cacheWriteCost + cacheReadCost) * 100) / 100;
}

/**
 * Generate SHA256 hash of file content
 * Uses first N lines to create a unique fingerprint
 */
function generateSessionHash(filePath: string, maxLines: number = 50): string | null {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.split("\n").slice(0, maxLines).join("\n");

    // Create hash from file content + filename (for uniqueness)
    const fileName = path.basename(filePath);
    const hashInput = `${fileName}:${lines}`;

    return crypto.createHash("sha256").update(hashInput).digest("hex");
  } catch {
    return null;
  }
}

/**
 * Generate combined fingerprint from all session files
 */
function generateSessionFingerprint(sessionFiles: string[]): SessionFingerprint {
  const sessionHashes: string[] = [];

  for (const file of sessionFiles) {
    const hash = generateSessionHash(file);
    if (hash) {
      sessionHashes.push(hash);
    }
  }

  // Sort hashes for consistent combined hash
  sessionHashes.sort();

  // Create combined hash from all session hashes
  const combinedHash = crypto.createHash("sha256").update(sessionHashes.join(":")).digest("hex");

  return {
    sessionHashes,
    combinedHash,
    sessionCount: sessionHashes.length,
  };
}

export interface ScanOptions {
  days?: number; // Number of days to include (default: 30, 0 = all)
  onProgress?: (current: number, total: number) => void; // Progress callback
}

/**
 * Scan JSONL files and generate ccgather.json data
 * Only scans the current project directory (based on cwd)
 * @param options.days - Number of days to include (default: 30, 0 or undefined with all flag = all time)
 */
export function scanUsageData(options: ScanOptions = {}): CCGatherData | null {
  // Get current project directory only
  const currentProjectDir = getCurrentProjectDir();

  if (!currentProjectDir) {
    return null;
  }

  // Calculate cutoff date (default: 30 days, 0 = no limit)
  const days = options.days ?? 30;
  let cutoffDate: string | null = null;

  if (days > 0) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    cutoff.setHours(0, 0, 0, 0);
    cutoffDate = cutoff.toISOString();
  }

  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalCacheRead = 0;
  let totalCacheWrite = 0;
  let totalCost = 0;
  let sessionsCount = 0;
  const dates = new Set<string>();
  const models: Record<string, number> = {};
  const projects: Record<
    string,
    {
      tokens: number;
      cost: number;
      sessions: number;
      models: Record<string, number>;
    }
  > = {};
  // Daily usage tracking
  const dailyData: Record<
    string,
    {
      tokens: number;
      cost: number;
      inputTokens: number;
      outputTokens: number;
      cacheWriteTokens: number;
      cacheReadTokens: number;
      sessions: Set<string>;
      models: Record<string, number>;
    }
  > = {};
  let firstTimestamp: string | null = null;
  let lastTimestamp: string | null = null;

  const jsonlFiles = findJsonlFiles(currentProjectDir);
  sessionsCount = jsonlFiles.length;
  const { onProgress } = options;

  for (let i = 0; i < jsonlFiles.length; i++) {
    const filePath = jsonlFiles[i];

    // Call progress callback if provided
    if (onProgress) {
      onProgress(i + 1, jsonlFiles.length);
    }
    const projectName = extractProjectName(filePath);

    // Initialize project if not exists
    if (!projects[projectName]) {
      projects[projectName] = {
        tokens: 0,
        cost: 0,
        sessions: 0,
        models: {},
      };
    }
    projects[projectName].sessions++;

    try {
      const content = fs.readFileSync(filePath, "utf-8");
      const lines = content.split("\n").filter((line) => line.trim());

      for (const line of lines) {
        try {
          const event = JSON.parse(line);

          if (event.type === "assistant" && event.message?.usage) {
            // Skip events older than cutoff date (if set)
            if (cutoffDate && event.timestamp && event.timestamp < cutoffDate) {
              continue;
            }

            const usage = event.message.usage;
            const model = event.message.model || "unknown";
            const inputTokens = usage.input_tokens || 0;
            const outputTokens = usage.output_tokens || 0;
            const cacheWrite = usage.cache_creation_input_tokens || 0;
            const cacheRead = usage.cache_read_input_tokens || 0;

            totalInputTokens += inputTokens;
            totalOutputTokens += outputTokens;
            totalCacheRead += cacheRead;
            totalCacheWrite += cacheWrite;

            // Calculate cost for this message (including cache tokens)
            const messageCost = estimateCost(
              model,
              inputTokens,
              outputTokens,
              cacheWrite,
              cacheRead
            );
            totalCost += messageCost;

            // Track model usage (global) - includes cache tokens
            const totalModelTokens = inputTokens + outputTokens + cacheWrite + cacheRead;
            models[model] = (models[model] || 0) + totalModelTokens;

            // Track project usage
            projects[projectName].tokens += totalModelTokens;
            projects[projectName].cost += messageCost;
            projects[projectName].models[model] =
              (projects[projectName].models[model] || 0) + totalModelTokens;

            // Track dates and daily usage (UTC timezone for global consistency)
            if (event.timestamp) {
              const date = new Date(event.timestamp).toISOString().split("T")[0];
              dates.add(date);

              // Initialize daily data if not exists
              if (!dailyData[date]) {
                dailyData[date] = {
                  tokens: 0,
                  cost: 0,
                  inputTokens: 0,
                  outputTokens: 0,
                  cacheWriteTokens: 0,
                  cacheReadTokens: 0,
                  sessions: new Set(),
                  models: {},
                };
              }

              // Track daily usage
              dailyData[date].tokens += totalModelTokens;
              dailyData[date].cost += messageCost;
              dailyData[date].inputTokens += inputTokens;
              dailyData[date].outputTokens += outputTokens;
              dailyData[date].cacheWriteTokens += cacheWrite;
              dailyData[date].cacheReadTokens += cacheRead;
              dailyData[date].sessions.add(filePath);
              dailyData[date].models[model] =
                (dailyData[date].models[model] || 0) + totalModelTokens;

              // Track first and last timestamps
              if (!firstTimestamp || event.timestamp < firstTimestamp) {
                firstTimestamp = event.timestamp;
              }
              if (!lastTimestamp || event.timestamp > lastTimestamp) {
                lastTimestamp = event.timestamp;
              }
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

  // Total tokens includes cache tokens (matches ccusage calculation)
  const totalTokens = totalInputTokens + totalOutputTokens + totalCacheWrite + totalCacheRead;

  if (totalTokens === 0) {
    return null;
  }

  // Round project costs
  for (const projectName of Object.keys(projects)) {
    projects[projectName].cost = Math.round(projects[projectName].cost * 100) / 100;
  }

  // Convert daily data to sorted array
  const dailyUsage: DailyUsage[] = Object.entries(dailyData)
    .map(([date, data]) => ({
      date,
      tokens: data.tokens,
      cost: Math.round(data.cost * 100) / 100,
      inputTokens: data.inputTokens,
      outputTokens: data.outputTokens,
      cacheWriteTokens: data.cacheWriteTokens,
      cacheReadTokens: data.cacheReadTokens,
      sessions: data.sessions.size,
      models: data.models,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Read account credentials
  const credentials = readCredentials();

  // Generate session fingerprint for duplicate prevention
  const sessionFingerprint = generateSessionFingerprint(jsonlFiles);

  return {
    version: CCGATHER_JSON_VERSION,
    lastUpdated: new Date().toISOString(),
    lastScanned: new Date().toISOString(),
    usage: {
      totalTokens,
      totalCost: Math.round(totalCost * 100) / 100,
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      cacheReadTokens: totalCacheRead,
      cacheWriteTokens: totalCacheWrite,
    },
    stats: {
      daysTracked: dates.size,
      sessionsCount,
      firstUsed: firstTimestamp ? new Date(firstTimestamp).toISOString().split("T")[0] : null,
      lastUsed: lastTimestamp ? new Date(lastTimestamp).toISOString().split("T")[0] : null,
    },
    models,
    projects,
    dailyUsage,
    account: {
      ccplan: credentials.ccplan,
      rateLimitTier: credentials.rateLimitTier,
      authMethod: credentials.authMethod,
      rawSubscriptionType: credentials.rawSubscriptionType,
    },
    sessionFingerprint,
  };
}

/**
 * Get total number of session files for current project (for progress calculation)
 */
export function getSessionFileCount(): number {
  const currentProjectDir = getCurrentProjectDir();
  if (!currentProjectDir) {
    return 0;
  }
  return findJsonlFiles(currentProjectDir).length;
}

/**
 * Check if current directory has Claude Code sessions
 */
export function hasProjectSessions(): boolean {
  return getCurrentProjectDir() !== null;
}

/**
 * Get current project name from cwd
 */
export function getCurrentProjectName(): string {
  const cwd = process.cwd();
  return path.basename(cwd);
}
