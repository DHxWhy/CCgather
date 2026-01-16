import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { execSync } from "child_process";

export type CCPlan = "free" | "pro" | "max" | "team" | "enterprise" | string;

export interface CredentialsData {
  ccplan: CCPlan | null;
  rateLimitTier: string | null;
}

interface ClaudeCredentials {
  claudeAiOauth?: {
    subscriptionType?: string;
    rateLimitTier?: string;
  };
}

/**
 * Get the path to .credentials.json (Linux/Windows)
 */
function getCredentialsPath(): string {
  return path.join(os.homedir(), ".claude", ".credentials.json");
}

/**
 * Read credentials from macOS Keychain
 * macOS stores Claude Code credentials in Keychain, not in a file
 */
function readFromMacKeychain(): ClaudeCredentials | null {
  try {
    // Use security command to read from Keychain
    const result = execSync('security find-generic-password -s "Claude Code-credentials" -w', {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"], // Suppress stderr
    });

    const credentials: ClaudeCredentials = JSON.parse(result.trim());
    return credentials;
  } catch {
    // Keychain access failed or credentials not found
    return null;
  }
}

/**
 * Read credentials from file (Linux/Windows)
 */
function readFromFile(): ClaudeCredentials | null {
  const credentialsPath = getCredentialsPath();

  if (!fs.existsSync(credentialsPath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(credentialsPath, "utf-8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Map subscription type to CCPlan
 * - Known values (free, pro, max) are normalized
 * - Unknown values (team, enterprise, etc.) are passed through for server logging
 */
function mapSubscriptionToCCPlan(subscriptionType: string | undefined): CCPlan | null {
  if (!subscriptionType) {
    return null;
  }

  const type = subscriptionType.toLowerCase();

  // Known subscription types - normalize
  if (type === "max" || type.includes("max")) {
    return "max";
  }

  if (type === "pro") {
    return "pro";
  }

  if (type === "free") {
    return "free";
  }

  // Unknown types (team, enterprise, etc.) - pass through for server logging
  // This helps us discover actual values from Team/Enterprise users
  return type;
}

/**
 * Infer CCPlan from rateLimitTier
 * Examples:
 * - "default_claude_max_20x" → "max"
 * - "default_claude_pro" → "pro"
 * - "free" → "free"
 */
function inferPlanFromRateLimitTier(rateLimitTier: string | undefined): CCPlan | null {
  if (!rateLimitTier) {
    return null;
  }

  const tier = rateLimitTier.toLowerCase();

  if (tier.includes("max")) {
    return "max";
  }

  if (tier.includes("pro")) {
    return "pro";
  }

  if (tier.includes("team") || tier.includes("enterprise")) {
    return "team";
  }

  if (tier.includes("free")) {
    return "free";
  }

  return null;
}

/**
 * Read credentials from platform-specific storage
 * - macOS: Keychain
 * - Linux/Windows: ~/.claude/.credentials.json
 *
 * Returns account information or null values if not found
 */
export function readCredentials(): CredentialsData {
  // Default return value for errors
  const defaultData: CredentialsData = {
    ccplan: null,
    rateLimitTier: null,
  };

  let credentials: ClaudeCredentials | null = null;

  // Try macOS Keychain first (if on macOS)
  if (process.platform === "darwin") {
    credentials = readFromMacKeychain();
  }

  // Fallback to file-based credentials (Linux/Windows, or if Keychain failed)
  if (!credentials) {
    credentials = readFromFile();
  }

  if (!credentials) {
    return defaultData;
  }

  // Extract OAuth data
  const oauthData = credentials.claudeAiOauth;

  if (!oauthData) {
    return defaultData;
  }

  // Map subscription type to CCPlan, fallback to rateLimitTier inference
  const rateLimitTier = oauthData.rateLimitTier || null;
  const ccplan =
    mapSubscriptionToCCPlan(oauthData.subscriptionType) ||
    inferPlanFromRateLimitTier(rateLimitTier);

  return {
    ccplan,
    rateLimitTier,
  };
}
