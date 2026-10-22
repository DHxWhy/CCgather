/**
 * scanAllProjects — subagent transcripts
 *
 * Claude Code writes each subagent's transcript to its own file under
 * <session>/subagents/ (workflow subagents one level deeper, in
 * workflows/<run>/), and every line carries the parent session's sessionId plus
 * the subagent's agentId. Deduplicating files by sessionId alone collapsed a
 * session and all of its subagents into one file and dropped the subagents'
 * usage. agentId is not unique either: a workflow's subagent can reuse the
 * agentId of an ordinary subagent in the same session.
 */

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

import { scanAllProjects } from "../src/lib/ccgather-json";

const SESSION = "0b6f3d1e-5a2c-4c8e-9f10-2d7b8a4e6c31";
const TOKENS_PER_MESSAGE = 150; // 100 input + 50 output

function usageLine(messageId: string, agentId?: string): string {
  return JSON.stringify({
    type: "assistant",
    sessionId: SESSION,
    ...(agentId && { agentId, isSidechain: true }),
    timestamp: "2026-09-01T10:00:00.000Z",
    requestId: `req_${messageId}`,
    message: {
      id: messageId,
      model: "claude-sonnet-4-20250514",
      usage: {
        input_tokens: 100,
        output_tokens: 50,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
      },
    },
  });
}

// A subagent transcript opens with its task prompt. A long prompt pushes
// sessionId and agentId past the first 4 KB of the file.
function promptLine(agentId: string, prompt: string): string {
  return JSON.stringify({
    type: "user",
    message: { role: "user", content: prompt },
    sessionId: SESSION,
    agentId,
    isSidechain: true,
  });
}

// A forked subagent's transcript opens with a reference to its parent's
// context. That line names the session as parentSessionId; sessionId only
// appears from the second line on.
function forkContextRefLine(agentId: string): string {
  return JSON.stringify({
    type: "fork-context-ref",
    agentId,
    parentSessionId: SESSION,
    parentLastUuid: "5c1d9e7a-3b42-4f6a-8d05-9e2f7c1a4b68",
    contextLength: 48213,
  });
}

const MAIN = `${SESSION}.jsonl`;
const transcripts: Record<string, string> = {
  [MAIN]: [usageLine("msg_main_1"), usageLine("msg_main_2")].join("\n") + "\n",
  [`${SESSION}/subagents/agent-a1.jsonl`]:
    [
      promptLine("a1", "Investigate the failing build. ".repeat(200)),
      usageLine("msg_a1_1", "a1"),
      usageLine("msg_a1_2", "a1"),
    ].join("\n") + "\n",
  [`${SESSION}/subagents/agent-b2.jsonl`]:
    [promptLine("b2", "Run the tests."), usageLine("msg_b2_1", "b2")].join("\n") + "\n",
  // A workflow subagent reusing the agentId of agent-a1 above.
  [`${SESSION}/subagents/workflows/wf_1/agent-a1.jsonl`]:
    [promptLine("a1", "Review the release notes."), usageLine("msg_wf_a1_1", "a1")].join("\n") +
    "\n",
};
const TRANSCRIPT_FILES = Object.keys(transcripts).length;
const EXPECTED_TOKENS = 6 * TOKENS_PER_MESSAGE;

// The main transcript is written last, as it is in a real session.
function writeProject(
  projectsDir: string,
  projectName: string,
  files: Record<string, string>,
  mainWrittenAt: Date
) {
  const subagentWrittenAt = new Date(mainWrittenAt.getTime() - 60_000);
  for (const [relativePath, content] of Object.entries(files)) {
    const filePath = path.join(projectsDir, projectName, relativePath);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content);
    const writtenAt = relativePath === MAIN ? mainWrittenAt : subagentWrittenAt;
    fs.utimesSync(filePath, writtenAt, writtenAt);
  }
}

