import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

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
}

const CCGATHER_JSON_VERSION = '1.0.0';

/**
 * Get the path to ccgather.json
 */
export function getCCGatherJsonPath(): string {
  return path.join(os.homedir(), '.claude', 'ccgather.json');
}

/**
 * Get Claude Code projects directory
 */
function getClaudeProjectsDir(): string {
  return path.join(os.homedir(), '.claude', 'projects');
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
      } else if (entry.name.endsWith('.jsonl')) {
        files.push(fullPath);
      }
    }
  } catch {
    // Ignore permission errors
  }
  return files;
}

/**
 * Estimate cost based on model and tokens
 */
function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  // Pricing per million tokens (approximate)
  const pricing: Record<string, { input: number; output: number }> = {
    'claude-opus-4': { input: 15, output: 75 },
    'claude-sonnet-4': { input: 3, output: 15 },
    'claude-haiku': { input: 0.25, output: 1.25 },
    'default': { input: 3, output: 15 },
  };

  let modelKey = 'default';
  for (const key of Object.keys(pricing)) {
    if (model.includes(key.replace('claude-', ''))) {
      modelKey = key;
      break;
    }
  }

  const price = pricing[modelKey];
  const inputCost = (inputTokens / 1_000_000) * price.input;
  const outputCost = (outputTokens / 1_000_000) * price.output;

  return Math.round((inputCost + outputCost) * 100) / 100;
}

/**
 * Scan JSONL files and generate ccgather.json data
 */
export function scanUsageData(): CCGatherData | null {
  const projectsDir = getClaudeProjectsDir();

  if (!fs.existsSync(projectsDir)) {
    return null;
  }

  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalCacheRead = 0;
  let totalCacheWrite = 0;
  let totalCost = 0;
  let sessionsCount = 0;
  const dates = new Set<string>();
  const models: Record<string, number> = {};
  let firstTimestamp: string | null = null;
  let lastTimestamp: string | null = null;

  const jsonlFiles = findJsonlFiles(projectsDir);
  sessionsCount = jsonlFiles.length;

  for (const filePath of jsonlFiles) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n').filter((line) => line.trim());

      for (const line of lines) {
        try {
          const event = JSON.parse(line);

          if (event.type === 'assistant' && event.message?.usage) {
            const usage = event.message.usage;
            const model = event.message.model || 'unknown';
            const inputTokens = usage.input_tokens || 0;
            const outputTokens = usage.output_tokens || 0;

            totalInputTokens += inputTokens;
            totalOutputTokens += outputTokens;
            totalCacheRead += usage.cache_read_input_tokens || 0;
            totalCacheWrite += usage.cache_creation_input_tokens || 0;

            // Calculate cost for this message
            totalCost += estimateCost(model, inputTokens, outputTokens);

            // Track model usage
            const totalModelTokens = inputTokens + outputTokens;
            models[model] = (models[model] || 0) + totalModelTokens;

            // Track dates
            if (event.timestamp) {
              const date = new Date(event.timestamp).toISOString().split('T')[0];
              dates.add(date);

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

  const totalTokens = totalInputTokens + totalOutputTokens;

  if (totalTokens === 0) {
    return null;
  }

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
      firstUsed: firstTimestamp ? new Date(firstTimestamp).toISOString().split('T')[0] : null,
      lastUsed: lastTimestamp ? new Date(lastTimestamp).toISOString().split('T')[0] : null,
    },
    models,
  };
}

/**
 * Read existing ccgather.json
 */
export function readCCGatherJson(): CCGatherData | null {
  const jsonPath = getCCGatherJsonPath();

  if (!fs.existsSync(jsonPath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(jsonPath, 'utf-8');
    return JSON.parse(content) as CCGatherData;
  } catch {
    return null;
  }
}

/**
 * Write ccgather.json
 */
export function writeCCGatherJson(data: CCGatherData): void {
  const jsonPath = getCCGatherJsonPath();
  const claudeDir = path.dirname(jsonPath);

  // Ensure .claude directory exists
  if (!fs.existsSync(claudeDir)) {
    fs.mkdirSync(claudeDir, { recursive: true });
  }

  fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2));
}

/**
 * Scan and save ccgather.json
 */
export function scanAndSave(): CCGatherData | null {
  const data = scanUsageData();

  if (data) {
    writeCCGatherJson(data);
  }

  return data;
}
