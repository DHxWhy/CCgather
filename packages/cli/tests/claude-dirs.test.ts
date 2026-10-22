import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

const mocked = vi.hoisted(() => ({ home: "" }));

vi.mock("os", async (importOriginal) => {
  const actual = await importOriginal<typeof import("os")>();
  return { ...actual, homedir: () => mocked.home };
});

// The real conf store holds the user's confirmed data folders; a scan must not read them.
vi.mock("../src/lib/config", () => ({ getConfig: () => ({ get: () => undefined }) }));

vi.mock("../src/lib/credentials", () => ({
  readCredentials: () => ({
    ccplan: null,
    rateLimitTier: null,
    authMethod: "unknown",
    rawSubscriptionType: null,
  }),
}));

import {
  claudeConfigDirCandidates,
  findCandidateClaudeDirs,
  resolveClaudeConfigDirs,
  shellOnlyClaudeDirs,
} from "../src/lib/claude-dirs";
import { scanAllProjects } from "../src/lib/ccgather-json";

const FIXTURE = path.join(__dirname, "fixtures", "ccusage-parity");

let home: string;

function dataDir(relative: string): string {
  const dir = path.join(home, relative);
  fs.mkdirSync(path.join(dir, "projects"), { recursive: true });
  return dir;
}

beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), "ccgather-dirs-"));
  mocked.home = home;
  vi.stubEnv("CLAUDE_CONFIG_DIR", "");
  vi.stubEnv("XDG_CONFIG_HOME", "");
  vi.stubEnv("APPDATA", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
  fs.rmSync(home, { recursive: true, force: true });
});

describe("resolveClaudeConfigDirs", () => {
  it("reads every folder of a comma-separated CLAUDE_CONFIG_DIR, then the default", () => {
    const a = dataDir("a");
    const b = dataDir("b");
    const legacy = dataDir(".claude");
    expect(resolveClaudeConfigDirs({ CLAUDE_CONFIG_DIR: `${a}, ${b}` }, home, {}, "linux")).toEqual(
      [a, b, legacy]
    );
  });

  it("takes a path to projects/ itself, and expands ~", () => {
    const work = dataDir("work");
    expect(
      resolveClaudeConfigDirs({ CLAUDE_CONFIG_DIR: path.join(work, "projects") }, home, {}, "linux")
    ).toEqual([work]);
    expect(resolveClaudeConfigDirs({ CLAUDE_CONFIG_DIR: "~/work" }, home, {}, "linux")).toEqual([
      work,
    ]);
  });

  it("uses $XDG_CONFIG_HOME/claude, or ~/.config/claude without it", () => {
    const xdg = dataDir("xdg/claude");
    expect(
      resolveClaudeConfigDirs({ XDG_CONFIG_HOME: path.join(home, "xdg") }, home, {}, "linux")
    ).toEqual([xdg]);
    const config = dataDir(".config/claude");
    expect(resolveClaudeConfigDirs({}, home, {}, "linux")).toEqual([config]);
  });

  it("keeps ~/.config/claude when XDG_CONFIG_HOME points elsewhere", () => {
    const xdg = dataDir("xdg/claude");
    const config = dataDir(".config/claude");
    expect(
      resolveClaudeConfigDirs({ XDG_CONFIG_HOME: path.join(home, "xdg") }, home, {}, "linux")
    ).toEqual([xdg, config]);
  });

  it("reads %APPDATA%\\claude on Windows only", () => {
    const appData = path.join(home, "AppData", "Roaming");
    const win = dataDir("AppData/Roaming/claude");
    expect(resolveClaudeConfigDirs({ APPDATA: appData }, home, {}, "win32")).toEqual([win]);
    expect(resolveClaudeConfigDirs({ APPDATA: appData }, home, {}, "linux")).toEqual([]);
  });

  it("follows CLAUDE_CONFIG_DIR set in ~/.claude/settings.json", () => {
    const acc = dataDir("acc2");
    fs.mkdirSync(path.join(home, ".claude"), { recursive: true });
    fs.writeFileSync(
      path.join(home, ".claude", "settings.json"),
      JSON.stringify({ env: { CLAUDE_CONFIG_DIR: "~/acc2" } })
    );
    expect(resolveClaudeConfigDirs({}, home, {}, "linux")).toEqual([acc]);
  });

  it("adds the folders the user confirmed, and skips folders without projects/", () => {
    const saved = dataDir(".claude-work");
    fs.mkdirSync(path.join(home, "empty"), { recursive: true });
    expect(
      resolveClaudeConfigDirs(
        { CLAUDE_CONFIG_DIR: path.join(home, "empty") },
        home,
        { claudeDirs: [saved] },
        "linux"
      )
    ).toEqual([saved]);
  });

  it("reads a folder once even when two paths lead to it", () => {
    const real = dataDir("real");
    const link = path.join(home, "link");
    fs.symlinkSync(real, link);
    expect(
      resolveClaudeConfigDirs({ CLAUDE_CONFIG_DIR: `${real},${link}` }, home, {}, "linux")
    ).toEqual([real]);
  });

  it("reads a projects/ folder shared through a link once", () => {
    const main = dataDir(".claude");
    const work = path.join(home, ".claude-work");
    fs.mkdirSync(work, { recursive: true });
    fs.symlinkSync(path.join(main, "projects"), path.join(work, "projects"));
    expect(resolveClaudeConfigDirs({}, home, { claudeDirs: [work] }, "linux")).toEqual([main]);
    expect(findCandidateClaudeDirs({}, home, {}, "linux")).toEqual([]);
  });

  it("lists every place it looked, for the no-sessions report", () => {
    expect(claudeConfigDirCandidates({ CLAUDE_CONFIG_DIR: "~/x" }, home, {}, "linux")).toEqual([
      path.join(home, "x"),
      path.join(home, ".config", "claude"),
      path.join(home, ".claude"),
    ]);
  });
});

