import chalk from "chalk";
import ora from "ora";
import * as http from "http";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { getConfig } from "../lib/config.js";
import { getApiUrl } from "../lib/config.js";

const CALLBACK_PORT = 9876;

interface AuthCallbackData {
  token: string;
  userId: string;
  username: string;
}

/**
 * Get the Claude Code settings directory
 */
function getClaudeSettingsDir(): string {
  return path.join(os.homedir(), ".claude");
}

/**
 * Open URL in default browser
 */
async function openBrowser(url: string): Promise<void> {
  const { default: open } = await import("open");
  await open(url);
}

/**
 * Create local HTTP server to receive OAuth callback
 */
function createCallbackServer(): Promise<AuthCallbackData> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url || "", `http://localhost:${CALLBACK_PORT}`);

      if (url.pathname === "/callback") {
        const token = url.searchParams.get("token");
        const userId = url.searchParams.get("userId");
        const username = url.searchParams.get("username");
        const error = url.searchParams.get("error");

        if (error) {
          res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
          res.end(`
            <html>
              <head><title>CCgather - Error</title></head>
              <body style="font-family: system-ui; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #1a1a1a; color: #fff;">
                <div style="text-align: center;">
                  <h1 style="color: #ef4444;">❌ Authentication Failed</h1>
                  <p>${error}</p>
                  <p style="color: #888;">You can close this window.</p>
                </div>
              </body>
            </html>
          `);
          server.close();
          reject(new Error(error));
          return;
        }

        if (token && userId && username) {
          res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
          res.end(`
            <html>
              <head><title>CCgather - Success</title></head>
              <body style="font-family: system-ui; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #1a1a1a; color: #fff;">
                <div style="text-align: center;">
                  <h1 style="color: #22c55e;">✅ Authentication Successful!</h1>
                  <p>Welcome, <strong>${username}</strong>!</p>
                  <p style="color: #888;">You can close this window and return to your terminal.</p>
                </div>
              </body>
            </html>
          `);
          server.close();
          resolve({ token, userId, username });
        } else {
          res.writeHead(400, { "Content-Type": "text/plain" });
          res.end("Missing required parameters");
        }
      } else {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("Not found");
      }
    });

    server.listen(CALLBACK_PORT, () => {
      // Server started
    });

    server.on("error", (err) => {
      reject(new Error(`Failed to start callback server: ${err.message}`));
    });

    // Timeout after 5 minutes
    setTimeout(
      () => {
        server.close();
        reject(new Error("Authentication timed out"));
      },
      5 * 60 * 1000
    );
  });
}

/**
 * Generate the sync script content
 */
