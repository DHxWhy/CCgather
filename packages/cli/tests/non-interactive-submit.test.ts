/**
 * `ccgather submit` — non-interactive mode
 *
 * A scheduler (cron, Task Scheduler) has no terminal, so this mode must never
 * prompt, must keep a saved token on failure, and must report every outcome
 * through one log line and the exit code.
 *
 * Network and config are fully mocked: no test may reach ccgather.com or the
 * real conf store, which holds the user's API token.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

const mocked = vi.hoisted(() => ({
  home: "",
  store: new Map<string, unknown>(),
  prompt: vi.fn(async (): Promise<Record<string, unknown>> => {
    throw new Error("inquirer.prompt must not be called");
  }),
  ora: vi.fn(),
  readline: vi.fn((): unknown => {
    throw new Error("readline prompt must not be called");
  }),
  auth: vi.fn(async () => undefined),
}));

vi.mock("os", async (importOriginal) => {
  const actual = await importOriginal<typeof import("os")>();
  return { ...actual, homedir: () => mocked.home };
});

vi.mock("../src/lib/config", () => {
  const config = {
    get: (key: string) => mocked.store.get(key),
    set: (key: string, value: unknown) => {
      mocked.store.set(key, value);
    },
    delete: (key: string) => {
      mocked.store.delete(key);
    },
  };
  return {
    getConfig: () => config,
    getApiUrl: () => "https://ccgather.test/api",
    isAuthenticated: () => mocked.store.has("apiToken"),
  };
});

vi.mock("../src/lib/credentials", () => ({
  readCredentials: () => ({
    ccplan: null,
    rateLimitTier: null,
    authMethod: "unknown",
    rawSubscriptionType: null,
  }),
}));

vi.mock("inquirer", () => ({ default: { prompt: mocked.prompt } }));

vi.mock("ora", () => ({ default: mocked.ora }));

// The star nudge asks through readline, not inquirer
vi.mock("readline", async (importOriginal) => {
  const actual = await importOriginal<typeof import("readline")>();
  return { ...actual, createInterface: mocked.readline };
});

vi.mock("../src/commands/auth", () => ({ auth: mocked.auth }));

import { submit } from "../src/commands/submit";

class ExitCalled extends Error {
  constructor(readonly code: number | string | null | undefined) {
    super(`process.exit(${code})`);
  }
}

interface FetchCall {
  url: string;
  init?: RequestInit;
}

type Route = (call: FetchCall) => Response;

const LOG_LINE = /^\[\d{4}-\d{2}-\d{2}T[^\]]+\] ccgather: /;
const INITIAL_LAST_SYNC = "2026-01-01T00:00:00.000Z";

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function usageLine(index: number): string {
  return JSON.stringify({
    type: "assistant",
    sessionId: "demo",
    timestamp: new Date().toISOString(),
    requestId: `req_demo_${index}`,
    message: {
      id: `msg_demo_${index}`,
      model: "claude-sonnet-4-20250514",
      usage: {
        input_tokens: 1000,
        output_tokens: 500,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
      },
    },
  });
}

function setTTY(stream: NodeJS.ReadStream | NodeJS.WriteStream): void {
  Object.defineProperty(stream, "isTTY", { value: true, configurable: true, writable: true });
}

function restoreTTY(
  stream: NodeJS.ReadStream | NodeJS.WriteStream,
  descriptor: PropertyDescriptor | undefined
): void {
  if (descriptor) {
    Object.defineProperty(stream, "isTTY", descriptor);
  } else {
    delete (stream as { isTTY?: boolean }).isTTY;
  }
}

describe("submit({ nonInteractive: true })", () => {
  let projectDir: string;
  let fetchCalls: FetchCall[];
  let routes: { verify: Route; submit: Route };
  let logs: string[];
  let errors: string[];
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let stdoutWrite: ReturnType<typeof vi.spyOn>;
  let stderrWrite: ReturnType<typeof vi.spyOn>;
  let stdoutTTY: PropertyDescriptor | undefined;
  let stdinTTY: PropertyDescriptor | undefined;

  async function runSubmit(options = { nonInteractive: true }): Promise<number> {
    try {
      await submit(options);
      return 0;
    } catch (err) {
      if (err instanceof ExitCalled) return Number(err.code);
      throw err;
    }
  }

  function callsTo(suffix: string): FetchCall[] {
    return fetchCalls.filter((call) => call.url.split("?")[0].endsWith(suffix));
  }

  // Progress bars and '\r' clear-line writes go straight to the streams
  function expectNoStreamWrites(): void {
    expect(stdoutWrite).not.toHaveBeenCalled();
    expect(stderrWrite).not.toHaveBeenCalled();
  }

  function expectSingleError(message: string): void {
    expect(logs).toEqual([]);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(LOG_LINE);
    expect(errors[0]).not.toContain("\u001B");
    expect(errors[0]).toContain(message);
  }

  beforeEach(() => {
    mocked.home = fs.mkdtempSync(path.join(os.tmpdir(), "ccgather-submit-"));
    vi.stubEnv("CLAUDE_CONFIG_DIR", "");
    vi.stubEnv("APPDATA", "");

    projectDir = path.join(mocked.home, ".claude", "projects", "-home-user-demo");
    fs.mkdirSync(projectDir, { recursive: true });
    fs.writeFileSync(
      path.join(projectDir, "session.jsonl"),
      [usageLine(1), usageLine(2)].join("\n") + "\n"
    );

    mocked.store.clear();
    mocked.store.set("apiToken", "test-token");
    mocked.store.set("username", "alice");
    // A returning submitter who has not starred is exactly who the nudge targets
    mocked.store.set("lastSync", INITIAL_LAST_SYNC);

    // Vitest workers have no TTY; force one so the nudge guard can actually fail
    stdoutTTY = Object.getOwnPropertyDescriptor(process.stdout, "isTTY");
    stdinTTY = Object.getOwnPropertyDescriptor(process.stdin, "isTTY");
    setTTY(process.stdout);
    setTTY(process.stdin);

    mocked.prompt.mockClear();
    mocked.readline.mockClear();
    mocked.auth.mockClear();
    mocked.ora.mockReset();
    mocked.ora.mockImplementation(() => {
      const spinner = {
        start: () => spinner,
        stop: () => spinner,
        succeed: () => spinner,
        fail: () => spinner,
      };
      return spinner;
    });

    routes = {
      verify: () => json(200, { userId: "u1", username: "alice", hasStarred: false }),
      submit: () => json(200, { success: true, rank: 7 }),
    };
    fetchCalls = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const call = { url: String(input), init };
        fetchCalls.push(call);
        const pathname = call.url.split("?")[0];
        if (pathname === "https://ccgather.test/api/cli/verify") return routes.verify(call);
        if (pathname === "https://ccgather.test/api/cli/submit") return routes.submit(call);
        if (pathname === "https://ccgather.test/api/cli/submit-attempt") return json(200, {});
        // Anything else (the LiteLLM price list) fails, so the built-in prices are used
        return new Response("blocked in tests", { status: 503 });
      })
    );

    logs = [];
    errors = [];
    vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      logs.push(args.join(" "));
    });
    vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      errors.push(args.join(" "));
    });
    stdoutWrite = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    stderrWrite = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    exitSpy = vi.spyOn(process, "exit").mockImplementation((code) => {
      throw new ExitCalled(code);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    restoreTTY(process.stdout, stdoutTTY);
    restoreTTY(process.stdin, stdinTTY);
    fs.rmSync(mocked.home, { recursive: true, force: true });
  });

  it("submits without prompting, prints one result line and exits 0", async () => {
    const code = await runSubmit();

    expect(code).toBe(0);
    expect(exitSpy).not.toHaveBeenCalled();
    expect(mocked.prompt).not.toHaveBeenCalled();
    expect(mocked.readline).not.toHaveBeenCalled();
    expect(mocked.ora).not.toHaveBeenCalled();
    expectNoStreamWrites();

    expect(errors).toEqual([]);
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatch(LOG_LINE);
    expect(logs[0]).toMatch(
      /ccgather: Submitted 3\.00K tokens \(\$[\d.]+\) as alice, global rank #7\.$/
    );
    // Log files must not carry ANSI colour or OSC 8 hyperlink sequences
    expect(logs[0]).not.toContain("\u001B");

    const [submitCall] = callsTo("/cli/submit");
    const body = JSON.parse(String(submitCall.init?.body));
    expect(body.totalTokens).toBe(3000);
    expect(mocked.store.get("lastSync")).not.toBe(INITIAL_LAST_SYNC);
  });

  it("exits 1 without prompting or calling the server when no token is saved", async () => {
    mocked.store.delete("apiToken");

    const code = await runSubmit();

    expect(code).toBe(1);
    expect(mocked.prompt).not.toHaveBeenCalled();
    expect(mocked.auth).not.toHaveBeenCalled();
    expect(callsTo("/cli/verify")).toHaveLength(0);
    expect(callsTo("/cli/submit")).toHaveLength(0);
    expectNoStreamWrites();
    expectSingleError("Not logged in. Run `npx ccgather` to log in.");
  });

  it.each([401, 403])(
    "exits 1 on a refused token (HTTP %i) and keeps the saved token",
    async (status) => {
      routes.verify = () => json(status, { error: "Invalid API token" });

      const code = await runSubmit();

      expect(code).toBe(1);
      expect(mocked.prompt).not.toHaveBeenCalled();
      expect(mocked.auth).not.toHaveBeenCalled();
      expect(callsTo("/cli/submit")).toHaveLength(0);
      expectNoStreamWrites();
      expectSingleError(
        `Authentication refused by server (HTTP ${status}). If this keeps happening, run \`npx ccgather\` to log in again.`
      );
      expect(mocked.store.get("apiToken")).toBe("test-token");
      expect(mocked.store.get("username")).toBe("alice");
    }
  );

  it("exits 1 on a server error during verification and keeps the saved token", async () => {
    routes.verify = () => json(500, { error: "Internal server error" });

    const code = await runSubmit();

    expect(code).toBe(1);
    expect(mocked.prompt).not.toHaveBeenCalled();
    expectNoStreamWrites();
    expectSingleError("Could not verify authentication (HTTP 500). Try again later.");
    expect(mocked.store.get("apiToken")).toBe("test-token");
  });

  it("exits 1 on a network error during verification and keeps the saved token", async () => {
    routes.verify = () => {
      throw new TypeError("fetch failed");
    };

    const code = await runSubmit();

    expect(code).toBe(1);
    expectNoStreamWrites();
    expectSingleError("Could not verify authentication (fetch failed). Try again later.");
    expect(mocked.store.get("apiToken")).toBe("test-token");
  });

  it("exits 1 with the retry time when the submission is rate limited", async () => {
    routes.submit = () =>
      json(429, { error: "Rate limit exceeded", retryAfterMinutes: 25, hint: "later" });

    const code = await runSubmit();

    expect(code).toBe(1);
    expect(mocked.prompt).not.toHaveBeenCalled();
    expectNoStreamWrites();
    expectSingleError("Submission limit reached. Try again in 25 minute(s).");
    expect(mocked.store.get("lastSync")).toBe(INITIAL_LAST_SYNC);
  });

  it("exits 1 when the server rejects the submission", async () => {
    routes.submit = () => json(503, { error: "Service unavailable" });

    const code = await runSubmit();

    expect(code).toBe(1);
    expectNoStreamWrites();
    expectSingleError("Failed to submit: Service unavailable.");
  });

  it("exits 1 on a network error during submission and keeps the saved token", async () => {
    routes.submit = () => {
      throw new TypeError("fetch failed");
    };

    const code = await runSubmit();

    expect(code).toBe(1);
    expectNoStreamWrites();
    expectSingleError("Failed to submit: fetch failed.");
    expect(mocked.store.get("apiToken")).toBe("test-token");
    expect(mocked.store.get("lastSync")).toBe(INITIAL_LAST_SYNC);
  });

  it("exits 1 when there are no Claude Code sessions", async () => {
    fs.rmSync(path.join(mocked.home, ".claude"), { recursive: true, force: true });

    const code = await runSubmit();

    expect(code).toBe(1);
    expect(callsTo("/cli/submit")).toHaveLength(0);
    expectNoStreamWrites();
    expectSingleError("No Claude Code sessions found");
  });

  it("exits 1 when the sessions hold no usage data", async () => {
    fs.writeFileSync(
      path.join(projectDir, "session.jsonl"),
      JSON.stringify({
        type: "user",
        sessionId: "demo",
        timestamp: new Date().toISOString(),
        message: { role: "user", content: "hello" },
      }) + "\n"
    );

    const code = await runSubmit();

    expect(code).toBe(1);
    expect(callsTo("/cli/submit")).toHaveLength(0);
    expect(callsTo("/cli/submit-attempt")).toHaveLength(1);
    expectNoStreamWrites();
    expectSingleError("No usage data found");
  });

  // Controls: the interactive path with the same TTY and user state still
  // prompts, so the assertions above are not passing vacuously
  it("interactive mode still prompts and clears a rejected token", async () => {
    routes.verify = () => json(401, { error: "Invalid API token" });
    mocked.prompt.mockResolvedValueOnce({ startAuth: false });

    const code = await runSubmit({ nonInteractive: false });

    expect(code).toBe(0);
    expect(mocked.prompt).toHaveBeenCalledTimes(1);
    expect(mocked.ora).toHaveBeenCalled();
    expect(mocked.store.has("apiToken")).toBe(false);
  });

  it("interactive mode still reaches the star nudge", async () => {
    mocked.readline.mockImplementationOnce(() => ({
      on: () => {},
      close: () => {},
      question: (_question: string, callback: (answer: string) => void) => callback("n"),
    }));

    const code = await runSubmit({ nonInteractive: false });

    expect(code).toBe(0);
    expect(mocked.readline).toHaveBeenCalledTimes(1);
    expect(mocked.store.get("starDeclineCount")).toBe(1);
  });
});
