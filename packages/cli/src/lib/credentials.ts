import * as fs from "fs";
import * as path from "path";
import * as os from "os";

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
 * Get the path to .credentials.json
 */
function getCredentialsPath(): string {
  return path.join(os.homedir(), ".claude", ".credentials.json");
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
 * Read credentials from ~/.claude/.credentials.json
 * Returns account information or null values if file not found or parse error
 */
export function readCredentials(): CredentialsData {
  const credentialsPath = getCredentialsPath();

  // Default return value for errors
  const defaultData: CredentialsData = {
    ccplan: null,
    rateLimitTier: null,
  };

  // Check if file exists
  if (!fs.existsSync(credentialsPath)) {
    return defaultData;
  }

  try {
    // Read and parse the file
    const content = fs.readFileSync(credentialsPath, "utf-8");
    const credentials: ClaudeCredentials = JSON.parse(content);

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
  } catch (error) {
    // Handle file read or JSON parse errors gracefully
    return defaultData;
  }
}