function generateSyncScript(apiUrl: string, apiToken: string): string {
  return `#!/usr/bin/env node
/**
 * CCgather Auto-Sync Script
 * This script is automatically called by Claude Code's Stop hook
 * to sync your usage data to the leaderboard.
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const API_URL = '${apiUrl}';
const API_TOKEN = '${apiToken}';

// Get Claude Code projects directory for JSONL files
function getClaudeProjectsDir() {
  const platform = os.platform();
  if (platform === 'win32') {
    return path.join(os.homedir(), '.claude', 'projects');
  }
  return path.join(os.homedir(), '.claude', 'projects');
}

// Parse JSONL files for usage data
function parseUsageFromJsonl() {
  const projectsDir = getClaudeProjectsDir();

  if (!fs.existsSync(projectsDir)) {
    return null;
  }

  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalCacheRead = 0;
  let totalCacheWrite = 0;
  const modelBreakdown = {};

  // Recursively find all .jsonl files
  function findJsonlFiles(dir) {
    const files = [];
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
    } catch (e) {
      // Ignore permission errors
    }
    return files;
  }

  const jsonlFiles = findJsonlFiles(projectsDir);

  for (const filePath of jsonlFiles) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\\n').filter(line => line.trim());

      for (const line of lines) {
        try {
          const event = JSON.parse(line);

          if (event.type === 'assistant' && event.message?.usage) {
            const usage = event.message.usage;
            totalInputTokens += usage.input_tokens || 0;
            totalOutputTokens += usage.output_tokens || 0;
            totalCacheRead += usage.cache_read_input_tokens || 0;
            totalCacheWrite += usage.cache_creation_input_tokens || 0;

            const model = event.message.model || 'unknown';
            modelBreakdown[model] = (modelBreakdown[model] || 0) +
              (usage.input_tokens || 0) + (usage.output_tokens || 0);
          }
        } catch (e) {
          // Skip invalid JSON lines
        }
      }
    } catch (e) {
      // Skip unreadable files
    }
  }

  const totalTokens = totalInputTokens + totalOutputTokens;

  if (totalTokens === 0) {
    return null;
  }

  // Estimate cost (rough approximation)
  const costPerMillion = 3; // Average cost
  const totalCost = (totalTokens / 1000000) * costPerMillion;

  return {
    totalTokens,
    totalCost: Math.round(totalCost * 100) / 100,
    inputTokens: totalInputTokens,
    outputTokens: totalOutputTokens,
    cacheReadTokens: totalCacheRead,
    cacheWriteTokens: totalCacheWrite,
    modelBreakdown
  };
}

// Send data to CCgather API
function syncToServer(data) {
  const urlObj = new URL(API_URL + '/cli/sync');
  const isHttps = urlObj.protocol === 'https:';
  const client = isHttps ? https : http;

  const postData = JSON.stringify({
    totalTokens: data.totalTokens,
    totalSpent: data.totalCost,
    inputTokens: data.inputTokens,
    outputTokens: data.outputTokens,
    cacheReadTokens: data.cacheReadTokens,
    cacheWriteTokens: data.cacheWriteTokens,
    modelBreakdown: data.modelBreakdown,
    timestamp: new Date().toISOString()
  });

  const options = {
    hostname: urlObj.hostname,
    port: urlObj.port || (isHttps ? 443 : 80),
    path: urlObj.pathname,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData),
      'Authorization': 'Bearer ' + API_TOKEN
    }
  };

  const req = client.request(options, (res) => {
    // Silent success
  });

  req.on('error', (e) => {
    // Silent failure - don't interrupt user's workflow
  });

  req.write(postData);
  req.end();
}

// Main execution
const usageData = parseUsageFromJsonl();
if (usageData) {
  syncToServer(usageData);
}
`;
}

/**
 * Install Stop hook in Claude Code settings
 */
function installStopHook(): { success: boolean; message: string } {
  const claudeDir = getClaudeSettingsDir();
  const settingsPath = path.join(claudeDir, "settings.json");

  // Ensure .claude directory exists
  if (!fs.existsSync(claudeDir)) {
    fs.mkdirSync(claudeDir, { recursive: true });
  }

  // Read existing settings or create new
  let settings: Record<string, unknown> = {};
  try {
    if (fs.existsSync(settingsPath)) {
      const content = fs.readFileSync(settingsPath, "utf-8");
      settings = JSON.parse(content);
    }
  } catch {
    // Start with empty settings
  }

  // Ensure hooks object exists
  if (!settings.hooks || typeof settings.hooks !== "object") {
    settings.hooks = {};
  }

  const hooks = settings.hooks as Record<string, unknown[]>;

  // Check if our hook already exists
  const syncScriptPath = path.join(claudeDir, "ccgather-sync.js");
  const hookCommand = `node "${syncScriptPath}"`;

  if (!hooks.Stop || !Array.isArray(hooks.Stop)) {
    hooks.Stop = [];
  }

  // Check if hook already registered
  const existingHook = hooks.Stop.find(
    (h: unknown) =>
      typeof h === "object" && h !== null && (h as Record<string, unknown>).command === hookCommand
  );

  if (!existingHook) {
    hooks.Stop.push({
      command: hookCommand,
      background: true,
    });
  }

  // Write settings back
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));

  return { success: true, message: "Stop hook installed" };
}

/**
 * Save sync script to Claude directory
 */
function saveSyncScript(apiUrl: string, apiToken: string): void {
  const claudeDir = getClaudeSettingsDir();
  const scriptPath = path.join(claudeDir, "ccgather-sync.js");

  const scriptContent = generateSyncScript(apiUrl, apiToken);
  fs.writeFileSync(scriptPath, scriptContent);

  // Make executable on Unix
  if (os.platform() !== "win32") {
    fs.chmodSync(scriptPath, "755");
  }
}

interface SetupOptions {
  auto?: boolean;
  manual?: boolean;
}