describe("findCandidateClaudeDirs", () => {
  it("finds other ~/.claude* data folders, one level deep, not yet asked about", () => {
    dataDir(".claude");
    const work = dataDir(".claude-work");
    const slot = dataDir(".claude-accounts/slot1");
    fs.mkdirSync(path.join(home, ".claude-server-commander"), { recursive: true });
    const declined = dataDir(".claude-old");

    expect(findCandidateClaudeDirs({}, home, { declinedClaudeDirs: [declined] }, "linux")).toEqual(
      [slot, work].sort()
    );
  });

  it("looks for claude* folders in $XDG_CONFIG_HOME and in ~/.config", () => {
    const xdgWork = dataDir("xdg/claude-work");
    const configAlt = dataDir(".config/claude-alt");
    expect(
      findCandidateClaudeDirs({ XDG_CONFIG_HOME: path.join(home, "xdg") }, home, {}, "linux")
    ).toEqual([configAlt, xdgWork].sort());
  });

  it("does not offer a folder that is already read", () => {
    const work = dataDir(".claude-work");
    expect(findCandidateClaudeDirs({ CLAUDE_CONFIG_DIR: work }, home, {}, "linux")).toEqual([]);
    expect(findCandidateClaudeDirs({}, home, { claudeDirs: [work] }, "linux")).toEqual([]);
  });
});

describe("shellOnlyClaudeDirs", () => {
  it("lists folders only the shell's CLAUDE_CONFIG_DIR reaches, unless saved or declined", () => {
    const legacy = dataDir(".claude");
    const a = dataDir("work-a");
    const b = dataDir("work-b");
    const env = { CLAUDE_CONFIG_DIR: `${a},${b}` };
    expect(shellOnlyClaudeDirs(env, home, {}, "linux")).toEqual([a, b]);
    expect(
      shellOnlyClaudeDirs(env, home, { claudeDirs: [a], declinedClaudeDirs: [b] }, "linux")
    ).toEqual([]);
    expect(shellOnlyClaudeDirs({ CLAUDE_CONFIG_DIR: legacy }, home, {}, "linux")).toEqual([]);
    expect(shellOnlyClaudeDirs({}, home, {}, "linux")).toEqual([]);
  });
});

describe("scanAllProjects over several folders", () => {
  it("reads both fixture folders and matches ccusage's day totals", () => {
    vi.stubEnv("CLAUDE_CONFIG_DIR", `${path.join(FIXTURE, "A")},${path.join(FIXTURE, "B")}`);
    const ccusage = JSON.parse(fs.readFileSync(path.join(FIXTURE, "ccusage-daily.json"), "utf-8"));
    const want = ccusage.daily[0];

    const day = scanAllProjects()?.dailyUsage[0];

    expect(day).toMatchObject({
      date: want.date,
      tokens: want.totalTokens,
      inputTokens: want.inputTokens,
      outputTokens: want.outputTokens,
      cacheWriteTokens: want.cacheCreationTokens,
      cacheReadTokens: want.cacheReadTokens,
    });
  });

  it("counts a transcript found in two folders once", () => {
    const copy = dataDir("copy");
    fs.mkdirSync(path.join(copy, "projects", "projA"), { recursive: true });
    fs.copyFileSync(
      path.join(FIXTURE, "A", "projects", "projA", "s1.jsonl"),
      path.join(copy, "projects", "projA", "s1.jsonl")
    );
    vi.stubEnv("CLAUDE_CONFIG_DIR", path.join(FIXTURE, "A"));
    const single = scanAllProjects();
    vi.stubEnv("CLAUDE_CONFIG_DIR", `${path.join(FIXTURE, "A")},${copy}`);

    const both = scanAllProjects();

    expect(both?.dailyUsage[0]?.modelTokens?.["claude-opus-4-8"]?.outputTokens).toBe(534);
    expect(both?.stats.sessionsCount).toBe(single?.stats.sessionsCount);
    expect(both?.sessionFingerprint?.sessionCount).toBe(single?.sessionFingerprint?.sessionCount);
  });

  it("keeps the larger copy of a transcript, even when a smaller copy is newer", () => {
    const full = path.join(FIXTURE, "A", "projects", "projA", "s1.jsonl");
    const firstLine = fs.readFileSync(full, "utf-8").split("\n")[0];
    const backup = dataDir(".claude-bak");
    const partial = path.join(backup, "projects", "projA", "s1.jsonl");
    fs.mkdirSync(path.dirname(partial), { recursive: true });
    fs.writeFileSync(partial, firstLine + "\n");
    const later = new Date(Date.now() + 60_000);
    fs.utimesSync(partial, later, later);

    vi.stubEnv("CLAUDE_CONFIG_DIR", path.join(FIXTURE, "A"));
    const single = scanAllProjects()?.usage.totalTokens;
    vi.stubEnv("CLAUDE_CONFIG_DIR", `${path.join(FIXTURE, "A")},${backup}`);

    expect(scanAllProjects()?.usage.totalTokens).toBe(single);
  });
});
