import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { createHash } from "crypto";
import { execFileSync } from "child_process";

export type CCPlan = string;

// How Claude Code signs in: a claude.ai subscription, API usage billing, or a cloud provider.
export type AuthMethod = "oauth" | "api_key" | "cloud" | "unknown";

export interface CredentialsData {
  ccplan: CCPlan | null; // a plan key the server knows (lib/services/auth-plan.ts), or null
  rateLimitTier: string | null;
  authMethod: AuthMethod;
  rawSubscriptionType: string | null; // what decided it, for the server's discovery log
}

export interface ReadCredentialsOptions {
  platform?: NodeJS.Platform;
  managedSettingsDir?: string; // tests point this away from the system folder
}

type Env = Record<string, string | undefined>;
type JsonObject = Record<string, unknown>;

// Claude Code 2.1.306–2.1.308 takes the first provider whose variable is set, in this order,
// and shows Mantle on top of Bedrock as Mantle.
export const PROVIDERS = [
  ["CLAUDE_CODE_USE_BEDROCK", "bedrock"],
  ["CLAUDE_CODE_USE_FOUNDRY", "foundry"],
  ["CLAUDE_CODE_USE_ANTHROPIC_AWS", "aws_platform"],
  ["CLAUDE_CODE_USE_ANTHROPIC_GOOGLE_CLOUD", "gcp_platform"],
  ["CLAUDE_CODE_USE_MANTLE", "mantle"],
  ["CLAUDE_CODE_USE_VERTEX", "vertex"],
] as const;

export const SUBSCRIPTION_PLANS = ["free", "pro", "max", "team", "enterprise"] as const;

/** Every ccplan value this CLI sends; tests/unit/plan-keys-parity.test.ts keeps it inside the server's keys. */
export const SENT_PLAN_KEYS: readonly string[] = [
  ...SUBSCRIPTION_PLANS,
  "api",
  ...PROVIDERS.map(([, plan]) => plan),
];

// Claude Code's own reading of these switches.
const isTruthy = (v: string | undefined): boolean =>
  v !== undefined && ["1", "true", "yes", "on"].includes(v.toLowerCase().trim());

const filled = (v: unknown): string | null => (typeof v === "string" && v.trim() !== "" ? v : null);

const isObject = (v: unknown): v is JsonObject =>
  v !== null && typeof v === "object" && !Array.isArray(v);

function readText(file: string): string | null {
  try {
    return fs.readFileSync(file, "utf-8");
  } catch {
    return null;
  }
}

function readJsonFile(file: string): JsonObject | null {
  try {
    const value: unknown = JSON.parse(readText(file) ?? "");
    return isObject(value) ? value : null;
  } catch {
    return null;
  }
}

function fileSize(file: string): number {
  try {
    const stat = fs.statSync(file);
    return stat.isFile() ? stat.size : 0;
  } catch {
    return 0;
  }
}

// The paths Claude Code uses: CLAUDE_CONFIG_DIR replaces ~/.claude and also holds .claude.json,
// a non-empty legacy .config.json in that folder is read instead of .claude.json, and the login
// file follows CLAUDE_SECURESTORAGE_CONFIG_DIR when it is set (empty means ~/.claude).
function claudePaths(env: Env, home: string) {
  const configDir = filled(env.CLAUDE_CONFIG_DIR);
  const dir = configDir ?? path.join(home, ".claude");
  const legacyConfig = path.join(dir, ".config.json");
  const secure = env.CLAUDE_SECURESTORAGE_CONFIG_DIR;
  const secureDir = secure === undefined ? dir : secure || path.join(home, ".claude");
  return {
    globalConfig:
      fileSize(legacyConfig) > 0 ? legacyConfig : path.join(configDir ?? home, ".claude.json"),
    userSettings: path.join(dir, "settings.json"),
    credentials: path.join(secureDir, ".credentials.json"),
  };
}

export function systemManagedSettingsDir(platform: NodeJS.Platform): string {
  if (platform === "darwin") return "/Library/Application Support/ClaudeCode";
  if (platform === "win32") return "C:\\Program Files\\ClaudeCode";
  return "/etc/claude-code";
}

// Settings an administrator installs: managed-settings.json, then managed-settings.d/*.json in
// name order, each overriding the ones before.
function readManagedSettings(dir: string): JsonObject[] {
  const files = [path.join(dir, "managed-settings.json")];
  try {
    const dropIns = path.join(dir, "managed-settings.d");
    for (const name of fs.readdirSync(dropIns).sort()) {
      if (name.endsWith(".json") && !name.startsWith(".")) files.push(path.join(dropIns, name));
    }
  } catch {
    // no drop-in folder
  }
  return files.map(readJsonFile).filter((s): s is JsonObject => s !== null);
}

