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

describe("files read in path order, as ccusage does", () => {
  const event = (
    id: string,
    model: string,
    ts: string,
    u: Usage,
    fields: Record<string, unknown>
  ): string => JSON.stringify({ ...JSON.parse(usageLine(id, model, ts, u)), ...fields });

  // A parent message in s1, its copy in s2, and a /btw replay of it in s2/subagents/
  const copiedSession = (withAnswer: boolean, copyHead: string[] = []) => {
    const parent = { input: 3, output: 100, cacheRead: 20_000 };
    writeTranscript("p", "s1.jsonl", [
      usageLine("ref", "claude-sonnet-4-6", "2026-10-01T09:00:00.000Z", { input: 1000, output: 1 }),
      usageLine("p", "claude-opus-4-8", "2026-10-01T10:00:00.000Z", parent),
    ]);
    writeTranscript("p", "s2.jsonl", [
      ...copyHead,
      event("p", "claude-opus-4-8", "2026-10-01T10:00:00.000Z", parent, { sessionId: "s2" }),
    ]);
    const replay = event("p", "claude-opus-4-8", "2026-10-02T08:00:00.000Z", parent, {
      sessionId: "s2",
      requestId: "req_replay",
      isSidechain: true,
      agentId: "aside_question-1",
    });
    const answer = event(
      "btw",
      "claude-opus-4-8",
      "2026-10-02T08:00:05.000Z",
      { input: 3, output: 50, cacheRead: 30_000 },
      { sessionId: "s2", isSidechain: true, agentId: "aside_question-1" }
    );
    writeTranscript(
      "p",
      "s2/subagents/agent-aside_question-1.jsonl",
      withAnswer ? [replay, answer] : [replay]
    );
  };

  it("counts a /btw replay in a session holding a copied message once", () => {
    copiedSession(true);
    // ccusage 20.0.37: 2026-10-01 21,104 · 2026-10-02 30,053
    expect(scanAllProjects()?.dailyUsage.map((d) => [d.date, d.tokens])).toEqual([
      ["2026-10-01", 21_104],
      ["2026-10-02", 30_053],
    ]);
  });

  // A first line that names no session leaves the copy unidentified for deduplication
  it.each([
    ["a blank line", [""]],
    ["a line that is not JSON", ["{not json"]],
  ])("reads a copy in path order when its first line is %s", (_label, copyHead) => {
    copiedSession(true, copyHead);
    expect(scanAllProjects()?.dailyUsage.map((d) => [d.date, d.tokens])).toEqual([
      ["2026-10-01", 21_104],
      ["2026-10-02", 30_053],
    ]);
  });

  it("reads one project folder in the same order", () => {
    copiedSession(true);
    const data = scanUsageDataFromPath(path.join(configDir, "projects", "p"), { days: 0 });
    expect(data?.dailyUsage.map((d) => [d.date, d.tokens])).toEqual([
      ["2026-10-01", 21_104],
      ["2026-10-02", 30_053],
    ]);
  });

  it("leaves no day behind for a /btw replay without an answer", () => {
    copiedSession(false);
    const data = scanAllProjects();
    expect(data?.dailyUsage.map((d) => d.date)).toEqual(["2026-10-01"]);
    expect(data?.stats.lastUsed).toBe("2026-10-01");
  });

  it("reports the last day from the days that hold usage, not from a line that moved", () => {
    const parent = { input: 3, output: 100 };
    // a-replay.jsonl sorts before s1.jsonl, so the replay is seen first and then moves back
    writeTranscript("p", "a-replay.jsonl", [
      event("p", "claude-opus-4-8", "2026-10-02T08:00:00.000Z", parent, {
        requestId: "req_replay",
        isSidechain: true,
        agentId: "aside_question-1",
      }),
    ]);
    writeTranscript("p", "s1.jsonl", [
      usageLine("p", "claude-opus-4-8", "2026-10-01T10:00:00.000Z", parent),
    ]);
    const data = scanAllProjects();
    expect(data?.dailyUsage.map((d) => d.date)).toEqual(["2026-10-01"]);
    expect(data?.stats.firstUsed).toBe("2026-10-01");
    expect(data?.stats.lastUsed).toBe("2026-10-01");
  });
});

