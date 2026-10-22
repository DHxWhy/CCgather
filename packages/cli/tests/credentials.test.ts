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
  systemManagedSettingsDir,
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

// A saved /login. Without the inference scope it cannot outrank a saved Console key.
const oauth = (subscriptionType?: string, rateLimitTier?: string, extra = {}) =>
  write(".claude/.credentials.json", {
    claudeAiOauth: { accessToken: "a", subscriptionType, rateLimitTier, ...extra },
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
    expect(creds({ CLAUDE_CODE_USE_BEDROCK: "yes" }).ccplan).toBe("bedrock");
    expect(creds({ CLAUDE_CODE_USE_VERTEX: "on" }).ccplan).toBe("vertex");
    expect(creds({ CLAUDE_CODE_USE_FOUNDRY: " 1 " }).ccplan).toBe("foundry");
    expect(creds({ CLAUDE_CODE_USE_BEDROCK: "0" }).ccplan).toBeNull();
    expect(creds({ CLAUDE_CODE_USE_BEDROCK: "false" }).ccplan).toBeNull();
  });

  it("reads the Mantle switch from a settings env block too", () => {
    write(".claude/settings.json", { env: { CLAUDE_CODE_USE_MANTLE: "1" } });
    expect(creds({ CLAUDE_CODE_USE_BEDROCK: "1" }).ccplan).toBe("mantle");
  });

  it("shows Mantle on top of Bedrock as Mantle, and Bedrock before Vertex", () => {
    const both = { CLAUDE_CODE_USE_BEDROCK: "1", CLAUDE_CODE_USE_MANTLE: "1" };
    expect(creds(both).ccplan).toBe("mantle");
    const two = { CLAUDE_CODE_USE_VERTEX: "1", CLAUDE_CODE_USE_BEDROCK: "1" };
    expect(creds(two).ccplan).toBe("bedrock");
  });

  it("takes the providers in Claude Code's order", () => {
    const order = [
      "CLAUDE_CODE_USE_BEDROCK",
      "CLAUDE_CODE_USE_FOUNDRY",
      "CLAUDE_CODE_USE_ANTHROPIC_AWS",
      "CLAUDE_CODE_USE_ANTHROPIC_GOOGLE_CLOUD",
      "CLAUDE_CODE_USE_MANTLE",
      "CLAUDE_CODE_USE_VERTEX",
    ];
    order.forEach((first, i) => {
      for (const second of order.slice(i + 1)) {
        expect(creds({ [first]: "1", [second]: "1" }).rawSubscriptionType, second).toBe(first);
      }
    });
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

  it("turns every settings env value into text, as Claude Code's settings schema does", () => {
    oauth("max", undefined, { scopes: ["user:inference"] });
    const shellOn = { CLAUDE_CODE_USE_VERTEX: "1" };
    write(".claude/settings.json", { env: { CLAUDE_CODE_USE_BEDROCK: true } });
    expect(creds({}).ccplan).toBe("bedrock");
    // 0, null ("null") and an object ("[object Object]") switch the shell's value off
    for (const off of [0, null, { a: 1 }]) {
      write(".claude/settings.json", { env: { CLAUDE_CODE_USE_VERTEX: off } });
      expect(creds(shellOn).ccplan).toBe("max");
    }
    write(".claude/settings.json", { env: { CLAUDE_CODE_USE_VERTEX: ["1"] } });
    expect(creds({}).ccplan).toBe("vertex");
  });

  it("lets a null in the user's settings replace .claude.json's value, but not the other way", () => {
    write(".claude.json", { env: { CLAUDE_CODE_USE_VERTEX: "1" } });
    write(".claude/settings.json", { env: { CLAUDE_CODE_USE_VERTEX: null } });
    expect(creds({}).ccplan).toBeNull();
    // .claude.json's legacy env drops what is not a string, number or boolean
    write(".claude.json", { env: { CLAUDE_CODE_USE_VERTEX: null } });
    write(".claude/settings.json", {});
    expect(creds({ CLAUDE_CODE_USE_VERTEX: "1" }).ccplan).toBe("vertex");
  });

  it("lets a managed drop-in's null switch off its base file's value", () => {
    write("managed/managed-settings.json", { env: { CLAUDE_CODE_USE_VERTEX: "1" } });
    expect(creds({}).ccplan).toBe("vertex");
    write("managed/managed-settings.d/50-off.json", { env: { CLAUDE_CODE_USE_VERTEX: null } });
    expect(creds({}).ccplan).toBeNull();
  });

  it("reads settings files saved as UTF-8 with a byte-order mark or as UTF-16LE", () => {
    oauth("max", undefined, { scopes: ["user:inference"] });
    const save = (file: string, value: unknown, encoding: "bom" | "utf16le") => {
      const target = path.join(home, file);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      const text = "\uFEFF" + JSON.stringify(value);
      fs.writeFileSync(target, Buffer.from(text, encoding === "bom" ? "utf8" : "utf16le"));
    };
    for (const encoding of ["bom", "utf16le"] as const) {
      save(".claude/settings.json", { env: { CLAUDE_CODE_USE_VERTEX: "0" } }, encoding);
      expect(creds({ CLAUDE_CODE_USE_VERTEX: "1" }).ccplan).toBe("max");
      save("managed/managed-settings.json", { forceLoginMethod: "gateway" }, encoding);
      expect(creds({}).rawSubscriptionType).toBe("enterprise_gateway");
      fs.rmSync(path.join(home, "managed"), { recursive: true });
      save("managed/managed-settings.d/50-login.json", { forceLoginMethod: "gateway" }, encoding);
      expect(creds({}).rawSubscriptionType).toBe("enterprise_gateway");
      fs.rmSync(path.join(home, "managed"), { recursive: true });
    }
  });

  it("drops only one byte-order mark, and reads no other encoding", () => {
    oauth("max", undefined, { scopes: ["user:inference"] });
    const off = JSON.stringify({ env: { CLAUDE_CODE_USE_VERTEX: "0" } });
    const target = path.join(home, ".claude/settings.json");
    for (const bytes of [
      Buffer.from("\uFEFF\uFEFF" + off, "utf8"),
      Buffer.from(" \uFEFF" + off, "utf8"),
      // UTF-16BE: FE FF and big-endian code units
      Buffer.from("\uFEFF" + off, "utf16le").swap16(),
    ]) {
      fs.writeFileSync(target, bytes);
      expect(creds({ CLAUDE_CODE_USE_VERTEX: "1" }).ccplan).toBe("vertex");
    }
  });

  it("reads .claude.json without its byte-order mark, but not the login file or a profile", () => {
    const withBom = (file: string, value: unknown) => {
      const target = path.join(home, file);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, "\uFEFF" + JSON.stringify(value));
    };
    withBom(".claude.json", { env: { CLAUDE_CODE_USE_VERTEX: "1" } });
    expect(creds({}).ccplan).toBe("vertex");
    withBom(".claude.json", { customApiKeyResponses: { approved: [TAIL], rejected: [] } });
    oauth("max", undefined, { scopes: ["user:inference"] });
    expect(creds({ ANTHROPIC_API_KEY: KEY }).ccplan).toBe("api");
    fs.rmSync(path.join(home, ".claude/.credentials.json"));
    withBom(".claude.json", { primaryApiKey: "sk-ant-api03-saved" });
    expect(creds({}).rawSubscriptionType).toBe("console_login");

    fs.rmSync(path.join(home, ".claude.json"));
    withBom(".claude/.credentials.json", {
      claudeAiOauth: { accessToken: "a", subscriptionType: "max" },
    });
    expect(creds({}).ccplan).toBeNull();
    oauth("max", undefined, { scopes: ["user:inference"] });
    withBom("anth/configs/work.json", { authentication: { type: "oidc_federation" } });
    const named = { ANTHROPIC_CONFIG_DIR: path.join(home, "anth"), ANTHROPIC_PROFILE: "work" };
    expect(creds(named).ccplan).toBe("max");
  });

  it("drops a settings env value that holds a NUL character, so the layer below shows", () => {
    oauth("max", undefined, { scopes: ["user:inference"] });
    write(".claude/settings.json", { env: { ANTHROPIC_AUTH_TOKEN: "t\u0000" } });
    expect(creds({}).ccplan).toBe("max");
    write(".claude/settings.json", { env: { CLAUDE_CODE_USE_VERTEX: "0\u0000" } });
    expect(creds({ CLAUDE_CODE_USE_VERTEX: "1" }).ccplan).toBe("vertex");
    write(".claude.json", { env: { CLAUDE_CODE_USE_VERTEX: "1" } });
    expect(creds({}).ccplan).toBe("vertex");
    write(".claude/settings.json", {});
    write(".claude.json", { env: { ANTHROPIC_AUTH_TOKEN: "t\u0000" } });
    expect(creds({}).ccplan).toBe("max");
  });

  it("merges the managed files' env key by key before dropping a NUL value", () => {
    oauth("max", undefined, { scopes: ["user:inference"] });
    write("managed/managed-settings.json", { env: { CLAUDE_CODE_USE_VERTEX: "1" } });
    // A drop-in without the key keeps the base file's value
    write("managed/managed-settings.d/50-off.json", { env: { CLAUDE_CODE_USE_BEDROCK: "0" } });
    expect(creds({}).ccplan).toBe("vertex");
    write("managed/managed-settings.d/50-off.json", { env: { CLAUDE_CODE_USE_VERTEX: "0\u0000" } });
    expect(creds({}).ccplan).toBe("max");
    // The merged value is dropped, so the user's settings show through
    write(".claude/settings.json", { env: { CLAUDE_CODE_USE_VERTEX: "1" } });
    expect(creds({}).ccplan).toBe("vertex");
    fs.rmSync(path.join(home, ".claude/settings.json"));
    write("managed/managed-settings.json", { env: { ANTHROPIC_AUTH_TOKEN: "t" } });
    write("managed/managed-settings.d/50-off.json", { env: { ANTHROPIC_AUTH_TOKEN: "u\u0000" } });
    expect(creds({}).ccplan).toBe("max");
  });

  it("skips an env value String() cannot convert, as Claude Code's schema does, without failing", () => {
    oauth("max", undefined, { scopes: ["user:inference"] });
    const broken = { toString: 1 };
    // A user settings file is skipped whole
    write(".claude/settings.json", { env: { CLAUDE_CODE_USE_VERTEX: broken } });
    expect(creds({}).ccplan).toBe("max");
    write(".claude/settings.json", { env: { FOO: broken }, apiKeyHelper: "h" });
    expect(creds({}).ccplan).toBe("max");
    fs.rmSync(path.join(home, ".claude/settings.json"));
    // A managed file loses its env block
    write("managed/managed-settings.json", { env: { CLAUDE_CODE_USE_VERTEX: broken } });
    expect(creds({}).ccplan).toBe("max");
    write("managed/managed-settings.json", { env: { FOO: broken, CLAUDE_CODE_USE_VERTEX: "1" } });
    expect(creds({}).ccplan).toBe("max");
    write("managed/managed-settings.json", { env: { FOO: broken }, forceLoginMethod: "gateway" });
    expect(creds({}).rawSubscriptionType).toBe("enterprise_gateway");
  });

  it("keeps the rest of a managed file whose env or apiKeyHelper is wrong", () => {
    oauth("max", undefined, { scopes: ["user:inference"] });
    write("managed/managed-settings.json", { env: ["x"], forceLoginMethod: "gateway" });
    expect(creds({}).rawSubscriptionType).toBe("enterprise_gateway");
    write("managed/managed-settings.json", {
      apiKeyHelper: 123,
      env: { CLAUDE_CODE_USE_VERTEX: "1" },
    });
    expect(creds({}).ccplan).toBe("vertex");
  });

  it("skips a user settings file whose env or apiKeyHelper Claude Code's schema rejects", () => {
    oauth("max", undefined, { scopes: ["user:inference"] });
    for (const broken of [
      { env: { CLAUDE_CODE_USE_VERTEX: "1" }, apiKeyHelper: 123 },
      { env: null, apiKeyHelper: "h" },
      { env: ["x"], apiKeyHelper: "h" },
    ]) {
      write(".claude/settings.json", broken);
      expect(creds({}).ccplan).toBe("max");
    }
    // A managed file only loses the key it got wrong
    write(".claude/settings.json", { apiKeyHelper: "h" });
    write("managed/managed-settings.json", { apiKeyHelper: 123 });
    expect(creds({}).rawSubscriptionType).toBe("apiKeyHelper");
  });

  it("reads the token's plan and tier from a settings env block", () => {
    write(".claude/settings.json", {
      env: {
        CLAUDE_CODE_OAUTH_TOKEN: "t",
        CLAUDE_CODE_SUBSCRIPTION_TYPE: "max",
        CLAUDE_CODE_RATE_LIMIT_TIER: "default_claude_max_20x",
      },
    });
    expect(creds({})).toEqual({
      ccplan: "max",
      rateLimitTier: "default_claude_max_20x",
      authMethod: "oauth",
      rawSubscriptionType: "max",
    });
  });

  it("reads the sign-in variables from a settings env block too", () => {
    oauth("max");
    write(".claude/settings.json", { env: { ANTHROPIC_AUTH_TOKEN: "t" } });
    expect(creds({}).rawSubscriptionType).toBe("ANTHROPIC_AUTH_TOKEN");
    write(".claude.json", { customApiKeyResponses: { approved: [TAIL], rejected: [] } });
    write(".claude/settings.json", { env: { ANTHROPIC_API_KEY: KEY } });
    expect(creds({}).rawSubscriptionType).toBe("ANTHROPIC_API_KEY");
    write(".claude/settings.json", {
      env: { CLAUDE_CODE_OAUTH_TOKEN: "t", CLAUDE_CODE_SUBSCRIPTION_TYPE: "pro" },
    });
    expect(creds({}).ccplan).toBe("pro");
  });

  it("applies managed-settings.json before its drop-ins, and only .json drop-ins", () => {
    write("managed/managed-settings.json", { env: { CLAUDE_CODE_USE_FOUNDRY: "1" } });
    write("managed/managed-settings.d/10-off.json", { env: { CLAUDE_CODE_USE_FOUNDRY: "0" } });
    expect(creds({}).ccplan).toBeNull();
    write("managed/managed-settings.d/50-notes.txt", { env: { CLAUDE_CODE_USE_BEDROCK: "1" } });
    expect(creds({}).ccplan).toBeNull();
  });

  it("looks for managed settings where Claude Code installs them", () => {
    expect(systemManagedSettingsDir("linux")).toBe("/etc/claude-code");
    expect(systemManagedSettingsDir("darwin")).toBe("/Library/Application Support/ClaudeCode");
    expect(systemManagedSettingsDir("win32")).toBe("C:\\Program Files\\ClaudeCode");
  });

  it("lets managed settings switch off a user's apiKeyHelper", () => {
    oauth("max");
    write(".claude/settings.json", { apiKeyHelper: "~/bin/get-key.sh" });
    write("managed/managed-settings.json", { apiKeyHelper: "" });
    expect(creds({}).ccplan).toBe("max");
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

  it("leaves a saved Console key unused while a subscription can sign in", () => {
    write(".claude.json", { primaryApiKey: "saved" });
    oauth("max", undefined, { scopes: ["user:inference"] });
    expect(creds({}).ccplan).toBe("max");
    fs.rmSync(path.join(home, ".claude"), { recursive: true, force: true });
    const token = { CLAUDE_CODE_OAUTH_TOKEN: "t", CLAUDE_CODE_SUBSCRIPTION_TYPE: "pro" };
    expect(creds(token).ccplan).toBe("pro");
    expect(creds({}).rawSubscriptionType).toBe("console_login");
  });

  it("reads .claude.json when the legacy .config.json is empty, and .config.json from CLAUDE_CONFIG_DIR", () => {
    oauth("max");
    write(".claude.json", { customApiKeyResponses: { approved: [TAIL], rejected: [] } });
    write(".claude/.config.json", "");
    expect(creds({ ANTHROPIC_API_KEY: KEY }).ccplan).toBe("api");

    write("alt/.config.json", { customApiKeyResponses: { approved: [TAIL], rejected: [] } });
    write("alt/.credentials.json", {
      claudeAiOauth: { accessToken: "a", subscriptionType: "team" },
    });
    const env = { CLAUDE_CONFIG_DIR: path.join(home, "alt"), ANTHROPIC_API_KEY: KEY };
    expect(creds(env).ccplan).toBe("api");
  });

  it("reads the OAuth token's scopes from a settings env block, split on any whitespace", () => {
    write(".claude.json", { primaryApiKey: "saved" });
    write(".claude/settings.json", {
      env: { CLAUDE_CODE_OAUTH_TOKEN: "t", CLAUDE_CODE_OAUTH_SCOPES: "user:profile" },
    });
    expect(creds({}).ccplan).toBe("api");
    write(".claude/settings.json", { env: { CLAUDE_CODE_OAUTH_SCOPES: "user:profile" } });
    expect(
      creds({ CLAUDE_CODE_OAUTH_TOKEN: "t", CLAUDE_CODE_SUBSCRIPTION_TYPE: "pro" }).ccplan
    ).toBe("api");
    write(".claude/settings.json", {});
    const tab = {
      CLAUDE_CODE_OAUTH_TOKEN: "t",
      CLAUDE_CODE_OAUTH_SCOPES: "user:profile\tuser:inference",
      CLAUDE_CODE_SUBSCRIPTION_TYPE: "pro",
    };
    expect(creds(tab).ccplan).toBe("pro");
  });

  it("judges the OAuth token by its own scopes, never by a saved login", () => {
    oauth("max", undefined, { scopes: ["user:inference"] });
    write(".claude.json", { primaryApiKey: "saved" });
    const token = {
      CLAUDE_CODE_OAUTH_TOKEN: "t",
      CLAUDE_CODE_OAUTH_SCOPES: "user:profile",
      CLAUDE_CODE_SUBSCRIPTION_TYPE: "pro",
    };
    expect(creds(token).ccplan).toBe("api");
    oauth("max", undefined, { scopes: ["user:profile"] });
    expect(creds({ CLAUDE_CODE_OAUTH_SCOPES: "user:inference" }).ccplan).toBe("api");
  });

  it("trims the plan and tier it sends", () => {
    const env = {
      CLAUDE_CODE_OAUTH_TOKEN: "t",
      CLAUDE_CODE_SUBSCRIPTION_TYPE: " max ",
      CLAUDE_CODE_RATE_LIMIT_TIER: " default_claude_max_20x ",
    };
    expect(creds(env)).toEqual({
      ccplan: "max",
      rateLimitTier: "default_claude_max_20x",
      authMethod: "oauth",
      rawSubscriptionType: "max",
    });
  });

  it("in bare mode uses no login: only ANTHROPIC_AUTH_TOKEN or ANTHROPIC_API_KEY", () => {
    oauth("max", undefined, { scopes: ["user:inference"] });
    expect(creds({ CLAUDE_CODE_SIMPLE: "1", ANTHROPIC_API_KEY: KEY }).ccplan).toBe("api");
    expect(creds({ CLAUDE_CODE_SIMPLE: "1", ANTHROPIC_AUTH_TOKEN: "t" })).toEqual({
      ccplan: "api",
      rateLimitTier: null,
      authMethod: "api_key",
      rawSubscriptionType: "ANTHROPIC_AUTH_TOKEN",
    });
    expect(creds({ CLAUDE_CODE_SIMPLE: "1" })).toEqual({
      ccplan: null,
      rateLimitTier: null,
      authMethod: "unknown",
      rawSubscriptionType: "bare_mode",
    });
    expect(creds({ CLAUDE_CODE_SIMPLE: "1", CLAUDE_CODE_USE_BEDROCK: "1" }).ccplan).toBe("bedrock");
  });

  it("lets a provider win over ANTHROPIC_AUTH_TOKEN, in bare mode too", () => {
    const env = { CLAUDE_CODE_USE_BEDROCK: "1", ANTHROPIC_AUTH_TOKEN: "t" };
    expect(creds(env).ccplan).toBe("bedrock");
    expect(creds({ ...env, CLAUDE_CODE_SIMPLE: "1" }).ccplan).toBe("bedrock");
  });

  it("reads the bare switch as Claude Code does, from settings env blocks too", () => {
    oauth("max", undefined, { scopes: ["user:inference"] });
    // A key never answered: outside bare mode the login wins
    const key = { ANTHROPIC_API_KEY: KEY };
    expect(creds(key).ccplan).toBe("max");
    expect(creds({ ...key, CLAUDE_CODE_SIMPLE: "true" }).ccplan).toBe("api");
    expect(creds({ ...key, CLAUDE_CODE_SIMPLE: "0" }).ccplan).toBe("max");

    write(".claude/settings.json", { env: { CLAUDE_CODE_SIMPLE: "1" } });
    expect(creds(key).ccplan).toBe("api");
    write(".claude/settings.json", { env: { ANTHROPIC_API_KEY: KEY } });
    expect(creds({ CLAUDE_CODE_SIMPLE: "1" }).ccplan).toBe("api");
    fs.rmSync(path.join(home, ".claude/settings.json"));
    write("managed/managed-settings.json", { env: { CLAUDE_CODE_SIMPLE: "1" } });
    expect(creds(key).ccplan).toBe("api");
  });

  it("in bare mode still finds a gateway saved in the file, but reads no Keychain", () => {
    write(".claude/.credentials.json", {
      enterpriseGateway: { url: "https://gw.example", jwt: "j", expiresAt: Date.UTC(2100, 0, 1) },
      gatewayTrust: { "gw.example": "sha256/AAAA" },
    });
    const env = { CLAUDE_CODE_SIMPLE: "1", ANTHROPIC_API_KEY: KEY };
    expect(creds(env, { platform: "linux" }).rawSubscriptionType).toBe("enterprise_gateway");
    expect(creds(env, { platform: "win32" }).rawSubscriptionType).toBe("enterprise_gateway");
    security.run.mockClear();
    expect(creds(env, { platform: "darwin" }).ccplan).toBe("api");
    expect(security.run).not.toHaveBeenCalled();
  });

  it("uses a Console key when the OAuth token's scopes cannot run inference", () => {
    write(".claude.json", { primaryApiKey: "saved" });
    const token = { CLAUDE_CODE_OAUTH_TOKEN: "t", CLAUDE_CODE_SUBSCRIPTION_TYPE: "pro" };
    expect(creds({ ...token, CLAUDE_CODE_OAUTH_SCOPES: "user:profile" }).ccplan).toBe("api");
    expect(
      creds({ ...token, CLAUDE_CODE_OAUTH_SCOPES: "user:profile  user:inference" }).ccplan
    ).toBe("pro");
    expect(creds({ ...token, CLAUDE_CODE_OAUTH_SCOPES: " " }).ccplan).toBe("pro");
  });

  it("reads a non-empty legacy .config.json instead of .claude.json", () => {
    oauth("max");
    write(".claude.json", { customApiKeyResponses: { approved: [], rejected: [TAIL] } });
    write(".claude/.config.json", { customApiKeyResponses: { approved: [TAIL], rejected: [] } });
    expect(creds({ ANTHROPIC_API_KEY: KEY }).ccplan).toBe("api");
    write(".claude/.config.json", "");
    expect(creds({ ANTHROPIC_API_KEY: KEY }).ccplan).toBe("max");
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

  it("reads profile and federation variables from a settings env block", () => {
    oauth("max", undefined, { scopes: ["user:inference"] });
    profile("anth", "work", { type: "oidc_federation" });
    write(".claude/settings.json", {
      env: { ANTHROPIC_PROFILE: "work", ANTHROPIC_CONFIG_DIR: path.join(home, "anth") },
    });
    expect(creds({}).ccplan).toBe("api");

    write(".claude/settings.json", {
      env: { ANTHROPIC_FEDERATION_RULE_ID: "r", ANTHROPIC_ORGANIZATION_ID: "o" },
    });
    expect(creds({}).ccplan).toBe("api");

    write("anth/active_config", "corp\n");
    profile("anth", "corp", { type: "oidc_federation" });
    write(".claude/settings.json", { env: { ANTHROPIC_CONFIG_DIR: path.join(home, "anth") } });
    expect(creds({}).ccplan).toBe("api");
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

  it("an active keyless Console login counts alone; next to a working claude.ai login the login wins", () => {
    const env = { ANTHROPIC_CONFIG_DIR: path.join(home, "anth") };
    profile("anth", "default", { type: "user_oauth" });
    write("anth/credentials/default.json", "{}");
    expect(creds(env).ccplan).toBe("api");
    oauth("max", undefined, { scopes: ["user:profile"] });
    expect(creds(env).ccplan).toBe("api");
    oauth("max", undefined, { accessToken: "", scopes: ["user:inference"] });
    expect(creds(env).ccplan).toBe("api");
    oauth("max", undefined, { scopes: ["user:inference"] });
    expect(creds(env)).toEqual({
      ccplan: "max",
      rateLimitTier: null,
      authMethod: "oauth",
      rawSubscriptionType: "max",
    });
  });

  it("reads a profile's credentials_path, and an empty credentials file does not count", () => {
    oauth("max");
    const env = { ANTHROPIC_CONFIG_DIR: path.join(home, "anth"), ANTHROPIC_PROFILE: "work" };
    profile("anth", "work", {
      type: "user_oauth",
      credentials_path: path.join(home, "keys", "work.json"),
    });
    expect(creds(env).ccplan).toBe("max");
    write("keys/work.json", "  \n");
    expect(creds(env).ccplan).toBe("max");
    write("keys/work.json", "{}");
    expect(creds(env).ccplan).toBe("api");
  });

  it("does not fall back to HOME/.config when XDG_CONFIG_HOME is set", () => {
    oauth("max");
    profile("h/.config/anthropic", "default", { type: "oidc_federation" });
    const env = { XDG_CONFIG_HOME: path.join(home, "xdg"), HOME: path.join(home, "h") };
    expect(creds(env).ccplan).toBe("max");
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

  it("CLAUDE_CODE_OAUTH_TOKEN is typed by CLAUDE_CODE_SUBSCRIPTION_TYPE, never by a saved login", () => {
    oauth("max");
    expect(creds({ CLAUDE_CODE_OAUTH_TOKEN: "t" })).toEqual({
      ccplan: null,
      rateLimitTier: null,
      authMethod: "oauth",
      rawSubscriptionType: null,
    });
    const env = {
      CLAUDE_CODE_OAUTH_TOKEN: "t",
      CLAUDE_CODE_SUBSCRIPTION_TYPE: "pro",
      CLAUDE_CODE_RATE_LIMIT_TIER: "default_claude_ai",
    };
    expect(creds(env)).toEqual({
      ccplan: "pro",
      rateLimitTier: "default_claude_ai",
      authMethod: "oauth",
      rawSubscriptionType: "pro",
    });
  });

  it("ignores a saved login without an access token", () => {
    oauth("max", undefined, { accessToken: "" });
    expect(creds({}).ccplan).toBeNull();
  });

  it("reads the login from CLAUDE_SECURESTORAGE_CONFIG_DIR when it is set", () => {
    oauth("max");
    write("secure/.credentials.json", {
      claudeAiOauth: { accessToken: "a", subscriptionType: "team" },
    });
    const secure = path.join(home, "secure");
    expect(creds({ CLAUDE_SECURESTORAGE_CONFIG_DIR: secure }).ccplan).toBe("team");
    expect(creds({ CLAUDE_SECURESTORAGE_CONFIG_DIR: "" }).ccplan).toBe("max");
    // Empty means ~/.claude even when CLAUDE_CONFIG_DIR names another folder
    write("alt/.credentials.json", {
      claudeAiOauth: { accessToken: "a", subscriptionType: "team" },
    });
    const both = { CLAUDE_CONFIG_DIR: path.join(home, "alt"), CLAUDE_SECURESTORAGE_CONFIG_DIR: "" };
    expect(creds(both).ccplan).toBe("max");
  });

  it("reads the login, .claude.json and settings.json from CLAUDE_CONFIG_DIR when it is set", () => {
    const dir = path.join(home, "alt");
    write("alt/.credentials.json", {
      claudeAiOauth: { accessToken: "a", subscriptionType: "team" },
    });
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
});

describe("enterprise gateway", () => {
  const GATEWAY = {
    ccplan: null,
    rateLimitTier: null,
    authMethod: "unknown",
    rawSubscriptionType: "enterprise_gateway",
  };
  const TRUSTED = { "gw.example": "sha256/AAAA" };
  // A saved gateway sign-in next to a working login
  const saved = (gateway: Record<string, unknown>, gatewayTrust?: unknown) =>
    write(".claude/.credentials.json", {
      enterpriseGateway: {
        url: "https://gw.example",
        jwt: "j",
        expiresAt: Date.UTC(2100, 0, 1),
        ...gateway,
      },
      ...(gatewayTrust === undefined ? {} : { gatewayTrust }),
      claudeAiOauth: { accessToken: "a", subscriptionType: "max", scopes: ["user:inference"] },
    });

  it("reports nothing for a trusted saved sign-in, ahead of every provider", () => {
    saved({}, TRUSTED);
    expect(creds({ CLAUDE_CODE_USE_BEDROCK: "1" })).toEqual(GATEWAY);
  });

  it("lets a provider win over a saved sign-in Claude Code would not restore", () => {
    const lapsed: [Record<string, unknown>, unknown][] = [
      [{}, undefined],
      [{}, { "other.example": "sha256/AAAA" }],
      [{}, { "gw.example": "" }],
      [{ expiresAt: Date.UTC(2000, 0, 1) }, TRUSTED],
      [{ expiresAt: null }, TRUSTED],
      [{ url: "not a url" }, TRUSTED],
    ];
    for (const [gateway, trust] of lapsed) {
      saved(gateway, trust);
      expect(creds({ CLAUDE_CODE_USE_BEDROCK: "1" }).ccplan).toBe("bedrock");
      // Without one it still says nothing: a policy not read here may require the gateway
      expect(creds({})).toEqual(GATEWAY);
    }
  });

  it("restores one that can refresh or has no expiry, and an IPv6 host without brackets", () => {
    const bedrock = { CLAUDE_CODE_USE_BEDROCK: "1" };
    saved({ expiresAt: Date.UTC(2000, 0, 1), idpRefreshToken: "r" }, TRUSTED);
    expect(creds(bedrock)).toEqual(GATEWAY);
    saved({ expiresAt: undefined }, TRUSTED);
    expect(creds(bedrock)).toEqual(GATEWAY);
    saved({ url: "https://[::1]:8443" }, { "::1": "sha256/AAAA" });
    expect(creds(bedrock)).toEqual(GATEWAY);
  });

  it("reports nothing when managed settings require a gateway and no provider is on", () => {
    oauth("max", undefined, { scopes: ["user:inference"] });
    write("managed/managed-settings.json", { forceLoginMethod: "gateway" });
    expect(creds({})).toEqual(GATEWAY);
    expect(creds({ ANTHROPIC_API_KEY: KEY })).toEqual(GATEWAY);
    expect(creds({ CLAUDE_CODE_USE_BEDROCK: "1" }).ccplan).toBe("bedrock");
    // Only the shell's value counts: Claude Code takes it from no settings file. (What a host
    // then hands over is not read here; the saved login stands in for it.)
    expect(creds({ CLAUDE_CODE_PROVIDER_MANAGED_BY_HOST: "1" }).ccplan).toBe("max");
    write(".claude/settings.json", { env: { CLAUDE_CODE_PROVIDER_MANAGED_BY_HOST: "1" } });
    expect(creds({})).toEqual(GATEWAY);
    write("managed/managed-settings.json", {
      forceLoginMethod: "gateway",
      env: { CLAUDE_CODE_PROVIDER_MANAGED_BY_HOST: "1" },
    });
    expect(creds({})).toEqual(GATEWAY);
    fs.rmSync(path.join(home, ".claude/settings.json"));

    write("managed/managed-settings.json", { forceLoginGatewayUrl: "https://gw.example" });
    expect(creds({})).toEqual(GATEWAY);
    // Values its schema rejects count as unset
    write("managed/managed-settings.json", { forceLoginGatewayUrl: "", forceLoginMethod: "sso" });
    expect(creds({}).ccplan).toBe("max");
    // A drop-in applied later wins
    write("managed/managed-settings.json", { forceLoginMethod: "gateway" });
    write("managed/managed-settings.d/50-login.json", { forceLoginMethod: "claudeai" });
    expect(creds({}).ccplan).toBe("max");
    write("managed/managed-settings.d/60-login.json", { forceLoginMethod: "gateway" });
    expect(creds({})).toEqual(GATEWAY);
  });

  it("reads each managed layer on its own: a later file without a valid value keeps an earlier one", () => {
    oauth("max", undefined, { scopes: ["user:inference"] });
    write("managed/managed-settings.json", { forceLoginMethod: "gateway" });
    for (const later of [
      { forceLoginMethod: "sso" },
      { forceLoginMethod: ["claudeai"] },
      { forceLoginMethod: null },
      { permissions: { allow: ["Bash(ls)"] } },
    ]) {
      write("managed/managed-settings.d/50-policy.json", later);
      expect(creds({})).toEqual(GATEWAY);
    }

    write("managed/managed-settings.json", { forceLoginGatewayUrl: "https://gw.example" });
    for (const later of [{ forceLoginGatewayUrl: "" }, { forceLoginMethod: "claudeai" }]) {
      write("managed/managed-settings.d/50-policy.json", later);
      expect(creds({})).toEqual(GATEWAY);
    }
  });

  it("applies a managed gateway requirement in bare mode too", () => {
    write("managed/managed-settings.json", { forceLoginMethod: "gateway" });
    for (const platform of ["linux", "darwin"] as const) {
      expect(creds({ CLAUDE_CODE_SIMPLE: "1", ANTHROPIC_API_KEY: KEY }, { platform })).toEqual(
        GATEWAY
      );
    }
  });

  it("ignores a gateway requirement in the user's own settings", () => {
    oauth("max", undefined, { scopes: ["user:inference"] });
    write(".claude/settings.json", {
      forceLoginMethod: "gateway",
      forceLoginGatewayUrl: "https://gw.example",
    });
    expect(creds({}).ccplan).toBe("max");
  });

  it("reports nothing for CLAUDE_CODE_USE_GATEWAY with a base URL and a token", () => {
    const env = {
      CLAUDE_CODE_USE_GATEWAY: "1",
      ANTHROPIC_BASE_URL: "https://gw.example",
      ANTHROPIC_AUTH_TOKEN: "t",
    };
    expect(creds(env)).toEqual(GATEWAY);
    expect(creds({ ...env, CLAUDE_CODE_USE_BEDROCK: "1" })).toEqual(GATEWAY);
    expect(creds({ ...env, CLAUDE_CODE_SIMPLE: "1" })).toEqual(GATEWAY);
    // Without the URL, or with the switch off, the token is an API credential
    expect(creds({ ...env, ANTHROPIC_BASE_URL: " " }).ccplan).toBe("api");
    expect(creds({ ...env, CLAUDE_CODE_USE_GATEWAY: "0" }).ccplan).toBe("api");

    write(".claude/settings.json", {
      env: { CLAUDE_CODE_USE_GATEWAY: true, ANTHROPIC_BASE_URL: "https://gw.example" },
    });
    expect(creds({ ANTHROPIC_AUTH_TOKEN: "t" })).toEqual(GATEWAY);
  });

  it("takes the gateway token from a settings env block, and needs one", () => {
    oauth("max", undefined, { scopes: ["user:inference"] });
    const env = { CLAUDE_CODE_USE_GATEWAY: "1", ANTHROPIC_BASE_URL: "https://gw.example" };
    expect(creds(env).ccplan).toBe("max");
    write(".claude/settings.json", { env: { ANTHROPIC_AUTH_TOKEN: "t" } });
    expect(creds(env)).toEqual(GATEWAY);
  });
});

describe("macOS Keychain", () => {
  const login = (plan: string) =>
    JSON.stringify({ claudeAiOauth: { accessToken: "a", subscriptionType: plan } });
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
    const env = { CLAUDE_CONFIG_DIR: "/tmp/claude-work", USER: "dev" };
    expect(creds(env, { platform: "darwin" }).ccplan).toBe("team");
    expect(security.run.mock.calls[0]?.[0]).toEqual([
      "find-generic-password",
      "-a",
      "dev",
      "-w",
      "-s",
      "Claude Code-credentials-bfc1769a",
    ]);
    expect(creds({}, { platform: "darwin" }).ccplan).toBe("max");
  });

  it("asks the Keychain before the file, with a time limit, and falls back to the file", () => {
    oauth("pro");
    security.run.mockImplementation((args) => (args.includes("-w") ? login("max") : noKeychain()));
    expect(creds({}, { platform: "darwin" }).ccplan).toBe("max");
    expect(security.run.mock.calls[0]?.[1]?.timeout).toBe(5000);

    security.run.mockImplementation((args) => (args.includes("-w") ? "not json" : noKeychain()));
    expect(creds({}, { platform: "darwin" }).ccplan).toBe("pro");
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
    creds({ USER: "first.last" }, { platform: "darwin" });
    const dotted = security.run.mock.calls.find(([args]) => serviceOf(args) === "Claude Code");
    expect(dotted?.[0]?.slice(-2)).toEqual(["-a", "first.last"]);

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