/**
 * The Keychain item Claude Code uses on macOS. With CLAUDE_CONFIG_DIR set the name ends in the
 * first 8 hex digits of the folder's sha256 (NFC), so each config folder keeps its own login;
 * CLAUDE_SECURESTORAGE_CONFIG_DIR, when set, names the folder instead (Claude Code 2.1.308).
 */
export function keychainService(env: Env, item: "-credentials" | ""): string {
  const secure = env.CLAUDE_SECURESTORAGE_CONFIG_DIR;
  const plain = secure !== undefined ? !secure : !env.CLAUDE_CONFIG_DIR;
  if (plain) return `Claude Code${item}`;
  const folder = (secure ?? env.CLAUDE_CONFIG_DIR ?? "").normalize("NFC");
  return `Claude Code${item}-${createHash("sha256").update(folder).digest("hex").slice(0, 8)}`;
}

// Claude Code's Keychain account: $USER when it is a plain name.
function keychainAccount(env: Env): string {
  let name: string;
  try {
    name = env.USER || os.userInfo().username;
  } catch {
    name = "claude-code-user";
  }
  return /^[a-zA-Z0-9._-]+$/.test(name) ? name : "claude-code-user";
}

// `security` exits non-zero when the item is missing; -w prints the stored secret.
function runSecurity(args: string[]): string | null {
  try {
    return execFileSync("security", ["find-generic-password", ...args], {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 5000,
    });
  } catch {
    return null;
  }
}

// macOS keeps the login in the Keychain; other systems (and older macOS setups) in a file.
function readSecureStorage(env: Env, file: string, platform: NodeJS.Platform): JsonObject | null {
  if (platform === "darwin") {
    const service = keychainService(env, "-credentials");
    const stored = runSecurity(["-a", keychainAccount(env), "-w", "-s", service]);
    if (stored !== null) {
      try {
        const parsed: unknown = JSON.parse(stored.trim());
        if (isObject(parsed)) return parsed;
      } catch {
        // fall back to the file
      }
    }
  }
  return readJsonFile(file);
}

// Claude Code restores a saved gateway sign-in at start-up only for a host this machine trusts,
// and not once it has expired without a refresh token (its Xmn()).
function isSavedGatewaySignIn(stored: JsonObject | null): boolean {
  const gateway = stored?.enterpriseGateway;
  if (!isObject(gateway)) return false;
  let host: string;
  try {
    host = new URL(String(gateway.url)).hostname.replace(/^\[|\]$/g, "");
  } catch {
    return false;
  }
  const trust = stored?.gatewayTrust;
  if (!isObject(trust) || !trust[host]) return false;
  return !(Number(gateway.expiresAt) <= Date.now() && !gateway.idpRefreshToken);
}

// Managed settings can require a gateway sign-in: forceLoginMethod "gateway" or a gateway URL
// (Claude Code's Gce()). A value its schema rejects counts as unset.
function managedRequiresGateway(managed: JsonObject[]): boolean {
  const layers = [...managed].reverse();
  const method = layers.find(
    (s) =>
      typeof s.forceLoginMethod === "string" &&
      ["claudeai", "console", "gateway"].includes(s.forceLoginMethod)
  )?.forceLoginMethod;
  const url = layers.find(
    (s) => typeof s.forceLoginGatewayUrl === "string" && s.forceLoginGatewayUrl !== ""
  );
  return method === "gateway" || url !== undefined;
}

// A key saved by a Claude Console login: .claude.json's primaryApiKey, or on macOS the
// Keychain item "Claude Code" (asked for without -w, so the key itself is never read).
function hasStoredConsoleKey(
  env: Env,
  globalConfig: JsonObject | null,
  platform: NodeJS.Platform
): boolean {
  if (filled(globalConfig?.primaryApiKey)) return true;
  return (
    platform === "darwin" &&
    runSecurity(["-s", keychainService(env, ""), "-a", keychainAccount(env)]) !== null
  );
}

// The saved plan ("max") or a tier that names it ("default_claude_max_20x"); only the
// server's plan keys are sent.
function planFrom(oauth: JsonObject): string | null {
  for (const raw of [oauth.subscriptionType, oauth.rateLimitTier]) {
    if (typeof raw !== "string") continue;
    const words = raw.toLowerCase().split(/[^a-z0-9]+/);
    const plan = SUBSCRIPTION_PLANS.find((p) => words.includes(p));
    if (plan) return plan;
  }
  return null;
}

// A /login Claude Code can run on: an access token with the inference scope.
const isUsableLogin = (oauth: JsonObject | null): boolean =>
  filled(oauth?.accessToken) !== null &&
  Array.isArray(oauth?.scopes) &&
  oauth.scopes.includes("user:inference");

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