// Every file is read in path order, copies included, as ccusage reads them; the expected
// values are ccusage 20.0.37's on the same files
describe("path order and copies, as ccusage", () => {
  const P = { input: 3, output: 100, cacheRead: 20_000 }; // 20,103
  const parentIn = (session: string) =>
    JSON.stringify({
      ...JSON.parse(usageLine("p", "claude-opus-4-8", "2026-10-01T10:00:00.000Z", P)),
      sessionId: session,
    });
  const replay = JSON.stringify({
    ...JSON.parse(
      usageLine("p", "claude-opus-4-8", "2026-10-02T08:00:00.000Z", {
        input: 3,
        output: 100,
        cacheRead: 30_000,
      })
    ),
    sessionId: "sA",
    requestId: "req_replay",
    isSidechain: true,
  }); // 30,103
  const other = usageLine("q", "claude-sonnet-4-6", "2026-10-01T11:00:00.000Z", {
    input: 1000,
    output: 1,
  }); // 1,001
  const head = (session: string) =>
    JSON.stringify({ type: "queue-operation", operation: "enqueue", sessionId: session });
  const aside = JSON.stringify({
    type: "user",
    isSidechain: true,
    agentId: "aside_question-1",
    sessionId: "sA",
    message: { role: "user", content: "task" },
  });
  const at = (seconds: number) => new Date(Date.UTC(2026, 8, 21) + seconds * 1000);
  const write = (root: string, file: string, lines: string[], seconds = 0): void => {
    const target = path.join(root, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, lines.join("\n") + "\n");
    fs.utimesSync(target, at(seconds), at(seconds));
  };
  const days = () => scanAllProjects()?.dailyUsage.map((d) => [d.date, d.tokens]);

  it("reads files by their path bytes, so B.jsonl comes before a.jsonl", () => {
    const line = (session: string, ts: string) =>
      JSON.stringify({
        ...JSON.parse(usageLine("x", "claude-opus-4-8", ts, { input: 3, output: 5 })),
        sessionId: session,
      });
    write(configDir, "projects/p/B.jsonl", [line("s1", "2026-10-01T10:00:00.000Z")]);
    write(configDir, "projects/p/a.jsonl", [line("s2", "2026-10-02T10:00:00.000Z")]);
    expect(days()).toEqual([["2026-10-01", 8]]);
  });

  it("reads an older copy where it sits, before the replay it answers (Y70)", () => {
    write(configDir, "projects/pa/sA.jsonl", [head("sA"), parentIn("sA")]);
    write(configDir, "projects/pa/sA/subagents/agent-aside_question-1.jsonl", [aside, replay]);
    write(configDir, "projects/pb/sB.jsonl", [head("sB"), parentIn("sB")]);
    write(configDir, "projects/pz/sA.jsonl", [head("sA"), parentIn("sA")], 60);
    expect(days()).toEqual([["2026-10-01", 20_103]]);
  });

  it("reads a backup folder that sorts first (Y72)", () => {
    const bak = path.join(configDir, "c", ".claude-bak");
    const live = path.join(configDir, "c", ".claude");
    write(bak, "projects/p/sA.jsonl", [head("sA"), parentIn("sA")], 100);
    write(bak, "projects/p/sA/subagents/agent-aside_question-1.jsonl", [aside, replay], 100);
    write(bak, "projects/p/sB.jsonl", [head("sB"), parentIn("sB")], 100);
    write(live, "projects/p/sA.jsonl", [head("sA"), parentIn("sA"), other], 200);
    write(live, "projects/p/sA/subagents/agent-aside_question-1.jsonl", [aside, replay]);
    write(live, "projects/p/sB.jsonl", [head("sB"), parentIn("sB")]);
    vi.stubEnv("CLAUDE_CONFIG_DIR", `${bak},${live}`);
    expect(days()).toEqual([["2026-10-01", 21_104]]);
  });

  it("counts a replay read before the only copy that holds its parent, as ccusage (Y73)", () => {
    write(configDir, "projects/pa/sA.jsonl", [head("sA"), other]);
    write(configDir, "projects/pa/sA/subagents/agent-aside_question-1.jsonl", [aside, replay]);
    write(configDir, "projects/pb/sB.jsonl", [head("sB"), parentIn("sB")]);
    write(configDir, "projects/pz/sA.jsonl", [head("sA"), other, parentIn("sA")]);
    expect(days()).toEqual([
      ["2026-10-01", 21_104],
      ["2026-10-02", 30_103],
    ]);
  });

  it("lets the first of two equal copies stand for the session and project", () => {
    // pr-old/ sorts before pr/: "-" is below "/"
    for (const folder of ["pr", "pr-old"]) {
      write(configDir, `projects/${folder}/sA.jsonl`, [head("sA"), parentIn("sA")]);
    }
    const data = scanAllProjects();
    expect(Object.keys(data?.projects ?? {})).toEqual(["pr-old"]);
    expect(data?.projects["pr-old"]?.tokens).toBe(20_103);
    expect(data?.stats.sessionsCount).toBe(1);
  });
});

