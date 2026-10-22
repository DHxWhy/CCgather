import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

// On Windows readdir reports every reparse point as a link, cloud placeholders (OneDrive's,
// say) included, while lstat still sees a plain file. This file fakes that: an entry named
// placeholder.jsonl comes back as a link, and the folder holding it also lists gone.jsonl, a
// link that is no longer there when it is checked.
const mocked = vi.hoisted(() => ({ home: "" }));

vi.mock("os", async (importOriginal) => {
  const actual = await importOriginal<typeof import("os")>();
  return { ...actual, homedir: () => mocked.home };
});

vi.mock("fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("fs")>();
  const asLink = (entry: fs.Dirent, name = entry.name): fs.Dirent =>
    Object.assign(Object.create(Object.getPrototypeOf(entry) as object) as fs.Dirent, entry, {
      name,
      isFile: () => false,
      isDirectory: () => false,
      isSymbolicLink: () => true,
    });
  const readdirSync = (dir: fs.PathLike, options?: unknown): unknown => {
    const entries = actual.readdirSync(dir, options as never) as unknown;
    if (typeof options !== "object" || options === null || !("withFileTypes" in options)) {
      return entries;
    }
    const listed = entries as fs.Dirent[];
    const placeholder = listed.find((e) => e.name === "placeholder.jsonl");
    if (!placeholder) return listed;
    // The vanished link comes first, so a failure on it would drop the rest of the folder
    return [
      asLink(placeholder, "gone.jsonl"),
      ...listed.map((e) => (e === placeholder ? asLink(e) : e)),
    ];
  };
  const patched = readdirSync as unknown as typeof actual.readdirSync;
  return { ...actual, default: { ...actual, readdirSync: patched }, readdirSync: patched };
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

let configDir: string;

const usage = (id: string, output: number, session: string) =>
  JSON.stringify({
    type: "assistant",
    sessionId: session,
    requestId: `req_${id}`,
    timestamp: "2026-10-01T05:00:00.000Z",
    message: {
      id: `msg_${id}`,
      model: "claude-opus-4-8",
      usage: {
        input_tokens: 3,
        output_tokens: output,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 1000,
      },
    },
  });

beforeEach(() => {
  mocked.home = fs.mkdtempSync(path.join(os.tmpdir(), "ccgather-reparse-home-"));
  configDir = fs.mkdtempSync(path.join(os.tmpdir(), "ccgather-reparse-"));
  vi.stubEnv("CLAUDE_CONFIG_DIR", configDir);
  vi.stubEnv("APPDATA", "");
  vi.stubEnv("XDG_CONFIG_HOME", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
  fs.rmSync(mocked.home, { recursive: true, force: true });
  fs.rmSync(configDir, { recursive: true, force: true });
});

describe("Windows reparse points, which readdir reports as links", () => {
  it("reads a cloud placeholder reported as a link, and skips a link that is gone", () => {
    const project = path.join(configDir, "projects", "p");
    fs.mkdirSync(project, { recursive: true });
    fs.writeFileSync(path.join(project, "s.jsonl"), usage("1", 100, "s1") + "\n");
    fs.writeFileSync(path.join(project, "placeholder.jsonl"), usage("2", 7, "s2") + "\n");
    // 1,103 + 1,010: both files, and nothing lost to the link that is gone
    expect(scanAllProjects()?.dailyUsage.map((d) => [d.date, d.tokens])).toEqual([
      ["2026-10-01", 2_113],
    ]);
  });
});