// Anthropic profiles live in <dir>/configs/<name>.json. Claude Code counts one only when its
// authentication.type is oidc_federation, or user_oauth with a non-empty credentials file.
function profileAuthType(dir: string, name: string): "oidc_federation" | "user_oauth" | null {
  const config = readJsonFile(path.join(dir, "configs", `${name}.json`));
  const auth = isObject(config?.authentication) ? config.authentication : null;
  if (auth?.type === "oidc_federation") return "oidc_federation";
  if (auth?.type !== "user_oauth") return null;
  const credentialsFile =
    typeof auth.credentials_path === "string"
      ? auth.credentials_path
      : path.join(dir, "credentials", `${name}.json`);
  return readText(credentialsFile)?.trim() ? "user_oauth" : null;
}

// Where Anthropic profiles live: ANTHROPIC_CONFIG_DIR, else $XDG_CONFIG_HOME/anthropic, else
// $HOME/.config/anthropic.
function anthropicConfigDir(variable: (name: string) => string | undefined): string | null {
  const named = variable("ANTHROPIC_CONFIG_DIR")?.trim();
  if (named) return named;
  const xdg = variable("XDG_CONFIG_HOME")?.trim();
  if (xdg) return path.join(xdg, "anthropic");
  const home = variable("HOME")?.trim();
  return home ? path.join(home, ".config", "anthropic") : null;
}

const apiBilling = (source: string): CredentialsData => ({
  ccplan: "api",
  rateLimitTier: null,
  authMethod: "api_key",
  rawSubscriptionType: source,
});

const unknown = (source: string | null): CredentialsData => ({
  ccplan: null,
  rateLimitTier: null,
  authMethod: "unknown",
  rawSubscriptionType: source,
});

// Plan values are trimmed: the server stores the tier as sent.
const trimmed = (v: unknown): string | null => (typeof v === "string" ? v.trim() || null : null);

function subscription(oauth: JsonObject | null): CredentialsData {
  return {
    ccplan: oauth ? planFrom(oauth) : null,
    rateLimitTier: trimmed(oauth?.rateLimitTier),
    authMethod: "oauth",
    rawSubscriptionType: trimmed(oauth?.subscriptionType),
  };
}

/**
 * The credential Claude Code would sign in with, in the order of its 2.1.308 build and the
 * documented precedence (code.claude.com/docs/en/authentication): an enterprise gateway
 * (CLAUDE_CODE_USE_GATEWAY with a base URL and token, a trusted saved sign-in, or managed
 * settings that require one), a cloud provider, ANTHROPIC_AUTH_TOKEN, an approved
 * ANTHROPIC_API_KEY, apiKeyHelper, a key
 * saved by a Claude Console login (unused while a subscription login or CLAUDE_CODE_OAUTH_TOKEN
 * can sign in), CLAUDE_CODE_OAUTH_TOKEN, an Anthropic profile or federation, then the /login
 * subscription.
 *
 * Settings env blocks replace the shell's variables, as Claude Code applies them (strings,
 * numbers and booleans): .claude.json's legacy env, then the user's settings, then managed
 * settings files. A non-interactive `claude -p` also uses an ANTHROPIC_API_KEY the user rejected
 * or never answered; this reports the interactive choice (the subscription when there is a
 * login), which decides most usage. In bare mode (--bare, CLAUDE_CODE_SIMPLE) no login, OAuth
 * token or profile is used: Anthropic auth is ANTHROPIC_AUTH_TOKEN, ANTHROPIC_API_KEY or an
 * apiKeyHelper given with --settings, while a gateway still applies (on macOS bare mode reads
 * no Keychain, so a gateway saved there is not looked for).
 * Not read: MDM or registry policies, server-managed settings, project and local settings,
 * --settings and other flags, the Windows Credential Manager store, a custom OAuth URL's
 * separate login, credentials a remote host hands to Claude Code or a session it manages, and
 * for a saved gateway the organization's gateway policy and the live TLS check — those cases
 * report what the files say.
 */
