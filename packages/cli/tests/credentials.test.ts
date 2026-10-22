import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

// Never reach a real macOS Keychain from a test: every `security` call goes through this.
const security = vi.hoisted(() => ({
  run: vi.fn<(args: string[], options?: { timeout?: number }) => string>(),
}));

vi.mock("child_process", () => ({
  execFileSync: (_command: string, args: string[], options?: { timeout?: number }) =>
    security.run(args, options),
}));

import {
  keychainService,
  readCredentials,
  SENT_PLAN_KEYS,
  type ReadCredentialsOptions,
} from "../src/lib/credentials";

const KEY = "sk-ant-api03-test-key-0123456789abcdefghij";
const TAIL = KEY.slice(-20);

let home: string;

function write(relativePath: string, value: unknown): void {
  const file = path.join(home, relativePath);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, typeof value === "string" ? value : JSON.stringify(value));
}

const oauth = (subscriptionType?: string, rateLimitTier?: string, extra = {}) =>
  write(".claude/.credentials.json", {
    claudeAiOauth: { subscriptionType, rateLimitTier, ...extra },
  });

// Managed settings come from a folder under the test home, never the system's.
const creds = (env: Record<string, string | undefined>, options: ReadCredentialsOptions = {}) =>
  readCredentials(env, home, { managedSettingsDir: path.join(home, "managed"), ...options });

const noKeychain = () => {
  throw new Error("no keychain in tests");
};

beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), "ccgather-creds-"));
  security.run.mockReset();
  security.run.mockImplementation(noKeychain);
});

afterEach(() => {
  fs.rmSync(home, { recursive: true, force: true });
});

describe("cloud providers (Claude Code's own order)", () => {
  it.each([
    ["CLAUDE_CODE_USE_BEDROCK", "bedrock"],
    ["CLAUDE_CODE_USE_VERTEX", "vertex"],
    ["CLAUDE_CODE_USE_FOUNDRY", "foundry"],
    ["CLAUDE_CODE_USE_ANTHROPIC_AWS", "aws_platform"],
    ["CLAUDE_CODE_USE_ANTHROPIC_GOOGLE_CLOUD", "gcp_platform"],
    ["CLAUDE_CODE_USE_MANTLE", "mantle"],
  ])("%s → %s", (variable, plan) => {
    expect(creds({ [variable]: "1" })).toEqual({
      ccplan: plan,
      rateLimitTier: null,
      authMethod: "cloud",
      rawSubscriptionType: variable,
    });
  });

  it("reads true/yes/on and ignores 0/false", () => {
    expect(creds({ CLAUDE_CODE_USE_VERTEX: "TRUE" }).ccplan).toBe("vertex");
    expect(creds({ CLAUDE_CODE_USE_BEDROCK: "0" }).ccplan).toBeNull();
    expect(creds({ CLAUDE_CODE_USE_BEDROCK: "false" }).ccplan).toBeNull();
  });

  it("shows Mantle on top of Bedrock as Mantle, and Bedrock before Vertex", () => {
    const both = { CLAUDE_CODE_USE_BEDROCK: "1", CLAUDE_CODE_USE_MANTLE: "1" };
    expect(creds(both).ccplan).toBe("mantle");
    const two = { CLAUDE_CODE_USE_VERTEX: "1", CLAUDE_CODE_USE_BEDROCK: "1" };
    expect(creds(two).ccplan).toBe("bedrock");
  });

  it("outranks every Anthropic credential", () => {
    write(".claude.json", { customApiKeyResponses: { approved: [TAIL], rejected: [] } });
    oauth("max");
    expect(creds({ CLAUDE_CODE_USE_BEDROCK: "1", ANTHROPIC_API_KEY: KEY }).ccplan).toBe("bedrock");
  });
});