describe("scanAllProjects: subagent transcripts", () => {
  let projectsDir: string;

  beforeEach(() => {
    mocked.home = fs.mkdtempSync(path.join(os.tmpdir(), "ccgather-subagents-"));
    vi.stubEnv("CLAUDE_CONFIG_DIR", "");
    vi.stubEnv("APPDATA", "");
    vi.stubEnv("XDG_CONFIG_HOME", "");

    projectsDir = path.join(mocked.home, ".claude", "projects");
    writeProject(projectsDir, "-home-user-demo", transcripts, new Date("2026-09-01T11:00:00.000Z"));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    fs.rmSync(mocked.home, { recursive: true, force: true });
  });

  it("counts usage from every subagent transcript, including a reused agentId", () => {
    const data = scanAllProjects();

    expect(data?.usage.totalTokens).toBe(EXPECTED_TOKENS);
    expect(data?.sessionFingerprint?.sessionCount).toBe(TRANSCRIPT_FILES);
  });

  it("counts a session once across its main and subagent transcripts", () => {
    const data = scanAllProjects();

    expect(data?.stats.sessionsCount).toBe(1);
    expect(data?.dailyUsage.map((day) => day.sessions)).toEqual([1]);
    expect(data?.projects["-home-user-demo"].sessions).toBe(1);
  });

  it("still skips copies of a transcript in another project directory", () => {
    // Same transcripts copied by an OS path migration, with older timestamps so
    // the originals are the copies that are kept.
    writeProject(
      projectsDir,
      "-mnt-c-home-user-demo",
      transcripts,
      new Date("2026-01-01T00:00:00.000Z")
    );

    const data = scanAllProjects();

    expect(data?.usage.totalTokens).toBe(EXPECTED_TOKENS);
    expect(data?.sessionFingerprint?.sessionCount).toBe(TRANSCRIPT_FILES);
    expect(data?.stats.sessionsCount).toBe(1);
    expect(Object.keys(data?.projects ?? {})).toEqual(["-home-user-demo"]);
  });

  it("counts a forked subagent under its parent session", () => {
    writeProject(
      projectsDir,
      "-home-user-demo",
      {
        [`${SESSION}/subagents/agent-f3.jsonl`]:
          [forkContextRefLine("f3"), usageLine("msg_f3_1", "f3")].join("\n") + "\n",
      },
      new Date("2026-09-01T11:00:00.000Z")
    );

    const data = scanAllProjects();

    expect(data?.usage.totalTokens).toBe(EXPECTED_TOKENS + TOKENS_PER_MESSAGE);
    expect(data?.sessionFingerprint?.sessionCount).toBe(TRANSCRIPT_FILES + 1);
    expect(data?.stats.sessionsCount).toBe(1);
    expect(data?.dailyUsage.map((day) => day.sessions)).toEqual([1]);
    expect(data?.projects["-home-user-demo"].sessions).toBe(1);
  });

  // A workflow run leaves a journal of bookkeeping records: no sessionId, no usage.
  it.each([
    [
      "launched",
      [
        { type: "launched" },
        { type: "started", agentId: "a1", key: "review" },
        { type: "result", key: "review", result: "ok" },
      ],
    ],
    [
      "started",
      [
        { type: "started", agentId: "a2", key: "review" },
        { type: "result", key: "review", result: "ok" },
      ],
    ],
  ])("does not count a workflow journal that opens with %s as a session", (_name, records) => {
    writeProject(
      projectsDir,
      "-home-user-demo",
      {
        [`${SESSION}/subagents/workflows/wf_1/journal.jsonl`]:
          records.map((record) => JSON.stringify(record)).join("\n") + "\n",
      },
      new Date("2026-09-01T11:00:00.000Z")
    );

    const data = scanAllProjects();

    expect(data?.usage.totalTokens).toBe(EXPECTED_TOKENS);
    expect(data?.sessionFingerprint?.sessionCount).toBe(TRANSCRIPT_FILES + 1);
    expect(data?.stats.sessionsCount).toBe(1);
    expect(data?.dailyUsage.map((day) => day.sessions)).toEqual([1]);
    expect(data?.projects["-home-user-demo"].sessions).toBe(1);
  });

  it("counts a transcript with usage but no sessionId on its first line as a session", () => {
    writeProject(
      projectsDir,
      "-home-user-demo",
      {
        "legacy.jsonl":
          [
            JSON.stringify({ type: "summary", summary: "Earlier work", leafUuid: "leaf-1" }),
            usageLine("msg_legacy_1"),
          ].join("\n") + "\n",
      },
      new Date("2026-09-01T11:00:00.000Z")
    );

    const data = scanAllProjects();

    expect(data?.usage.totalTokens).toBe(EXPECTED_TOKENS + TOKENS_PER_MESSAGE);
    expect(data?.stats.sessionsCount).toBe(2);
    expect(data?.projects["-home-user-demo"].sessions).toBe(2);
  });

  it("counts a transcript that names its session but holds no usage as a session", () => {
    const quietSession = "7e4a9c20-1b8d-4f35-a6c2-93d0e5b17f48";
    writeProject(
      projectsDir,
      "-home-user-demo",
      {
        [`${quietSession}.jsonl`]:
          JSON.stringify({
            type: "user",
            sessionId: quietSession,
            message: { role: "user", content: "Hello" },
          }) + "\n",
      },
      new Date("2026-09-01T11:00:00.000Z")
    );

    const data = scanAllProjects();

    expect(data?.usage.totalTokens).toBe(EXPECTED_TOKENS);
    expect(data?.stats.sessionsCount).toBe(2);
    expect(data?.projects["-home-user-demo"].sessions).toBe(2);
  });
});
