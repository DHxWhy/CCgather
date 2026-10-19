/**
 * Transcript streaming guard
 *
 * Node cannot hold a string over buffer.constants.MAX_STRING_LENGTH (~512 MiB),
 * so reading a whole transcript with readFileSync threw ERR_STRING_TOO_LONG
 * inside the per-file catch and the largest sessions were silently left out of
 * every submit (2026-10-17: five files, 16.9B tokens on one machine).
 *
 * Transcripts are now read in byte chunks. Only lines that can hold usage are
 * decoded, plus the first lines for the session hash — whose input must stay
 * exactly what content.split("\n") gave, because the server keeps those hashes.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as crypto from "crypto";
import * as path from "path";

const mocked = vi.hoisted(() => ({ home: "" }));

vi.mock("fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("fs")>();
  return {
    ...actual,
    readSync: vi.fn(actual.readSync),
    readFileSync: vi.fn(actual.readFileSync),
  };
});

vi.mock("os", async (importOriginal) => {
  const actual = await importOriginal<typeof import("os")>();
  return { ...actual, homedir: () => mocked.home };
});

vi.mock("../src/lib/credentials", () => ({
  readCredentials: () => ({
    ccplan: null,
    rateLimitTier: null,
    authMethod: "unknown",
    rawSubscriptionType: null,
  }),
}));

import * as fs from "fs";
import * as os from "os";
import { readTranscriptLines, scanAllProjects } from "../src/lib/ccgather-json";

const USAGE_KEY = '"usage"';
const CHUNK_SIZES = [1, 2, 3, 5, 7, 8, 64, 1024, 1 << 20];

function usageEvent(id: string, inputTokens: number, pad = ""): string {
  return JSON.stringify({
    type: "assistant",
    sessionId: "stream",
    timestamp: "2026-10-17T10:00:00.000Z",
    requestId: `req_${id}`,
    message: {
      id: `msg_${id}`,
      model: "claude-sonnet-4-20250514",
      usage: { input_tokens: inputTokens, output_tokens: 0 },
      content: pad,
    },
  });
}

// Every shape a transcript line takes: usage events, prose with multi-byte
// characters, blank and whitespace-only lines, the key inside quoted text,
// a broken line, a CRLF line, and an assistant line without usage.
const FIXTURE_LINES = [
  usageEvent("a", 10),
  JSON.stringify({ type: "user", message: { content: "한글과 😀 — 사용량 없음" } }),
  "",
  usageEvent("b", 20, "한".repeat(3000)),
  "   ",
  JSON.stringify({ type: "user", message: { content: 'the word "usage" in prose' } }),
  'broken {"usage": ',
  usageEvent("c", 30) + "\r",
  JSON.stringify({ type: "assistant", message: { id: "msg_none" } }),
];

// Frozen v2.1.0 contract (literal on purpose): filename + first 50 raw lines.
function publishedSessionHash(fileName: string, content: string): string {
  const lines = content.split("\n").slice(0, 50).join("\n");
  return crypto.createHash("sha256").update(`${fileName}:${lines}`).digest("hex");
}

describe("readTranscriptLines", () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "ccgather-stream-"));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  function writeFixture(name: string, content: string): string {
    const file = path.join(dir, name);
    fs.writeFileSync(file, content);
    return file;
  }

  it("hands over exactly the non-blank lines that can hold usage, byte for byte, at every chunk size", () => {
    const content = FIXTURE_LINES.join("\n") + "\n";
    const file = writeFixture("mixed.jsonl", content);
    const expected = content.split("\n").filter((line) => line.trim() && line.includes(USAGE_KEY));
    // a, b, the broken line and c — JSON escapes the quotes inside prose, so that line is out
    expect(expected).toHaveLength(4);

    for (const chunkBytes of CHUNK_SIZES) {
      const got: string[] = [];
      readTranscriptLines(file, { onLine: (line) => got.push(line), chunkBytes });
      expect(got, `chunkBytes=${chunkBytes}`).toEqual(expected);
    }
  });

  it("returns the first lines exactly as content.split('\\n') gives them", () => {
    const line = (i: number) => usageEvent(`h${i}`, i);
    const many = (count: number) => Array.from({ length: count }, (_, i) => line(i));
    const contents: Record<string, string> = {
      empty: "",
      "one-no-newline": line(0),
      "one-newline": line(0) + "\n",
      "two-no-newline": `${line(0)}\n${line(1)}`,
      "blank-inside": `${line(0)}\n\n${line(1)}\n`,
      crlf: many(4).join("\r\n") + "\r\n",
      "49": many(49).join("\n") + "\n",
      "50": many(50).join("\n") + "\n",
      "51-no-newline": many(51).join("\n"),
      "120": many(120).join("\n") + "\n",
    };

    for (const [name, content] of Object.entries(contents)) {
      const file = writeFixture(`${name}.jsonl`, content);
      for (const chunkBytes of [1, 7, 4096]) {
        const head = readTranscriptLines(file, { headLines: 50, chunkBytes });
        expect(head, `${name} chunkBytes=${chunkBytes}`).toEqual(content.split("\n").slice(0, 50));
      }
    }
  });

  it("stops reading once the head is complete when no line handler is given", () => {
    const content =
      Array.from({ length: 2000 }, (_, i) => usageEvent(`s${i}`, i)).join("\n") + "\n";
    const file = writeFixture("long.jsonl", content);
    expect(fs.statSync(file).size).toBeGreaterThan(200 * 1024);

    vi.mocked(fs.readSync).mockClear();
    const head = readTranscriptLines(file, { headLines: 3, chunkBytes: 4096 });

    expect(head).toEqual(content.split("\n").slice(0, 3));
    expect(vi.mocked(fs.readSync)).toHaveBeenCalledTimes(1);
  });
});

describe("scanAllProjects: streamed transcripts", () => {
  let projectDir: string;

  beforeEach(() => {
    mocked.home = fs.mkdtempSync(path.join(os.tmpdir(), "ccgather-stream-scan-"));
    vi.stubEnv("CLAUDE_CONFIG_DIR", "");
    vi.stubEnv("APPDATA", "");
    projectDir = path.join(mocked.home, ".claude", "projects", "-home-user-demo");
    fs.mkdirSync(projectDir, { recursive: true });
    vi.mocked(fs.readFileSync).mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    fs.rmSync(mocked.home, { recursive: true, force: true });
  });

  it("counts every usage event of a transcript larger than the read chunk", () => {
    // ~6 KB lines of 3-byte characters: read boundaries fall inside characters
    const lineCount = 1800;
    const lines = Array.from({ length: lineCount }, (_, i) =>
      usageEvent(`big${i}`, 1000 + i, "한".repeat(2000))
    );
    const content = lines.join("\n") + "\n";
    fs.writeFileSync(path.join(projectDir, "big.jsonl"), content);
    expect(fs.statSync(path.join(projectDir, "big.jsonl")).size).toBeGreaterThan(10 * 1024 * 1024);

    const data = scanAllProjects();

    const expectedTokens = lines.reduce((sum, _line, i) => sum + 1000 + i, 0);
    expect(data?.usage.totalTokens).toBe(expectedTokens);
    expect(data?.usage.inputTokens).toBe(expectedTokens);
    expect(data?.stats.sessionsCount).toBe(1);
    expect(data?.sessionFingerprint?.sessionHashes).toEqual([
      publishedSessionHash("big.jsonl", content),
    ]);

    const wholeReads = vi
      .mocked(fs.readFileSync)
      .mock.calls.filter(([target]) => String(target).endsWith(".jsonl"));
    expect(wholeReads).toEqual([]);
  });
});