describe("settings env blocks replace the shell's variables", () => {
  it("applies the env block of Claude Code's settings file", () => {
    write(".claude/settings.json", { env: { CLAUDE_CODE_USE_VERTEX: "1" } });
    expect(creds({}).ccplan).toBe("vertex");
  });

  it("lets a settings value, even an empty one, override the shell", () => {
    write(".claude/settings.json", { env: { CLAUDE_CODE_USE_VERTEX: "" } });
    expect(creds({ CLAUDE_CODE_USE_VERTEX: "1" }).ccplan).toBeNull();
    write(".claude/settings.json", { env: { CLAUDE_CODE_USE_BEDROCK: "1" } });
    expect(creds({ CLAUDE_CODE_USE_BEDROCK: "0" }).ccplan).toBe("bedrock");
  });

  it("puts managed settings over the user's, drop-in files last", () => {
    write(".claude/settings.json", { env: { CLAUDE_CODE_USE_VERTEX: "1" } });
    write("managed/managed-settings.json", { env: { CLAUDE_CODE_USE_VERTEX: "0" } });
    expect(creds({}).ccplan).toBeNull();
    write("managed/managed-settings.d/20-provider.json", { env: { CLAUDE_CODE_USE_FOUNDRY: "1" } });
    write("managed/managed-settings.d/10-provider.json", { env: { CLAUDE_CODE_USE_FOUNDRY: "0" } });
    expect(creds({}).ccplan).toBe("foundry");
    write("managed/managed-settings.d/.hidden.json", { env: { CLAUDE_CODE_USE_BEDROCK: "1" } });
    expect(creds({}).ccplan).toBe("foundry");
  });

  it("reads .claude.json's legacy env under the settings file", () => {
    write(".claude.json", { env: { CLAUDE_CODE_USE_FOUNDRY: "1" } });
    expect(creds({}).ccplan).toBe("foundry");
    write(".claude/settings.json", { env: { CLAUDE_CODE_USE_FOUNDRY: "0" } });
    expect(creds({}).ccplan).toBeNull();
  });

  it("takes apiKeyHelper from managed settings too", () => {
    oauth("max");
    write("managed/managed-settings.json", { apiKeyHelper: "/opt/corp/get-key" });
    expect(creds({}).rawSubscriptionType).toBe("apiKeyHelper");
  });
});

describe("API usage billing", () => {
  it("ANTHROPIC_AUTH_TOKEN → api", () => {
    oauth("max");
    expect(creds({ ANTHROPIC_AUTH_TOKEN: "token" })).toEqual({
      ccplan: "api",
      rateLimitTier: null,
      authMethod: "api_key",
      rawSubscriptionType: "ANTHROPIC_AUTH_TOKEN",
    });
  });

  it("an approved ANTHROPIC_API_KEY → api, never the old 'team'", () => {
    oauth("max");
    write(".claude.json", { customApiKeyResponses: { approved: [TAIL], rejected: [] } });
    const result = creds({ ANTHROPIC_API_KEY: KEY });
    expect(result.ccplan).toBe("api");
    expect(result.authMethod).toBe("api_key");
  });

  it("matches the approved tail after trimming the key", () => {
    write(".claude.json", { customApiKeyResponses: { approved: [TAIL], rejected: [] } });
    oauth("max");
    expect(creds({ ANTHROPIC_API_KEY: `${KEY}  \n` }).rawSubscriptionType).toBe(
      "ANTHROPIC_API_KEY"
    );
  });

  it("a declined ANTHROPIC_API_KEY leaves the subscription in use", () => {
    oauth("max");
    write(".claude.json", { customApiKeyResponses: { approved: [], rejected: [TAIL] } });
    expect(creds({ ANTHROPIC_API_KEY: KEY }).ccplan).toBe("max");
  });

  it("a declined key is not reported even when nothing else signs in", () => {
    write(".claude.json", { customApiKeyResponses: { approved: [], rejected: [TAIL] } });
    expect(creds({ ANTHROPIC_API_KEY: KEY }).ccplan).toBeNull();
  });

  it("an unanswered key counts only when nothing else signs in (claude -p would use it)", () => {
    oauth("pro");
    expect(creds({ ANTHROPIC_API_KEY: KEY }).ccplan).toBe("pro");
    fs.rmSync(path.join(home, ".claude"), { recursive: true, force: true });
    expect(creds({ ANTHROPIC_API_KEY: KEY }).ccplan).toBe("api");
  });

  it("a key saved by a Claude Console login → api, ahead of /login", () => {
    oauth("max");
    write(".claude.json", { primaryApiKey: "saved" });
    expect(creds({}).rawSubscriptionType).toBe("console_login");
    expect(creds({}).ccplan).toBe("api");
  });

  it("an apiKeyHelper in the settings → api", () => {
    oauth("max");
    write(".claude/settings.json", { apiKeyHelper: "~/bin/get-key.sh" });
    expect(creds({}).ccplan).toBe("api");
  });

  it("takes an approved key, then apiKeyHelper, then a saved Console key", () => {
    write(".claude.json", {
      primaryApiKey: "saved",
      customApiKeyResponses: { approved: [TAIL], rejected: [] },
    });
    write(".claude/settings.json", { apiKeyHelper: "~/bin/get-key.sh" });
    expect(creds({ ANTHROPIC_API_KEY: KEY }).rawSubscriptionType).toBe("ANTHROPIC_API_KEY");
    expect(creds({}).rawSubscriptionType).toBe("apiKeyHelper");
  });

  it("puts an approved key and apiKeyHelper ahead of CLAUDE_CODE_OAUTH_TOKEN", () => {
    oauth("max");
    write(".claude.json", { customApiKeyResponses: { approved: [TAIL], rejected: [] } });
    const env = { CLAUDE_CODE_OAUTH_TOKEN: "t", ANTHROPIC_API_KEY: KEY };
    expect(creds(env).rawSubscriptionType).toBe("ANTHROPIC_API_KEY");
    write(".claude/settings.json", { apiKeyHelper: "~/bin/get-key.sh" });
    expect(creds({ CLAUDE_CODE_OAUTH_TOKEN: "t" }).rawSubscriptionType).toBe("apiKeyHelper");
  });
});

