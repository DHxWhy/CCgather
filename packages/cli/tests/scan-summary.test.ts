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

import { scanAllProjects, scanUsageDataFromPath } from "../src/lib/ccgather-json";

const M = 1_000_000;
let configDir: string;

interface Usage {
  input?: number;
  output?: number;
  cache?: [number, number];
  cacheRead?: number;
  speed?: "fast";
}

function usageLine(id: string, model: string, ts: string, u: Usage, session = "s1"): string {
  return JSON.stringify({
    type: "assistant",
    sessionId: session,
    requestId: `req_${id}`,
    timestamp: ts,
    message: {
      id: `msg_${id}`,
      model,
      usage: {
        input_tokens: u.input ?? 0,
        output_tokens: u.output ?? 0,
        cache_creation_input_tokens: u.cache ? u.cache[0] + u.cache[1] : 0,
        cache_read_input_tokens: u.cacheRead ?? 0,
        ...(u.cache
          ? {
              cache_creation: {
                ephemeral_5m_input_tokens: u.cache[0],
                ephemeral_1h_input_tokens: u.cache[1],
              },
            }
          : {}),
        ...(u.speed ? { speed: u.speed } : {}),
      },
    },
  });
}

function writeTranscript(project: string, file: string, lines: string[]): string {
  const target = path.join(configDir, "projects", project, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, lines.join("\n") + "\n");
  return target;
}

