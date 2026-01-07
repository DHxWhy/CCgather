import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface ClaudeUsageData {
  totalTokens: number;
  totalSpent: number;
  modelBreakdown: Record<string, number>;
  lastUpdated: string;
}

interface ClaudeSession {
  id: string;
  model: string;
  tokens_used: number;
  cost: number;
  timestamp: string;
}

interface ClaudeConfig {
  sessions?: ClaudeSession[];
  usage?: {
    total_tokens: number;
    total_cost: number;
    by_model: Record<string, number>;
  };
}

/**
 * Get the Claude Code config directory path
 */
export function getClaudeConfigDir(): string {
  const platform = os.platform();

  if (platform === 'win32') {
    return path.join(os.homedir(), 'AppData', 'Roaming', 'claude-code');
  } else if (platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', 'claude-code');
  } else {
    return path.join(os.homedir(), '.config', 'claude-code');
  }
}

/**
 * Get possible paths for Claude Code usage data
 */
function getUsageFilePaths(): string[] {
  const configDir = getClaudeConfigDir();
  return [
    path.join(configDir, 'usage.json'),
    path.join(configDir, 'stats.json'),
    path.join(configDir, 'data', 'usage.json'),
    path.join(os.homedir(), '.claude', 'usage.json'),
    path.join(os.homedir(), '.claude-code', 'usage.json'),
  ];
}

/**
 * Read Claude Code usage data from local files
 */
export function readClaudeUsage(): ClaudeUsageData | null {
  const possiblePaths = getUsageFilePaths();

  for (const filePath of possiblePaths) {
    try {
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        const data: ClaudeConfig = JSON.parse(content);

        if (data.usage) {
          return {
            totalTokens: data.usage.total_tokens || 0,
            totalSpent: data.usage.total_cost || 0,
            modelBreakdown: data.usage.by_model || {},
            lastUpdated: new Date().toISOString(),
          };
        }

        // Try to aggregate from sessions
        if (data.sessions && data.sessions.length > 0) {
          const breakdown: Record<string, number> = {};
          let totalTokens = 0;
          let totalSpent = 0;

          for (const session of data.sessions) {
            totalTokens += session.tokens_used || 0;
            totalSpent += session.cost || 0;
            breakdown[session.model] = (breakdown[session.model] || 0) + session.tokens_used;
          }

          return {
            totalTokens,
            totalSpent,
            modelBreakdown: breakdown,
            lastUpdated: new Date().toISOString(),
          };
        }
      }
    } catch (error) {
      // Continue to next path
    }
  }

  return null;
}

/**
 * Check if Claude Code is installed
 */
export function isClaudeCodeInstalled(): boolean {
  const configDir = getClaudeConfigDir();
  return fs.existsSync(configDir);
}

/**
 * Get Claude Code version if available
 */
export function getClaudeCodeVersion(): string | null {
  const configDir = getClaudeConfigDir();
  const versionFile = path.join(configDir, 'version');

  try {
    if (fs.existsSync(versionFile)) {
      return fs.readFileSync(versionFile, 'utf-8').trim();
    }
  } catch {
    // Ignore errors
  }

  return null;
}

/**
 * For demo/testing purposes - generate mock usage data
 */
export function getMockUsageData(): ClaudeUsageData {
  return {
    totalTokens: Math.floor(Math.random() * 1000000) + 10000,
    totalSpent: Math.random() * 50 + 5,
    modelBreakdown: {
      'claude-3-5-sonnet-20241022': Math.floor(Math.random() * 500000),
      'claude-3-opus-20240229': Math.floor(Math.random() * 100000),
      'claude-3-haiku-20240307': Math.floor(Math.random() * 200000),
    },
    lastUpdated: new Date().toISOString(),
  };
}
