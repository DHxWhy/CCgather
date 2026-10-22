import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { execSync } from "child_process";

export type CCPlan = string;

// How Claude Code signs in: a claude.ai subscription, API usage billing, or a cloud provider.
export type AuthMethod = "oauth" | "api_key" | "cloud" | "unknown";

export interface CredentialsData {
  ccplan: CCPlan | null; // a plan key the server knows (lib/services/auth-plan.ts), or null
  rateLimitTier: string | null;
  authMethod: AuthMethod;
  rawSubscriptionType: string | null; // what decided it, for the server's discovery log
}

type Env = Record<string, string | undefined>;
type JsonObject = Record<string, unknown>;

interface OAuthCredentials {
  subscriptionType?: unknown;
  rateLimitTier?: unknown;
}

// Claude Code 2.1.306 takes the first provider whose variable is set, in this order, and
// shows Mantle on top of Bedrock as Mantle.
const PROVIDERS = [
  ["CLAUDE_CODE_USE_BEDROCK", "bedrock"],
  ["CLAUDE_CODE_USE_FOUNDRY", "foundry"],
  ["CLAUDE_CODE_USE_ANTHROPIC_AWS", "aws_platform"],
  ["CLAUDE_CODE_USE_ANTHROPIC_GOOGLE_CLOUD", "gcp_platform"],
  ["CLAUDE_CODE_USE_MANTLE", "mantle"],
  ["CLAUDE_CODE_USE_VERTEX", "vertex"],
] as const;

const SUBSCRIPTION_PLANS = ["free", "pro", "max", "team", "enterprise"];

// Claude Code's own reading of these switches.
const isTruthy = (v: string | undefined): boolean =>
  v !== undefined && ["1", "true", "yes", "on"].includes(v.toLowerCase().trim());

const filled = (v: unknown): string | null => (typeof v === "string" && v.trim() !== "" ? v : null);

const isObject = (v: unknown): v is JsonObject =>
  v !== null && typeof v === "object" && !Array.isArray(v);

function readJsonFile(file: string): JsonObject | null {
  try {
    const value: unknown = JSON.parse(fs.readFileSync(file, "utf-8"));
    return isObject(value) ? value : null;
  } catch {
    return null;
  }
}

// The paths Claude Code uses: CLAUDE_CONFIG_DIR replaces ~/.claude and also holds .claude.json.
function claudePaths(env: Env, home: string) {
  const configDir = filled(env.CLAUDE_CONFIG_DIR);
  const dir = configDir ?? path.join(home, ".claude");
  return {
    globalConfig: path.join(configDir ?? home, ".claude.json"),
    userSettings: path.join(dir, "settings.json"),
    credentials: path.join(dir, ".credentials.json"),
  };
}