// A line without a sessionId takes its session from the file's path, as in ccusage (a
// copy under the same name is the same session); the expected values are ccusage 20.0.37's.
describe("lines without a sessionId", () => {
  const summary = JSON.stringify({ type: "summary", summary: "t", leafUuid: "u1" });
  const bare = (id: string, output = 100) =>
    JSON.stringify({
      type: "assistant",
      timestamp: "2026-10-01T10:00:00.000Z",
      message: {
        model: "claude-opus-4-8",
        usage: {
          input_tokens: 3,
          output_tokens: output,
          cache_creation_input_tokens: 0,
          cache_read_input_tokens: 1000,
        },
        id,
      },
    }); // 1,103 with the default output
  const write = (file: string, lines: string[], seconds = 0): void => {
    const target = path.join(configDir, "projects", file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, lines.join("\n") + "\n");
    const at = new Date(Date.UTC(2026, 8, 21) + seconds * 1000);
    fs.utimesSync(target, at, at);
  };
  const days = () => scanAllProjects()?.dailyUsage.map((d) => [d.date, d.tokens, d.sessions]);

  it("counts copies under the same name once (P1b)", () => {
    write("pa/j.jsonl", [summary, bare("msg_1")]);
    write("pz/j.jsonl", [summary, bare("msg_1")]);
    expect(days()).toEqual([["2026-10-01", 1_103, 1]]);
  });

  it("counts a renamed copy again, as ccusage does (P1f)", () => {
    write("pa/j.jsonl", [summary, bare("msg_1")]);
    write("pz/j-copy.jsonl", [summary, bare("msg_1")]);
    expect(days()).toEqual([["2026-10-01", 2_206, 1]]);
  });

  it("takes a subagent file's session from its session folder", () => {
    write("pa/s1.jsonl", [summary, bare("msg_1")]);
    write("pa/s1/subagents/agent-a.jsonl", [summary, bare("msg_1")]);
    expect(days()).toEqual([["2026-10-01", 1_103, 1]]);
  });

  it("takes the folder a deeper file sits in, so a reused gateway id counts per folder (D3)", () => {
    // ccusage's keeps_gateway_daily_usage_from_distinct_sessions_with_reused_message_id
    write("p/session-a/chat.jsonl", [bare("ocgo")]);
    write("p/session-b/chat.jsonl", [bare("ocgo", 1)]);
    expect(days()).toEqual([["2026-10-01", 2_107, 2]]);
  });

  it("goes by the first folder named projects, as ccusage does (PT2)", () => {
    const data = path.join(configDir, "projects", "cfg");
    for (const name of ["s1", "s2"]) {
      const target = path.join(data, "projects", "pa", `${name}.jsonl`);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, [summary, bare("msg_1")].join("\n") + "\n");
    }
    vi.stubEnv("CLAUDE_CONFIG_DIR", data);
    expect(days()).toEqual([["2026-10-01", 1_103, 1]]);
  });

  it.skipIf(process.platform === "win32")(
    "keeps a backslash in a file name as part of the name off Windows (BS1)",
    () => {
      // Same content, so one transcript copied: one session, but two path sessions in ccusage
      write("p/a\\b.jsonl", [summary, bare("msg_1")]);
      write("p/a.jsonl", [summary, bare("msg_1")]);
      expect(days()).toEqual([["2026-10-01", 2_206, 1]]);
    }
  );

  it("reads a backslash as a separator on Windows, as Rust's Path does there", () => {
    const platform = Object.getOwnPropertyDescriptor(process, "platform");
    Object.defineProperty(process, "platform", { value: "win32" });
    try {
      write("p/a\\b.jsonl", [summary, bare("msg_1")]);
      write("p/a.jsonl", [summary, bare("msg_1")]);
      expect(days()).toEqual([["2026-10-01", 1_103, 1]]);
    } finally {
      if (platform) Object.defineProperty(process, "platform", platform);
    }
  });

  it("does the same in a one-project scan", () => {
    write("pa/s1.jsonl", [summary, bare("msg_1")]);
    write("pa/s1/subagents/agent-a.jsonl", [summary, bare("msg_1")]);
    const data = scanUsageDataFromPath(path.join(configDir, "projects", "pa"), { days: 0 });
    expect(data?.dailyUsage.map((d) => [d.date, d.tokens])).toEqual([["2026-10-01", 1_103]]);
  });

  it("counts one session for a grown copy that opens with a summary (P2)", () => {
    const line = (req: string, ts: string, u: Record<string, number>, id: string) =>
      JSON.stringify({
        type: "assistant",
        sessionId: "sT",
        requestId: req,
        timestamp: ts,
        message: { model: "claude-opus-4-8", usage: u, id },
      });
    const first = line(
      "req_1",
      "2026-10-01T10:00:00.000Z",
      {
        input_tokens: 3,
        output_tokens: 100,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 1000,
      },
      "msg_1"
    );
    const second = line(
      "req_2",
      "2026-10-01T12:00:00.000Z",
      {
        input_tokens: 5,
        output_tokens: 50,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 2000,
      },
      "msg_2"
    );
    write("pa/t.jsonl", [summary, first]);
    write("pz/t.jsonl", [summary, first, second], 60);
    expect(days()).toEqual([["2026-10-01", 3_158, 1]]);
  });
});

