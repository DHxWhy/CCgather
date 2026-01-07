import * as fs from "fs";
import * as path from "path";
import * as os from "os";

export type CCPlan = "free" | "pro" | "max" | "team";

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
 * Map subscription type to CCPlan enum
 */
function mapSubscriptionToCCPlan(subscriptionType: string | undefined): CCPlan {
  if (!subscriptionType) {
    return "free";
  }

  const type = subscriptionType.toLowerCase();

  // Check for max
  if (type === "max" || type.includes("max")) {
    return "max";
  }

  // Check for team/enterprise
  if (type === "team" || type === "enterprise") {
    return "team";
  }

  // Check for pro
  if (type === "pro") {
    return "pro";
  }

  // Default to free
  return "free";
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

    // Map subscription type to CCPlan
    const ccplan = mapSubscriptionToCCPlan(oauthData.subscriptionType);
    const rateLimitTier = oauthData.rateLimitTier || null;

    return {
      ccplan,
      rateLimitTier,
    };
  } catch (error) {
    // Handle file read or JSON parse errors gracefully
    return defaultData;
  }
}