export function readCredentials(
  env: Env = process.env,
  home: string = os.homedir(),
  options: ReadCredentialsOptions = {}
): CredentialsData {
  const platform = options.platform ?? process.platform;
  const paths = claudePaths(env, home);
  const globalConfig = readJsonFile(paths.globalConfig);
  const userSettings = readJsonFile(paths.userSettings);
  const managed = readManagedSettings(
    options.managedSettingsDir ?? systemManagedSettingsDir(platform)
  );
  // Last applied first: managed drop-ins, managed, the user's settings, .claude.json's env.
  const settingsLayers = [...managed].reverse().concat(userSettings ?? {});
  const envLayers = [...settingsLayers, globalConfig].map((s) => (isObject(s?.env) ? s.env : {}));
  const variable = (name: string): string | undefined => {
    for (const layer of envLayers) {
      const value = layer[name];
      if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        return String(value);
      }
    }
    return env[name];
  };
  const setting = (key: string): unknown => settingsLayers.find((s) => s[key] !== undefined)?.[key];

  const bare = isTruthy(variable("CLAUDE_CODE_SIMPLE"));
  // Bare mode skips the Keychain; the file is still read at start-up for a gateway sign-in.
  const stored =
    bare && platform === "darwin" ? null : readSecureStorage(env, paths.credentials, platform);
  const envGateway =
    isTruthy(variable("CLAUDE_CODE_USE_GATEWAY")) &&
    filled(variable("ANTHROPIC_BASE_URL")) !== null &&
    filled(variable("ANTHROPIC_AUTH_TOKEN")) !== null;
  const provider = PROVIDERS.find(([name]) => isTruthy(variable(name)));
  // No plan key describes a gateway sign-in; null keeps the plan the server has. The variable
  // gateway and a restored sign-in come ahead of any provider (Re()); managed settings that
  // require a gateway apply when no provider is on (LLe()). A saved sign-in that will not be
  // restored also says null: a policy this does not read (MDM) may still require the gateway.
  if (envGateway || isSavedGatewaySignIn(stored)) return unknown("enterprise_gateway");
  if (
    !provider &&
    ((!isTruthy(variable("CLAUDE_CODE_PROVIDER_MANAGED_BY_HOST")) &&
      managedRequiresGateway(managed)) ||
      isObject(stored?.enterpriseGateway))
  ) {
    return unknown("enterprise_gateway");
  }
  // A saved login without an access token is not one Claude Code can use.
  const login = stored?.claudeAiOauth;
  const oauth = isObject(login) && filled(login.accessToken) ? login : null;
  const oauthToken = filled(variable("CLAUDE_CODE_OAUTH_TOKEN"));

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

  if (bare) {
    return filled(variable("ANTHROPIC_API_KEY"))
      ? apiBilling("ANTHROPIC_API_KEY")
      : unknown("bare_mode");
  }

  const apiKey = filled(variable("ANTHROPIC_API_KEY"));
  const answer = apiKey ? apiKeyAnswer(apiKey, globalConfig) : null;
  if (answer === "approved") return apiBilling("ANTHROPIC_API_KEY");
  if (filled(setting("apiKeyHelper"))) return apiBilling("apiKeyHelper");
  // Claude Code signs in as a subscriber when its OAuth credential can run inference: the
  // token's scopes (CLAUDE_CODE_OAUTH_SCOPES, else user:inference) or the saved login's. Only
  // then is a saved Console key left unused.
  const tokenScopes = variable("CLAUDE_CODE_OAUTH_SCOPES")?.split(/\s+/).filter(Boolean) ?? [];
  const subscribes = oauthToken
    ? (tokenScopes.length > 0 ? tokenScopes : ["user:inference"]).includes("user:inference")
    : isUsableLogin(oauth);
  if (!subscribes && hasStoredConsoleKey(env, globalConfig, platform)) {
    return apiBilling("console_login");
  }

  // A long-lived token carries no plan of its own: Claude Code takes it from these variables.
  if (oauthToken) {
    return subscription({
      subscriptionType: variable("CLAUDE_CODE_SUBSCRIPTION_TYPE") || null,
      rateLimitTier: variable("CLAUDE_CODE_RATE_LIMIT_TIER") || null,
    });
  }

  // A named profile that does not resolve is ignored, and then neither federation variables
  // nor the active profile are looked at (Claude Code's pe()).
  const profileName = variable("ANTHROPIC_PROFILE")?.trim();
  const profileDir = anthropicConfigDir(variable);
  if (profileName) {
    if (profileDir && profileAuthType(profileDir, profileName)) {
      return apiBilling("anthropic_profile");
    }
  } else if (
    filled(variable("ANTHROPIC_FEDERATION_RULE_ID")) &&
    filled(variable("ANTHROPIC_ORGANIZATION_ID"))
  ) {
    return apiBilling("anthropic_federation");
  } else if (profileDir) {
    const active = readText(path.join(profileDir, "active_config"))?.trim() || "default";
    const type = profileAuthType(profileDir, active);
    if (type === "oidc_federation") return apiBilling("anthropic_profile");
    // Next to a working claude.ai login, Claude Code uses the login and warns that the
    // profile is skipped.
    if (type === "user_oauth") {
      return isUsableLogin(oauth) ? subscription(oauth) : apiBilling("anthropic_profile");
    }
  }

  if (oauth) return subscription(oauth);

  if (answer === "new") return apiBilling("ANTHROPIC_API_KEY");

  return unknown(null);
}
