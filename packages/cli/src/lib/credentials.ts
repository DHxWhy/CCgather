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
 * - "default_claude_team_*" → "team"
 * - "default_claude_enterprise_*" → "enterprise"
 */
function inferPlanFromRateLimitTier(rateLimitTier: string | undefined): CCPlan | null {
  if (!rateLimitTier) {
    return null;
  }

  const tier = rateLimitTier.toLowerCase();

  // Order matters: check more specific patterns first
  if (tier.includes("enterprise")) {
    return "enterprise";
  }

  if (tier.includes("team")) {
    return "team";
  }

  if (tier.includes("max")) {
    return "max";
  }

  if (tier.includes("pro")) {
    return "pro";
  }

  if (tier.includes("free")) {
    return "free";
  }

  return null;
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
  const rateLimitTier = oauthData.rateLimitTier || null;
  const rawSubscriptionType = oauthData.subscriptionType || null;
  const ccplan =
    mapSubscriptionToCCPlan(rawSubscriptionType) || inferPlanFromRateLimitTier(rateLimitTier);

  return {
    ccplan,
    rateLimitTier,
    authMethod: "oauth",
    rawSubscriptionType,
  };
}