// What the scan reads: the expected values are ccusage 20.0.37's, but for the one difference noted
describe("files the scan reads", () => {
  const usage = (id: string, output: number, session?: string) =>
    JSON.stringify({
      type: "assistant",
      ...(session ? { sessionId: session } : {}),
      timestamp: "2026-10-01T10:00:00.000Z",
      message: {
        model: "claude-opus-4-8",
        usage: {
          input_tokens: 3,
          output_tokens: output,
          cache_creation_input_tokens: 0,
          cache_read_input_tokens: 1000,
        },
        id,
      },
    });
  const write = (file: string, line: string) => {
    const target = path.join(configDir, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, line + "\n");
  };
  const link = (file: string, target: string) => {
    const at = path.join(configDir, file);
    fs.mkdirSync(path.dirname(at), { recursive: true });
    fs.symlinkSync(target, at);
  };
  const days = () => scanAllProjects()?.dailyUsage.map((d) => [d.date, d.tokens]);

  beforeEach(() => {
    write("projects/p/s.jsonl", usage("msg_1", 100, "s")); // 1,103
  });

  it("does not follow a linked file to another transcript (L6)", () => {
    write("projects/q/s2.jsonl", usage("msg_l6", 7)); // 1,010
    link("projects/p/link.jsonl", "../q/s2.jsonl");
    expect(days()).toEqual([["2026-10-01", 2_113]]);
  });

  it("does not follow a linked file out of the data folder (L1)", () => {
    write("store/x.jsonl", usage("msg_l1", 7, "sL1"));
    link("projects/p/link.jsonl", "../../store/x.jsonl");
    expect(days()).toEqual([["2026-10-01", 1_103]]);
  });

  it("does not follow a linked folder inside a project or a linked project folder (L2, L3)", () => {
    write("store/d/y.jsonl", usage("msg_l2", 7, "sL2"));
    link("projects/p/ld", "../../store/d");
    write("store/proj/z.jsonl", usage("msg_l3", 7, "sL3"));
    link("projects/pl", "../store/proj");
    expect(days()).toEqual([["2026-10-01", 1_103]]);
  });

  it("skips a project folder whose name starts with a dot (ccusage reads it: 2,113)", () => {
    write("projects/.hp/a.jsonl", usage("msg_h1", 7, "sH1"));
    expect(days()).toEqual([["2026-10-01", 1_103]]);
  });
});

describe("first and last day", () => {
  it("reports the first day from the days that hold usage, not from a line that moved", () => {
    const parent = { input: 3, output: 100 };
    const event = (ts: string, fields: Record<string, unknown>) =>
      JSON.stringify({ ...JSON.parse(usageLine("p", "claude-opus-4-8", ts, parent)), ...fields });
    // The replay is read first and is the earliest line; the parent's line takes it back
    writeTranscript("p", "a-replay.jsonl", [
      event("2026-10-01T08:00:00.000Z", {
        requestId: "req_replay",
        isSidechain: true,
        agentId: "aside_question-1",
      }),
    ]);
    writeTranscript("p", "s1.jsonl", [event("2026-10-02T10:00:00.000Z", {})]);
    const data = scanAllProjects();
    expect(data?.dailyUsage.map((d) => d.date)).toEqual(["2026-10-02"]);
    expect(data?.stats.firstUsed).toBe("2026-10-02");
    expect(data?.stats.lastUsed).toBe("2026-10-02");
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

  it("counts a session-less file holding a copied usage line as a session, as older CLIs did", () => {
    writeTranscript("p", "s1.jsonl", [
      usageLine("1", "claude-opus-4-8", "2026-10-01T10:00:00.000Z", { input: 1, output: 50 }),
    ]);
    const copy = JSON.parse(
      usageLine("1", "claude-opus-4-8", "2026-10-01T10:00:00.000Z", { input: 1, output: 50 })
    ) as Record<string, unknown>;
    delete copy.sessionId;
    writeTranscript("p", "zz-journal.jsonl", [
      JSON.stringify({ type: "workflow" }),
      JSON.stringify(copy),
    ]);

    const data = scanAllProjects();

    expect(data?.usage.totalTokens).toBe(51);
    expect(data?.stats.sessionsCount).toBe(2);
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