/**
 * Main setup command for auto-sync (optional feature)
 */
export async function setupAuto(options: SetupOptions = {}): Promise<void> {
  // If --manual flag, remove auto-sync
  if (options.manual) {
    console.log(chalk.bold("\n🔧 Disabling Auto-Sync\n"));

    const { reset } = await import("./reset.js");
    await reset();

    console.log(chalk.green("✓ Auto-sync disabled. Use `npx ccgather` to submit manually."));
    return;
  }

  // Show info about auto mode
  console.log(chalk.bold("\n⚠️  Auto-Sync Mode (Optional)\n"));
  console.log(chalk.gray("This will install a hook that automatically syncs"));
  console.log(chalk.gray("your usage data when Claude Code sessions end."));
  console.log();
  console.log(
    chalk.yellow("Note: Manual submission (`npx ccgather`) is recommended for most users.")
  );
  console.log();

  const inquirer = await import("inquirer");
  const { proceed } = await inquirer.default.prompt([
    {
      type: "confirm",
      name: "proceed",
      message: "Continue with auto-sync setup?",
      default: false,
    },
  ]);

  if (!proceed) {
    console.log(chalk.gray("\nSetup cancelled. Use `npx ccgather` to submit manually."));
    return;
  }

  const config = getConfig();
  const apiUrl = getApiUrl();

  console.log(chalk.bold("\n🌐 CCgather Setup\n"));

  // Check if already set up
  const existingToken = config.get("apiToken");
  if (existingToken) {
    const inquirer = await import("inquirer");
    const { reconfigure } = await inquirer.default.prompt([
      {
        type: "confirm",
        name: "reconfigure",
        message: "You are already set up. Do you want to reconfigure?",
        default: false,
      },
    ]);

    if (!reconfigure) {
      console.log(chalk.gray("Setup cancelled."));
      return;
    }
  }

  // Start OAuth flow
  console.log(chalk.gray("Opening browser for GitHub authentication...\n"));

  const callbackUrl = `http://localhost:${CALLBACK_PORT}/callback`;
  // Remove /api from apiUrl for page route
  const baseUrl = apiUrl.replace("/api", "");
  const authUrl = `${baseUrl}/cli/auth?callback=${encodeURIComponent(callbackUrl)}`;

  // Start callback server
  const serverPromise = createCallbackServer();

  // Open browser
  try {
    await openBrowser(authUrl);
  } catch {
    console.log(chalk.yellow("Could not open browser automatically."));
    console.log(chalk.gray("Please open this URL manually:"));
    console.log(chalk.cyan(authUrl));
    console.log();
  }

  const spinner = ora("Waiting for authentication...").start();

  try {
    const authData = await serverPromise;
    spinner.succeed(chalk.green("Authentication successful!"));

    // Save credentials
    config.set("apiToken", authData.token);
    config.set("userId", authData.userId);

    // Install hook
    const hookSpinner = ora("Installing Claude Code hook...").start();

    try {
      saveSyncScript(apiUrl, authData.token);
      const hookResult = installStopHook();

      if (hookResult.success) {
        hookSpinner.succeed(chalk.green("Hook installed successfully!"));
      } else {
        hookSpinner.fail(chalk.red("Failed to install hook"));
        console.log(chalk.red(hookResult.message));
      }
    } catch (err) {
      hookSpinner.fail(chalk.red("Failed to install hook"));
      console.log(chalk.red(err instanceof Error ? err.message : "Unknown error"));
    }

    // Success message
    console.log();
    console.log(chalk.green.bold("✅ Setup complete!"));
    console.log();
    console.log(chalk.gray(`Welcome, ${chalk.white(authData.username)}!`));
    console.log();
    console.log(chalk.gray("Your Claude Code usage will now be automatically synced"));
    console.log(chalk.gray("to the leaderboard when each session ends."));
    console.log();
    console.log(chalk.gray("View your stats:"));
    console.log(chalk.cyan("  npx ccgather status"));
    console.log();
    console.log(chalk.gray("View the leaderboard:"));
    console.log(chalk.cyan("  https://ccgather.com/leaderboard"));
    console.log();
  } catch (err) {
    spinner.fail(chalk.red("Authentication failed"));
    console.log(chalk.red(err instanceof Error ? err.message : "Unknown error"));
    process.exit(1);
  }
}