/** macOS keeps Claude Code's login in the Keychain rather than in a file. */
function readFromMacKeychain(): JsonObject | null {
  try {
    const result = execSync('security find-generic-password -s "Claude Code-credentials" -w', {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    const parsed: unknown = JSON.parse(result.trim());
    return isObject(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function readOAuthCredentials(credentialsFile: string): OAuthCredentials | null {
  const stored =
    (process.platform === "darwin" ? readFromMacKeychain() : null) ?? readJsonFile(credentialsFile);
  return stored && isObject(stored.claudeAiOauth) ? stored.claudeAiOauth : null;
}

// The saved plan ("max") or a tier that names it ("default_claude_max_20x"); only the
// server's plan keys are sent.
function planFrom(oauth: OAuthCredentials): string | null {
  for (const raw of [oauth.subscriptionType, oauth.rateLimitTier]) {
    if (typeof raw !== "string") continue;
    const words = raw.toLowerCase().split(/[^a-z0-9]+/);
    const plan = SUBSCRIPTION_PLANS.find((p) => words.includes(p));
    if (plan) return plan;
  }
  return null;
}

// Interactive Claude Code uses ANTHROPIC_API_KEY only once the user approves it, and keeps
// the answer in .claude.json under the key's last 20 characters.
function apiKeyAnswer(
  key: string,
  globalConfig: JsonObject | null
): "approved" | "rejected" | "new" {
  const answers = isObject(globalConfig?.customApiKeyResponses)
    ? globalConfig.customApiKeyResponses
    : {};
  const tail = key.trim().slice(-20);
  if (Array.isArray(answers.approved) && answers.approved.includes(tail)) return "approved";
  if (Array.isArray(answers.rejected) && answers.rejected.includes(tail)) return "rejected";
  return "new";
}

const apiBilling = (source: string): CredentialsData => ({
  ccplan: "api",
  rateLimitTier: null,
  authMethod: "api_key",
  rawSubscriptionType: source,
});

function subscription(oauth: OAuthCredentials | null): CredentialsData {
  return {
    ccplan: oauth ? planFrom(oauth) : null,
    rateLimitTier: typeof oauth?.rateLimitTier === "string" ? oauth.rateLimitTier : null,
    authMethod: "oauth",
    rawSubscriptionType:
      typeof oauth?.subscriptionType === "string" ? oauth.subscriptionType : null,
  };
}

/**
 * The credential Claude Code would sign in with, in its documented order
 * (code.claude.com/docs/en/authentication, "Authentication precedence"): a cloud provider,
 * ANTHROPIC_AUTH_TOKEN, an approved ANTHROPIC_API_KEY or a key saved by a Claude Console
 * login, apiKeyHelper, CLAUDE_CODE_OAUTH_TOKEN, an Anthropic profile or federation
 * credentials, then the /login subscription. Variables in the settings file's env block count
 * like shell variables.
 */
export function readCredentials(
  env: Env = process.env,
  home: string = os.homedir()
): CredentialsData {
  const paths = claudePaths(env, home);
  const settings = readJsonFile(paths.userSettings);
  const settingsEnv = isObject(settings?.env) ? settings.env : {};
  const variable = (name: string): string | undefined => {
    const fromSettings = settingsEnv[name];
    return env[name] ?? (typeof fromSettings === "string" ? fromSettings : undefined);
  };

  const provider = PROVIDERS.find(([name]) => isTruthy(variable(name)));
  if (provider) {
    const [name, plan] = provider;
    const mantle = plan === "bedrock" && isTruthy(variable("CLAUDE_CODE_USE_MANTLE"));
    return {
      ccplan: mantle ? "mantle" : plan,
      rateLimitTier: null,
      authMethod: "cloud",
      rawSubscriptionType: name,
    };
  }

  if (filled(variable("ANTHROPIC_AUTH_TOKEN"))) return apiBilling("ANTHROPIC_AUTH_TOKEN");

  const globalConfig = readJsonFile(paths.globalConfig);
  const apiKey = filled(variable("ANTHROPIC_API_KEY"));
  const answer = apiKey ? apiKeyAnswer(apiKey, globalConfig) : null;
  if (answer === "approved") return apiBilling("ANTHROPIC_API_KEY");
  if (filled(globalConfig?.primaryApiKey)) return apiBilling("console_login");
  if (filled(settings?.apiKeyHelper)) return apiBilling("apiKeyHelper");

  if (filled(variable("CLAUDE_CODE_OAUTH_TOKEN"))) {
    return subscription(readOAuthCredentials(paths.credentials));
  }

  const federation =
    filled(variable("ANTHROPIC_FEDERATION_RULE_ID")) &&
    filled(variable("ANTHROPIC_ORGANIZATION_ID"));
  if (filled(variable("ANTHROPIC_PROFILE")) || federation) return apiBilling("anthropic_profile");

  const oauth = readOAuthCredentials(paths.credentials);
  if (oauth) return subscription(oauth);

  // A key nobody has answered yet is still what a non-interactive run (`claude -p`) uses.
  if (answer === "new") return apiBilling("ANTHROPIC_API_KEY");

  return { ccplan: null, rateLimitTier: null, authMethod: "unknown", rawSubscriptionType: null };
}