describe("Anthropic profiles and federation", () => {
  const profile = (dir: string, name: string, authentication: unknown) =>
    write(`${dir}/configs/${name}.json`, { authentication });

  it("a named profile counts only when it resolves", () => {
    oauth("max");
    const env = { ANTHROPIC_CONFIG_DIR: path.join(home, "anth"), ANTHROPIC_PROFILE: "work" };
    expect(creds(env).ccplan).toBe("max");
    profile("anth", "work", { type: "user_oauth" });
    expect(creds(env).ccplan).toBe("max");
    write("anth/credentials/work.json", "{}");
    expect(creds(env).rawSubscriptionType).toBe("anthropic_profile");
    profile("anth", "work", { type: "oidc_federation" });
    expect(creds(env).ccplan).toBe("api");
  });

  it("an unresolved named profile hides federation variables and the active profile", () => {
    oauth("max");
    profile("anth", "default", { type: "oidc_federation" });
    const env = {
      ANTHROPIC_CONFIG_DIR: path.join(home, "anth"),
      ANTHROPIC_PROFILE: "missing",
      ANTHROPIC_FEDERATION_RULE_ID: "r",
      ANTHROPIC_ORGANIZATION_ID: "o",
    };
    expect(creds(env).ccplan).toBe("max");
  });

  it("federation needs both variables", () => {
    oauth("max");
    const federation = { ANTHROPIC_FEDERATION_RULE_ID: "r", ANTHROPIC_ORGANIZATION_ID: "o" };
    expect(creds(federation).ccplan).toBe("api");
    expect(creds({ ANTHROPIC_FEDERATION_RULE_ID: "r" }).ccplan).toBe("max");
  });

  it("an active federation profile comes before /login", () => {
    oauth("max");
    write("anth/active_config", "corp\n");
    profile("anth", "corp", { type: "oidc_federation" });
    expect(creds({ ANTHROPIC_CONFIG_DIR: path.join(home, "anth") }).ccplan).toBe("api");
  });

  it("an active keyless Console login counts alone, and is not guessed next to a working /login", () => {
    const env = { ANTHROPIC_CONFIG_DIR: path.join(home, "anth") };
    profile("anth", "default", { type: "user_oauth" });
    write("anth/credentials/default.json", "{}");
    expect(creds(env).ccplan).toBe("api");
    oauth("max", undefined, { accessToken: "a", scopes: ["user:profile"] });
    expect(creds(env).ccplan).toBe("api");
    oauth("max", undefined, { accessToken: "a", scopes: ["user:inference"] });
    expect(creds(env)).toEqual({
      ccplan: null,
      rateLimitTier: null,
      authMethod: "unknown",
      rawSubscriptionType: "anthropic_profile_or_login",
    });
  });

  it("finds profiles under XDG_CONFIG_HOME, then HOME/.config", () => {
    oauth("max");
    profile("xdg/anthropic", "default", { type: "oidc_federation" });
    expect(creds({ XDG_CONFIG_HOME: path.join(home, "xdg") }).ccplan).toBe("api");
    profile("h/.config/anthropic", "default", { type: "oidc_federation" });
    expect(creds({ HOME: path.join(home, "h") }).ccplan).toBe("api");
    expect(creds({}).ccplan).toBe("max");
  });
});

