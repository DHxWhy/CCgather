import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { execSync } from "child_process";

export type CCPlan = "free" | "pro" | "max" | "team" | "enterprise" | string;

// Authentication method used
export type AuthMethod = "oauth" | "api_key" | "unknown";

export interface CredentialsData {
  ccplan: CCPlan | null;
  rateLimitTier: string | null;
  authMethod: AuthMethod;
  rawSubscriptionType: string | null; // Original value for server logging
}

interface ClaudeCredentials {
  claudeAiOauth?: {
    subscriptionType?: string;
    rateLimitTier?: string;
  };
  // API Key based auth (Anthropic Console) may have different structure
  anthropicConsole?: {
    apiKey?: string;
    organizationId?: string;
    organizationType?: string; // "team" | "enterprise" | "personal"
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
 * - Pass through as-is for badge display (no normalization)
 * - This allows distinguishing max vs max_20x, and discovering new plan types
 */
function mapSubscriptionToCCPlan(subscriptionType: string | undefined): CCPlan | null {
  if (!subscriptionType) {
    return null;
  }

  // Return as-is (lowercase) for badge display
  // Examples: "free", "pro", "max", "max_20x", "team", "enterprise", etc.
  return subscriptionType.toLowerCase();
}

/**
 * Infer CCPlan from rateLimitTier
 * Extracts the most specific plan identifier from tier string
 * Examples:
 * - "default_claude_max_20x" → "max_20x"
 * - "default_claude_max" → "max"
 * - "default_claude_pro" → "pro"
 * - "free" → "free"
 * - "default_claude_team_5x" → "team_5x"
 * - "default_claude_enterprise_10x" → "enterprise_10x"
 */
function inferPlanFromRateLimitTier(rateLimitTier: string | undefined): CCPlan | null {
  if (!rateLimitTier) {
    return null;
  }

  const tier = rateLimitTier.toLowerCase();

  // Try to extract plan with multiplier (e.g., "max_20x", "team_5x")
  // Pattern: default_claude_{plan}_{multiplier} or default_claude_{plan}
  const match = tier.match(/(?:default_claude_)?(\w+?)(?:_(\d+x))?$/);
  if (match) {
    const plan = match[1];
    const multiplier = match[2];

    // Known plan types
    if (["max", "pro", "free", "team", "enterprise"].includes(plan)) {
      return multiplier ? `${plan}_${multiplier}` : plan;
    }
  }

  // Fallback: check for known keywords anywhere in string
  if (tier.includes("enterprise")) return "enterprise";
  if (tier.includes("team")) return "team";
  if (tier.includes("max")) return tier.includes("20x") ? "max_20x" : "max";
  if (tier.includes("pro")) return "pro";
  if (tier.includes("free")) return "free";

  // Unknown tier - return as-is
  return tier;
}

/**
 * Detect if user is using API Key authentication (Team/Enterprise)
 * Team/Enterprise users typically authenticate via Anthropic Console with API keys
 */
function detectApiKeyAuth(): { isApiKey: boolean; orgType: CCPlan | null } {
  // Check environment variables that indicate API key usage
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
  const claudeOAuthToken = process.env.CLAUDE_CODE_OAUTH_TOKEN;

  // If ANTHROPIC_API_KEY is set without OAuth token, likely Team/Enterprise
  if (anthropicApiKey && !claudeOAuthToken) {
    // API keys from Team/Enterprise may have specific prefixes or patterns
    // sk-ant-api03- is typical for console API keys
    if (anthropicApiKey.startsWith("sk-ant-api")) {
      return { isApiKey: true, orgType: null }; // Can't determine exact type from key
    }
  }

  return { isApiKey: false, orgType: null };
}

/**
 * Read credentials from platform-specific storage
 * - macOS: Keychain
 * - Linux/Windows: ~/.claude/.credentials.json
 *
 * Also detects API Key authentication (used by Team/Enterprise)
 *
 * Returns account information or null values if not found
 */
export function readCredentials(): CredentialsData {
  // Default return value for errors
  const defaultData: CredentialsData = {
    ccplan: null,
    rateLimitTier: null,
    authMethod: "unknown",
    rawSubscriptionType: null,
  };

  // First, check for API Key authentication (Team/Enterprise typically uses this)
  const apiKeyAuth = detectApiKeyAuth();
  if (apiKeyAuth.isApiKey) {
    return {
      ccplan: apiKeyAuth.orgType || "team", // Default to "team" for API key users
      rateLimitTier: null,
      authMethod: "api_key",
      rawSubscriptionType: "api_key_auth", // Signal to server that this is API key auth
    };
  }

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

  // Check for Anthropic Console auth structure (Team/Enterprise)
  if (credentials.anthropicConsole?.organizationType) {
    const orgType = credentials.anthropicConsole.organizationType.toLowerCase();
    return {
      ccplan: orgType === "enterprise" ? "enterprise" : orgType === "team" ? "team" : orgType,
      rateLimitTier: null,
      authMethod: "api_key",
      rawSubscriptionType: orgType,
    };
  }

  // Extract OAuth data (Pro/Max individual users)
  const oauthData = credentials.claudeAiOauth;

  if (!oauthData) {
    return defaultData;
  }

  // Map subscription type to CCPlan, fallback to rateLimitTier inference
  const rateLimitTier = oauthData.rateLimitTier ?? null;
  const rawSubscriptionType = oauthData.subscriptionType ?? null;
  const ccplan =
    mapSubscriptionToCCPlan(rawSubscriptionType ?? undefined) ||
    inferPlanFromRateLimitTier(rateLimitTier ?? undefined);

  return {
    ccplan,
    rateLimitTier,
    authMethod: "oauth",
    rawSubscriptionType,
  };
}
