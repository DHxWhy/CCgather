/**
 * scanAllProjects — session fingerprint guard
 *
 * The progress bar reports per-file progress, so everything expensive must
 * happen inside that loop. A second full read of every session file after the
 * bar hit 100% left the CLI silent for ~55s on ~2,500 sessions.
 *
 * The server stores sessionHashes for duplicate prevention, so the values must
 * stay byte-identical to what v2.1.0 shipped.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as crypto from "crypto";
import * as path from "path";

const mocked = vi.hoisted(() => ({ home: "" }));

vi.mock("fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("fs")>();
  return { ...actual, readFileSync: vi.fn(actual.readFileSync) };
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
import { scanAllProjects } from "../src/lib/ccgather-json";

// Frozen v2.1.0 contract (literal on purpose): filename + first 50 raw lines.
function publishedSessionHash(fileName: string, content: string): string {
  const lines = content.split("\n").slice(0, 50).join("\n");
  return crypto.createHash("sha256").update(`${fileName}:${lines}`).digest("hex");
}

function usageLine(sessionId: string, index: number): string {
  return JSON.stringify({
    type: "assistant",
    sessionId,
    timestamp: `2026-09-0${(index % 9) + 1}T10:00:00.000Z`,
    requestId: `req_${sessionId}_${index}`,
    message: {
      id: `msg_${sessionId}_${index}`,
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

function sessionLines(sessionId: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => usageLine(sessionId, i));
}

describe("scanAllProjects: session fingerprint", () => {
  let projectDir: string;
  let sessions: Record<string, string>;

  beforeEach(() => {
    mocked.home = fs.mkdtempSync(path.join(os.tmpdir(), "ccgather-scan-"));
    vi.stubEnv("CLAUDE_CONFIG_DIR", "");
    vi.stubEnv("APPDATA", "");

    projectDir = path.join(mocked.home, ".claude", "projects", "-home-user-demo");
    fs.mkdirSync(projectDir, { recursive: true });

    // Blank line inside the first 50 lines: the hash covers raw lines, not filtered ones
    const longLines = sessionLines("long", 120);
    longLines.splice(10, 0, "");

    sessions = {
      "short.jsonl": sessionLines("short", 3).join("\n") + "\n",
      "long.jsonl": longLines.join("\n") + "\n",
      "crlf.jsonl": sessionLines("crlf", 4).join("\r\n") + "\r\n",
      "empty.jsonl": "",
    };
    for (const [name, content] of Object.entries(sessions)) {
      fs.writeFileSync(path.join(projectDir, name), content);
    }

    vi.mocked(fs.readFileSync).mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    fs.rmSync(mocked.home, { recursive: true, force: true });
  });

  it("keeps session hashes byte-identical to the published algorithm", () => {
    const data = scanAllProjects();

    const expected = Object.entries(sessions)
      .map(([name, content]) => publishedSessionHash(name, content))
      .sort();

    expect(data?.sessionFingerprint?.sessionHashes).toEqual(expected);
    expect(data?.sessionFingerprint?.sessionCount).toBe(expected.length);
    expect(data?.sessionFingerprint?.combinedHash).toBe(
      crypto.createHash("sha256").update(expected.join(":")).digest("hex")
    );
  });

  it("reads each session file exactly once", () => {
    const progress: Array<[number, number]> = [];
    scanAllProjects({ onProgress: (current, total) => progress.push([current, total]) });

    const reads = new Map<string, number>();
    for (const [target] of vi.mocked(fs.readFileSync).mock.calls) {
      const file = path.basename(String(target));
      if (file.endsWith(".jsonl")) reads.set(file, (reads.get(file) ?? 0) + 1);
    }

    const sessionCount = Object.keys(sessions).length;
    expect(Object.fromEntries(reads)).toEqual(
      Object.fromEntries(Object.keys(sessions).map((name) => [name, 1]))
    );
    expect(progress.at(-1)).toEqual([sessionCount, sessionCount]);
  });
});