describe("subscriptions", () => {
  it("reads the plan Claude Code saved at /login", () => {
    oauth("max", "default_claude_max_20x");
    expect(creds({})).toEqual({
      ccplan: "max",
      rateLimitTier: "default_claude_max_20x",
      authMethod: "oauth",
      rawSubscriptionType: "max",
    });
  });

  it("falls back to the rate-limit tier, and sends only the server's plan keys", () => {
    oauth(undefined, "default_claude_max_20x");
    expect(creds({}).ccplan).toBe("max");
    oauth(undefined, "default_claude_team_5x");
    expect(creds({}).ccplan).toBe("team");
    oauth(undefined, "default_claude_ai");
    expect(creds({}).ccplan).toBeNull();
  });

  it("reads the saved subscription type before the tier", () => {
    oauth("team", "default_claude_max_5x");
    expect(creds({}).ccplan).toBe("team");
  });

  it("CLAUDE_CODE_OAUTH_TOKEN is a subscription, typed from the saved login when there is one", () => {
    oauth("pro");
    expect(creds({ CLAUDE_CODE_OAUTH_TOKEN: "t" }).ccplan).toBe("pro");
    fs.rmSync(path.join(home, ".claude"), { recursive: true, force: true });
    expect(creds({ CLAUDE_CODE_OAUTH_TOKEN: "t" })).toEqual({
      ccplan: null,
      rateLimitTier: null,
      authMethod: "oauth",
      rawSubscriptionType: null,
    });
  });

  it("reads the login, .claude.json and settings.json from CLAUDE_CONFIG_DIR when it is set", () => {
    const dir = path.join(home, "alt");
    write("alt/.credentials.json", { claudeAiOauth: { subscriptionType: "team" } });
    oauth("max");
    expect(creds({ CLAUDE_CONFIG_DIR: dir }).ccplan).toBe("team");

    write(".claude.json", { customApiKeyResponses: { approved: [TAIL], rejected: [] } });
    expect(creds({ CLAUDE_CONFIG_DIR: dir, ANTHROPIC_API_KEY: KEY }).ccplan).toBe("team");
    write("alt/.claude.json", { customApiKeyResponses: { approved: [TAIL], rejected: [] } });
    expect(creds({ CLAUDE_CONFIG_DIR: dir, ANTHROPIC_API_KEY: KEY }).ccplan).toBe("api");

    write(".claude/settings.json", { env: { CLAUDE_CODE_USE_VERTEX: "1" } });
    expect(creds({ CLAUDE_CONFIG_DIR: dir }).ccplan).toBe("team");
    write("alt/settings.json", { env: { CLAUDE_CODE_USE_VERTEX: "1" } });
    expect(creds({ CLAUDE_CONFIG_DIR: dir }).ccplan).toBe("vertex");
  });

  it("reports nothing for an enterprise gateway sign-in, ahead of every provider", () => {
    write(".claude/.credentials.json", {
      enterpriseGateway: { url: "https://gw.example" },
      claudeAiOauth: { subscriptionType: "max" },
    });
    expect(creds({ CLAUDE_CODE_USE_BEDROCK: "1" })).toEqual({
      ccplan: null,
      rateLimitTier: null,
      authMethod: "unknown",
      rawSubscriptionType: "enterprise_gateway",
    });
  });
});