beforeEach(() => {
  mocked.home = fs.mkdtempSync(path.join(os.tmpdir(), "ccgather-summary-home-"));
  configDir = fs.mkdtempSync(path.join(os.tmpdir(), "ccgather-summary-"));
  vi.stubEnv("CLAUDE_CONFIG_DIR", configDir);
  vi.stubEnv("APPDATA", "");
  vi.stubEnv("XDG_CONFIG_HOME", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
  fs.rmSync(mocked.home, { recursive: true, force: true });
  fs.rmSync(configDir, { recursive: true, force: true });
});

describe("fast and 1-hour shares reach the payload and the CLI's cost", () => {
  it("sends a fast Opus 4.6 response's 1h share inside its fast share and bills the 6x premium", () => {
    const ts = "2026-10-20T05:00:00.000Z";
    const big = {
      input: 2000,
      cache: [100_000, 300_000] as [number, number],
      cacheRead: M,
      speed: "fast" as const,
    };
    writeTranscript("p", "s1.jsonl", [
      usageLine("1", "claude-opus-4-6", ts, { ...big, output: 8 }),
      usageLine("1", "claude-opus-4-6", ts, { ...big, output: 534_000 }),
    ]);

    const day = scanAllProjects()?.dailyUsage[0];

    const share = {
      inputTokens: 2000,
      outputTokens: 534_000,
      cacheWriteTokens: 400_000,
      cacheWrite1hTokens: 300_000,
      cacheReadTokens: M,
    };
    expect(day?.modelTokens?.["claude-opus-4-6"]).toEqual({ ...share, fast: share });
    // Built-in Opus 4.6 rates $5 / $25, 5m write $6.25, 1h write $10, read $0.50:
    // 0.01 + 13.35 + 0.625 + 3 + 0.5 = 17.485, plus a 5 x 17.485 fast premium.
    expect(day?.cost).toBe(104.91);
  });
});

describe("costs are rounded once, per day, project and total", () => {
  it("sums each project's own models unrounded", () => {
    const ts = "2026-10-20T05:00:00.000Z";
    writeTranscript("p1", "a.jsonl", [
      usageLine("a1", "claude-haiku-4-5", ts, { input: 4000 }),
      usageLine("a2", "claude-sonnet-4-6", ts, { input: 1000 }),
    ]);
    writeTranscript("p2", "b.jsonl", [
      usageLine("b1", "claude-haiku-4-5", ts, { input: 40_000 }, "s2"),
    ]);

    const data = scanAllProjects();

    // Haiku 4.5 $1/M, Sonnet 4.6 $3/M: p1 0.004 + 0.003, p2 0.04, the day 0.047.
    expect(data?.projects.p1?.cost).toBe(0.01);
    expect(data?.projects.p2?.cost).toBe(0.04);
    expect(data?.dailyUsage[0]?.cost).toBe(0.05);
    expect(data?.usage.totalCost).toBe(0.05);
  });

  it("sends a day without 1h or fast tokens exactly as an older CLI did", () => {
    writeTranscript("p", "s1.jsonl", [
      usageLine("1", "claude-haiku-4-5", "2026-10-20T05:00:00.000Z", { input: 4000, output: 10 }),
    ]);

    const split = scanAllProjects()?.dailyUsage[0]?.modelTokens?.["claude-haiku-4-5"];

    expect(JSON.stringify(split)).toBe(
      JSON.stringify({
        inputTokens: 4000,
        outputTokens: 10,
        cacheWriteTokens: 0,
        cacheReadTokens: 0,
      })
    );
  });
});

describe("costs over several days", () => {
  it("rounds each day and the total once, from unrounded sums", () => {
    writeTranscript("p", "s1.jsonl", [
      usageLine("1", "claude-haiku-4-5", "2026-10-19T05:00:00.000Z", { input: 4000 }),
      usageLine("2", "claude-haiku-4-5", "2026-10-20T05:00:00.000Z", { input: 4000 }),
    ]);

    const data = scanAllProjects();

    // $0.004 a day: each day rounds to 0.00, the total of $0.008 to 0.01.
    expect(data?.dailyUsage.map((d) => d.cost)).toEqual([0, 0]);
    expect(data?.usage.totalCost).toBe(0.01);
    expect(data?.projects.p?.cost).toBe(0.01);
  });
});

describe("a /btw replay saved after an earlier submit", () => {
  it("keeps the parent's tokens on the parent's day, so a resubmit does not count them twice", () => {
    const big = { input: 6, output: 300, cacheRead: 50_000 };
    writeTranscript("p", "s1.jsonl", [
      usageLine("p1", "claude-opus-4-8", "2026-10-01T10:00:00.000Z", big),
    ]);
    const before = scanAllProjects()?.dailyUsage;

    // /btw writes its replay of the parent and its own answer under s1/subagents/, which a
    // scan reads before s1.jsonl.
    const replay = JSON.parse(
      usageLine("p1", "claude-opus-4-8", "2026-10-02T08:00:00.000Z", big)
    ) as Record<string, unknown>;
    const answer = JSON.parse(
      usageLine("a1", "claude-opus-4-8", "2026-10-02T08:00:05.000Z", { input: 3, output: 40 })
    ) as Record<string, unknown>;
    writeTranscript(
      "p",
      "s1/subagents/agent-aside_question-1.jsonl",
      [
        { ...replay, requestId: "req_replay", isSidechain: true, agentId: "aside_question-1" },
        { ...answer, isSidechain: true, agentId: "aside_question-1" },
      ].map((event) => JSON.stringify(event))
    );
    const after = scanAllProjects()?.dailyUsage;

    expect(before?.map((d) => [d.date, d.tokens])).toEqual([["2026-10-01", 50_306]]);
    expect(after?.map((d) => [d.date, d.tokens])).toEqual([
      ["2026-10-01", 50_306],
      ["2026-10-02", 43],
    ]);
  });
});

describe("summary fields", () => {
  it("reads the sign-in unless told not to", () => {
    writeTranscript("p", "s1.jsonl", [
      usageLine("1", "claude-haiku-4-5", "2026-10-20T05:00:00.000Z", { input: 10 }),
    ]);

    expect(scanAllProjects()?.account).toEqual({
      ccplan: null,
      rateLimitTier: null,
      authMethod: "unknown",
      rawSubscriptionType: null,
    });
    expect(scanAllProjects({ readAccount: false })?.account).toBeUndefined();
  });

  it("reports the first and last day even when the later file is read first", () => {
    writeTranscript("p", "a.jsonl", [
      usageLine("2", "claude-haiku-4-5", "2026-10-20T05:00:00.000Z", { input: 10 }),
    ]);
    writeTranscript("p", "b.jsonl", [
      usageLine("1", "claude-haiku-4-5", "2026-10-18T05:00:00.000Z", { input: 10 }, "s2"),
    ]);

    const stats = scanAllProjects()?.stats;

    expect(stats?.firstUsed).toBe("2026-10-18");
    expect(stats?.lastUsed).toBe("2026-10-20");
  });

  it("does not count a file whose lines only mention a usage key", () => {
    writeTranscript("p", "s1.jsonl", [
      usageLine("1", "claude-haiku-4-5", "2026-10-20T05:00:00.000Z", { input: 10 }),
    ]);
    writeTranscript("p", "notes.jsonl", [JSON.stringify({ type: "system", usage: "n/a" })]);

    expect(scanAllProjects()?.stats.sessionsCount).toBe(1);
  });

  it("counts a file without a session id that holds only agent-progress usage", () => {
    const progress = JSON.stringify({
      type: "progress",
      data: {
        message: {
          timestamp: "2026-10-20T05:00:00.000Z",
          requestId: "req_sub",
          message: {
            id: "msg_sub",
            model: "claude-haiku-4-5",
            usage: { input_tokens: 4, output_tokens: 6 },
          },
        },
      },
    });
    writeTranscript("p", "journal.jsonl", [progress]);

    expect(scanAllProjects()?.stats.sessionsCount).toBe(1);
  });

  it("reports the first and last day used", () => {
    writeTranscript("p", "s1.jsonl", [
      usageLine("1", "claude-haiku-4-5", "2026-10-18T05:00:00.000Z", { input: 10 }),
      usageLine("2", "claude-haiku-4-5", "2026-10-20T05:00:00.000Z", { input: 10 }),
    ]);

    const stats = scanAllProjects()?.stats;

    expect(stats?.firstUsed).toBe("2026-10-18");
    expect(stats?.lastUsed).toBe("2026-10-20");
    expect(stats?.daysTracked).toBe(2);
  });

  it("a project scan keeps its default 30 days and reports progress per file", () => {
    const now = Date.now();
    const daysAgo = (n: number) => new Date(now - n * 24 * 60 * 60 * 1000).toISOString();
    writeTranscript("p", "old.jsonl", [
      usageLine("1", "claude-haiku-4-5", daysAgo(40), { input: 7 }),
    ]);
    writeTranscript("p", "new.jsonl", [
      usageLine("2", "claude-haiku-4-5", daysAgo(2), { input: 5 }, "s2"),
    ]);
    const progress: [number, number][] = [];

    const data = scanUsageDataFromPath(path.join(configDir, "projects", "p"), {
      onProgress: (current, total) => progress.push([current, total]),
    });

    expect(data?.usage.inputTokens).toBe(5);
    expect(progress).toEqual([
      [1, 2],
      [2, 2],
    ]);
  });
});
