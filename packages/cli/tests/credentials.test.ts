import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

// Never reach a real macOS Keychain from a test.
vi.mock("child_process", () => ({
  execSync: () => {
    throw new Error("no keychain in tests");
  },
}));

import { readCredentials } from "../src/lib/credentials";

const KEY = "sk-ant-api03-test-key-0123456789abcdefghij";
const TAIL = KEY.slice(-20);

let home: string;

function write(relativePath: string, value: unknown): void {
  const file = path.join(home, relativePath);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value));
}

const oauth = (subscriptionType?: string, rateLimitTier?: string) =>
  write(".claude/.credentials.json", { claudeAiOauth: { subscriptionType, rateLimitTier } });

beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), "ccgather-creds-"));
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
    expect(readCredentials({ [variable]: "1" }, home)).toEqual({
      ccplan: plan,
      rateLimitTier: null,
      authMethod: "cloud",
      rawSubscriptionType: variable,
    });
  });

  it("reads true/yes/on and ignores 0/false", () => {
    expect(readCredentials({ CLAUDE_CODE_USE_VERTEX: "TRUE" }, home).ccplan).toBe("vertex");
    expect(readCredentials({ CLAUDE_CODE_USE_BEDROCK: "0" }, home).ccplan).toBeNull();
    expect(readCredentials({ CLAUDE_CODE_USE_BEDROCK: "false" }, home).ccplan).toBeNull();
  });

  it("shows Mantle on top of Bedrock as Mantle, and Bedrock before Vertex", () => {
    const both = { CLAUDE_CODE_USE_BEDROCK: "1", CLAUDE_CODE_USE_MANTLE: "1" };
    expect(readCredentials(both, home).ccplan).toBe("mantle");
    const two = { CLAUDE_CODE_USE_VERTEX: "1", CLAUDE_CODE_USE_BEDROCK: "1" };
    expect(readCredentials(two, home).ccplan).toBe("bedrock");
  });

  it("outranks every Anthropic credential", () => {
    write(".claude.json", { customApiKeyResponses: { approved: [TAIL], rejected: [] } });
    oauth("max");
    expect(
      readCredentials({ CLAUDE_CODE_USE_BEDROCK: "1", ANTHROPIC_API_KEY: KEY }, home).ccplan
    ).toBe("bedrock");
  });

  it("applies the env block of Claude Code's settings file", () => {
    write(".claude/settings.json", { env: { CLAUDE_CODE_USE_VERTEX: "1" } });
    expect(readCredentials({}, home).ccplan).toBe("vertex");
  });
});

describe("API usage billing", () => {
  it("ANTHROPIC_AUTH_TOKEN → api", () => {
    oauth("max");
    expect(readCredentials({ ANTHROPIC_AUTH_TOKEN: "token" }, home)).toEqual({
      ccplan: "api",
      rateLimitTier: null,
      authMethod: "api_key",
      rawSubscriptionType: "ANTHROPIC_AUTH_TOKEN",
    });
  });

  it("an approved ANTHROPIC_API_KEY → api, never the old 'team'", () => {
    oauth("max");
    write(".claude.json", { customApiKeyResponses: { approved: [TAIL], rejected: [] } });
    const result = readCredentials({ ANTHROPIC_API_KEY: KEY }, home);
    expect(result.ccplan).toBe("api");
    expect(result.authMethod).toBe("api_key");
  });

  it("a declined ANTHROPIC_API_KEY leaves the subscription in use", () => {
    oauth("max");
    write(".claude.json", { customApiKeyResponses: { approved: [], rejected: [TAIL] } });
    expect(readCredentials({ ANTHROPIC_API_KEY: KEY }, home).ccplan).toBe("max");
  });

  it("an unanswered ANTHROPIC_API_KEY counts only when nothing else signs in", () => {
    oauth("pro");
    expect(readCredentials({ ANTHROPIC_API_KEY: KEY }, home).ccplan).toBe("pro");
    fs.rmSync(path.join(home, ".claude"), { recursive: true, force: true });
    expect(readCredentials({ ANTHROPIC_API_KEY: KEY }, home).ccplan).toBe("api");
  });

  it("a key saved by a Claude Console login → api", () => {
    write(".claude.json", { primaryApiKey: "saved" });
    expect(readCredentials({}, home).rawSubscriptionType).toBe("console_login");
    expect(readCredentials({}, home).ccplan).toBe("api");
  });

  it("an apiKeyHelper in the settings → api", () => {
    oauth("max");
    write(".claude/settings.json", { apiKeyHelper: "~/bin/get-key.sh" });
    expect(readCredentials({}, home).ccplan).toBe("api");
  });

  it("a named Anthropic profile or federation credentials → api", () => {
    oauth("max");
    expect(readCredentials({ ANTHROPIC_PROFILE: "work" }, home).ccplan).toBe("api");
    const federation = { ANTHROPIC_FEDERATION_RULE_ID: "r", ANTHROPIC_ORGANIZATION_ID: "o" };
    expect(readCredentials(federation, home).ccplan).toBe("api");
    expect(readCredentials({ ANTHROPIC_FEDERATION_RULE_ID: "r" }, home).ccplan).toBe("max");
  });
});

describe("subscriptions", () => {
  it("reads the plan Claude Code saved at /login", () => {
    oauth("max", "default_claude_max_20x");
    expect(readCredentials({}, home)).toEqual({
      ccplan: "max",
      rateLimitTier: "default_claude_max_20x",
      authMethod: "oauth",
      rawSubscriptionType: "max",
    });
  });

  it("falls back to the rate-limit tier, and sends only the server's plan keys", () => {
    oauth(undefined, "default_claude_max_20x");
    expect(readCredentials({}, home).ccplan).toBe("max");
    oauth(undefined, "default_claude_team_5x");
    expect(readCredentials({}, home).ccplan).toBe("team");
    oauth(undefined, "default_claude_ai");
    expect(readCredentials({}, home).ccplan).toBeNull();
  });

  it("CLAUDE_CODE_OAUTH_TOKEN is a subscription, typed from the saved login when there is one", () => {
    oauth("pro");
    expect(readCredentials({ CLAUDE_CODE_OAUTH_TOKEN: "t" }, home).ccplan).toBe("pro");
    fs.rmSync(path.join(home, ".claude"), { recursive: true, force: true });
    expect(readCredentials({ CLAUDE_CODE_OAUTH_TOKEN: "t" }, home)).toEqual({
      ccplan: null,
      rateLimitTier: null,
      authMethod: "oauth",
      rawSubscriptionType: null,
    });
  });

  it("reads everything from CLAUDE_CONFIG_DIR when it is set", () => {
    const dir = path.join(home, "alt");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, ".credentials.json"),
      JSON.stringify({ claudeAiOauth: { subscriptionType: "team" } })
    );
    oauth("max");
    expect(readCredentials({ CLAUDE_CONFIG_DIR: dir }, home).ccplan).toBe("team");
  });
});

it("reports nothing when no credential is found", () => {
  expect(readCredentials({}, home)).toEqual({
    ccplan: null,
    rateLimitTier: null,
    authMethod: "unknown",
    rawSubscriptionType: null,
  });
});