describe("macOS Keychain", () => {
  const login = (plan: string) => JSON.stringify({ claudeAiOauth: { subscriptionType: plan } });
  const serviceOf = (args: string[]) => args[args.indexOf("-s") + 1];

  it("names the item after CLAUDE_CONFIG_DIR as Claude Code does", () => {
    expect(keychainService({}, "-credentials")).toBe("Claude Code-credentials");
    expect(keychainService({ CLAUDE_CONFIG_DIR: "/tmp/claude-work" }, "-credentials")).toBe(
      "Claude Code-credentials-bfc1769a"
    );
    expect(keychainService({ CLAUDE_CONFIG_DIR: "/tmp/café" }, "")).toBe("Claude Code-0873cca0");
    const secure = { CLAUDE_CONFIG_DIR: "/tmp/claude-work", CLAUDE_SECURESTORAGE_CONFIG_DIR: "" };
    expect(keychainService(secure, "-credentials")).toBe("Claude Code-credentials");
    expect(keychainService({ CLAUDE_SECURESTORAGE_CONFIG_DIR: "/opt/secure" }, "")).toBe(
      "Claude Code-f533768c"
    );
  });

  it("reads that folder's login, not the default item's", () => {
    oauth("pro");
    security.run.mockImplementation((args) => {
      if (serviceOf(args) === "Claude Code-credentials") return login("max");
      if (serviceOf(args) === "Claude Code-credentials-bfc1769a") return login("team");
      return noKeychain();
    });
    const env = { CLAUDE_CONFIG_DIR: "/tmp/claude-work" };
    expect(creds(env, { platform: "darwin" }).ccplan).toBe("team");
    expect(creds({}, { platform: "darwin" }).ccplan).toBe("max");
  });

  it("asks the Keychain before the file, with a time limit, and falls back to the file", () => {
    oauth("pro");
    security.run.mockImplementation((args) => (args.includes("-w") ? login("max") : noKeychain()));
    expect(creds({}, { platform: "darwin" }).ccplan).toBe("max");
    const timeout = security.run.mock.calls[0]?.[1]?.timeout ?? 0;
    expect(timeout).toBeGreaterThan(0);
    expect(timeout).toBeLessThanOrEqual(10_000);

    security.run.mockImplementation(noKeychain);
    expect(creds({}, { platform: "darwin" }).ccplan).toBe("pro");
    expect(creds({}, { platform: "linux" }).ccplan).toBe("pro");
  });

  it("finds a Console key in the Keychain without reading the key", () => {
    oauth("max");
    security.run.mockImplementation((args) =>
      serviceOf(args) === "Claude Code" && !args.includes("-w") ? "attributes" : noKeychain()
    );
    expect(creds({ USER: "dev" }, { platform: "darwin" }).rawSubscriptionType).toBe(
      "console_login"
    );
    const asked = security.run.mock.calls.find(([args]) => serviceOf(args) === "Claude Code");
    expect(asked?.[0]).toEqual(["find-generic-password", "-s", "Claude Code", "-a", "dev"]);
    expect(creds({ USER: "dev" }, { platform: "linux" }).ccplan).toBe("max");

    security.run.mockClear();
    creds({ USER: "dev user" }, { platform: "darwin" });
    const odd = security.run.mock.calls.find(([args]) => serviceOf(args) === "Claude Code");
    expect(odd?.[0]).toEqual([
      "find-generic-password",
      "-s",
      "Claude Code",
      "-a",
      "claude-code-user",
    ]);
  });
});

it("reports nothing when no credential is found", () => {
  expect(creds({})).toEqual({
    ccplan: null,
    rateLimitTier: null,
    authMethod: "unknown",
    rawSubscriptionType: null,
  });
});

it("sends only keys from SENT_PLAN_KEYS", () => {
  const plans = [
    creds({ CLAUDE_CODE_USE_BEDROCK: "1", CLAUDE_CODE_USE_MANTLE: "1" }).ccplan,
    creds({ ANTHROPIC_AUTH_TOKEN: "t" }).ccplan,
    ...["free", "pro", "max", "team", "enterprise"].map((plan) => {
      oauth(plan);
      return creds({}).ccplan;
    }),
  ];
  for (const plan of plans) expect(SENT_PLAN_KEYS).toContain(plan);
});
