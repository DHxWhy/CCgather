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
import type { CredentialsData } from "../src/lib/credentials";

const mocked = vi.hoisted(() => ({
  home: "",
  store: new Map<string, unknown>(),
  prompt: vi.fn(async (_questions?: unknown): Promise<Record<string, unknown>> => {
    throw new Error("inquirer.prompt must not be called");
  }),
  ora: vi.fn(),
  readline: vi.fn((): unknown => {
    throw new Error("readline prompt must not be called");
  }),
  auth: vi.fn(async () => undefined),
  readCredentials: vi.fn((): CredentialsData => ({
    ccplan: null,
    rateLimitTier: null,
    authMethod: "unknown",
    rawSubscriptionType: null,
  })),
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
  readCredentials: mocked.readCredentials,
}));

vi.mock("inquirer", () => ({ default: { prompt: mocked.prompt } }));

vi.mock("ora", () => ({ default: mocked.ora }));

// The star nudge asks through readline, not inquirer
vi.mock("readline", async (importOriginal) => {
  const actual = await importOriginal<typeof import("readline")>();
  return { ...actual, createInterface: mocked.readline };
});

vi.mock("../src/commands/auth", () => ({ auth: mocked.auth }));

import {
  COUNTING_NOTICE,
  DUPLICATE_SESSION_ADVICE,
  formatAgo,
  otherFoldersQuestion,
  SHELL_FOLDER_ADVICE,
  submit,
  SubmitOptions,
  unconfirmedFoldersHint,
} from "../src/commands/submit";
import { savedShellDirsNotice } from "../src/lib/claude-dirs";

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

function usageLine(index: number, timestamp: string = new Date().toISOString()): string {
  return JSON.stringify({
    type: "assistant",
    sessionId: "demo",
    timestamp,
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

// The wording is written out here: the other tests build their expectation from these
describe("folder wording", () => {
  it("asks about one folder as it and about several as them", () => {
    const why = "(CCgather treats one computer as one person; a session found twice counts once)";
    expect(otherFoldersQuestion(1)).toBe(
      `Another Claude Code data folder found on this computer. Count it too? ${why}`
    );
    expect(otherFoldersQuestion(2)).toBe(
      `Other Claude Code data folders found on this computer. Count them too? ${why}`
    );
  });

  it("counts the folders waiting for an answer in the no-sessions hint", () => {
    expect(unconfirmedFoldersHint(1)).toBe(
      "1 other data folder found; run `npx ccgather` once to choose it."
    );
    expect(unconfirmedFoldersHint(3)).toBe(
      "3 other data folders found; run `npx ccgather` once to choose them."
    );
  });

  it("tells how to leave out a folder that belongs to another account", () => {
    expect(DUPLICATE_SESSION_ADVICE).toBe(
      "If a data folder you added belongs to another CCgather account, choose folders again and uncheck it: npx ccgather > Settings > Data folders."
    );
    expect(SHELL_FOLDER_ADVICE).toBe(
      "Folders named in CLAUDE_CONFIG_DIR are always counted, so do this in a terminal without it."
    );
  });
});

describe("submit({ nonInteractive: true })", () => {
  let projectDir: string;
  let fetchCalls: FetchCall[];
  let routes: { verify: Route; submit: Route };
  let logs: string[];
  let errors: string[];
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let stdoutWrite: ReturnType<typeof vi.spyOn>;
  let stderrWrite: ReturnType<typeof vi.spyOn>;
  let timeoutSpy: ReturnType<typeof vi.spyOn>;
  let timeoutControllers: Map<AbortSignal, AbortController>;
  let stdoutTTY: PropertyDescriptor | undefined;
  let stdinTTY: PropertyDescriptor | undefined;

  async function runSubmit(options: SubmitOptions = { nonInteractive: true }): Promise<number> {
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

  // What real fetch does when the request's AbortSignal.timeout fires: the signal
  // aborts with a TimeoutError and the pending fetch rejects with that reason
  function stall(call: FetchCall): never {
    const signal = call.init?.signal;
    if (!signal) throw new Error(`${call.url} carries no timeout signal`);
    timeoutControllers
      .get(signal)
      ?.abort(new DOMException("The operation was aborted due to timeout", "TimeoutError"));
    throw signal.reason;
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
    vi.stubEnv("XDG_CONFIG_HOME", "");

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

    // AbortSignal.timeout runs on Node's own timer, which fake timers do not
    // advance, so hand out signals the test fires itself
    timeoutControllers = new Map();
    timeoutSpy = vi.spyOn(AbortSignal, "timeout").mockImplementation(() => {
      const controller = new AbortController();
      timeoutControllers.set(controller.signal, controller);
      return controller.signal;
    });

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
    // A plain non-interactive run is not the autosubmit job
    expect(body).not.toHaveProperty("scheduled");
    expect(body).toHaveProperty("ccplan", null);
    expect(body.authMethod).toBe("unknown");
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

  it("points to Data folders when another account owns sessions from an added folder", async () => {
    const duplicate = () =>
      json(409, {
        error: "These sessions have already been submitted by another account.",
        hint: "Each project's data can only be submitted by one account (1 Project 1 Person).",
        code: "DUPLICATE_SESSION",
      });
    routes.submit = duplicate;
    mocked.store.set("claudeDirs", [path.join(mocked.home, ".claude-work")]);

    expect(await runSubmit()).toBe(1);

    expectSingleError(
      `Failed to submit: These sessions have already been submitted by another account. ${DUPLICATE_SESSION_ADVICE}`
    );
    expect(errors[0]).not.toContain(SHELL_FOLDER_ADVICE);
  });

  it("on an interactive submit, shows the server's hint and the folder advice, not the counting notice", async () => {
    routes.submit = () =>
      json(409, {
        error: "These sessions have already been submitted by another account.",
        hint: "Each project's data can only be submitted by one account (1 Project 1 Person).",
        code: "DUPLICATE_SESSION",
      });
    mocked.store.set("claudeDirs", [path.join(mocked.home, ".claude-work")]);
    mocked.store.set("starConfirmed", true);

    expect(await runSubmit({ nonInteractive: false })).toBe(1);

    const text = logs.join("\n");
    expect(text).toContain("These sessions have already been submitted by another account.");
    expect(text).toContain(
      "Each project's data can only be submitted by one account (1 Project 1 Person)."
    );
    expect(text).toContain(DUPLICATE_SESSION_ADVICE);
    expect(text).not.toContain(COUNTING_NOTICE);
    expect(mocked.store.has("countingNoticeShown")).toBe(false);
  });

  it("gives the folder advice only for sessions another account owns", async () => {
    routes.submit = () =>
      json(503, {
        error: "Could not verify session ownership. Please try again.",
        code: "HASH_LOOKUP_FAILED",
      });
    mocked.store.set("claudeDirs", [path.join(mocked.home, ".claude-work")]);
    mocked.store.set("starConfirmed", true);

    expect(await runSubmit()).toBe(1);
    expect(errors[0]).not.toContain(DUPLICATE_SESSION_ADVICE);
    expect(await runSubmit({ nonInteractive: false })).toBe(1);
    expect(logs.join("\n")).not.toContain(DUPLICATE_SESSION_ADVICE);
  });

  it("adds that CLAUDE_CONFIG_DIR folders are always counted while the variable is set", async () => {
    routes.submit = () =>
      json(409, {
        error: "These sessions have already been submitted by another account.",
        code: "DUPLICATE_SESSION",
      });
    const dir = path.join(mocked.home, "acct-shell");
    fs.mkdirSync(path.join(dir, "projects"), { recursive: true });
    vi.stubEnv("CLAUDE_CONFIG_DIR", dir);

    expect(await runSubmit()).toBe(1);
    expect(errors[0]).toContain(`${DUPLICATE_SESSION_ADVICE} ${SHELL_FOLDER_ADVICE}`);
  });

  it("leaves the Data folders advice out when no folder was added", async () => {
    routes.submit = () =>
      json(409, {
        error: "These sessions have already been submitted by another account.",
        code: "DUPLICATE_SESSION",
      });

    expect(await runSubmit()).toBe(1);

    expect(errors[0]).toContain("These sessions have already been submitted by another account.");
    expect(errors[0]).not.toContain("Data folders");
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

  it("exits 1 with a timeout message when the submission never gets a response", async () => {
    routes.submit = stall;

    const code = await runSubmit();

    expect(code).toBe(1);
    expectNoStreamWrites();
    expectSingleError("Failed to submit: no response from the server within 120 seconds.");
    expect(errors[0]).toMatch(
      /^\[[^\]]+\] ccgather: Failed to submit: no response from the server within 120 seconds\.$/
    );
    expect(mocked.store.get("apiToken")).toBe("test-token");
    expect(mocked.store.get("lastSync")).toBe(INITIAL_LAST_SYNC);
  });

  it("exits 1 with a timeout message when verification never gets a response", async () => {
    routes.verify = stall;

    const code = await runSubmit();

    expect(code).toBe(1);
    expect(callsTo("/cli/submit")).toHaveLength(0);
    expectNoStreamWrites();
    expectSingleError(
      "Could not verify authentication (no response from the server within 120 seconds). Try again later."
    );
    expect(errors[0]).toMatch(
      /^\[[^\]]+\] ccgather: Could not verify authentication \(no response from the server within 120 seconds\)\. Try again later\.$/
    );
    expect(mocked.store.get("apiToken")).toBe("test-token");
  });

  it("gives every request a 120 second time limit", async () => {
    expect(await runSubmit()).toBe(0);
    expect(callsTo("/cli/verify")).toHaveLength(1);
    expect(callsTo("/cli/submit")).toHaveLength(1);

    fs.rmSync(path.join(mocked.home, ".claude"), { recursive: true, force: true });
    expect(await runSubmit()).toBe(1);
    expect(callsTo("/cli/submit-attempt")).toHaveLength(1);

    for (const suffix of ["/cli/verify", "/cli/submit", "/cli/submit-attempt"]) {
      for (const call of callsTo(suffix)) {
        expect(call.init?.signal, suffix).toBeInstanceOf(AbortSignal);
      }
    }
    expect(timeoutSpy).toHaveBeenCalledTimes(4);
    for (const [ms] of timeoutSpy.mock.calls) {
      expect(ms).toBe(120000);
    }
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

  it("interactive mode puts no time limit on its requests", async () => {
    mocked.readline.mockImplementationOnce(() => ({
      on: () => {},
      close: () => {},
      question: (_question: string, callback: (answer: string) => void) => callback("n"),
    }));

    const code = await runSubmit({ nonInteractive: false });

    expect(code).toBe(0);
    expect(callsTo("/cli/verify")).toHaveLength(1);
    expect(callsTo("/cli/submit")).toHaveLength(1);
    for (const call of [...callsTo("/cli/verify"), ...callsTo("/cli/submit")]) {
      expect(call.init?.signal).toBeUndefined();
    }
    expect(timeoutSpy).not.toHaveBeenCalled();
  });

  describe("other Claude Code data folders on this computer", () => {
    function otherFolder(): string {
      const dir = path.join(mocked.home, ".claude-work");
      const project = path.join(dir, "projects", "-home-user-other");
      fs.mkdirSync(project, { recursive: true });
      fs.writeFileSync(
        path.join(project, "other.jsonl"),
        [usageLine(11), usageLine(12)]
          .join("\n")
          .replace(/"sessionId":"demo"/g, '"sessionId":"other"') + "\n"
      );
      return dir;
    }

    it("a non-interactive run never asks and leaves an unconfirmed folder out", async () => {
      otherFolder();
      expect(await runSubmit()).toBe(0);
      expect(mocked.prompt).not.toHaveBeenCalled();
      const body = JSON.parse(String(callsTo("/cli/submit")[0]?.init?.body));
      expect(body.totalTokens).toBe(3000);
    });

    it("a non-interactive run counts a folder confirmed earlier", async () => {
      mocked.store.set("claudeDirs", [otherFolder()]);
      expect(await runSubmit()).toBe(0);
      const body = JSON.parse(String(callsTo("/cli/submit")[0]?.init?.body));
      expect(body.totalTokens).toBe(6000);
    });

    it("an interactive run asks once, counts the chosen folder and remembers the answer", async () => {
      const dir = otherFolder();
      mocked.prompt.mockResolvedValueOnce({ include: [dir] });
      mocked.readline.mockImplementationOnce(() => ({
        on: () => {},
        close: () => {},
        question: (_question: string, callback: (answer: string) => void) => callback("n"),
      }));

      expect(await runSubmit({ nonInteractive: false })).toBe(0);

      expect(mocked.prompt).toHaveBeenCalledTimes(1);
      const [question] = mocked.prompt.mock.calls[0]?.[0] as { message: string }[];
      expect(question?.message).toBe(otherFoldersQuestion(1));
      expect(mocked.store.get("claudeDirs")).toEqual([dir]);
      expect(mocked.store.get("declinedClaudeDirs")).toEqual([]);
      const body = JSON.parse(String(callsTo("/cli/submit")[0]?.init?.body));
      expect(body.totalTokens).toBe(6000);
    });

    interface Choice {
      name: string;
      value: string;
      checked: boolean;
    }
    const askedChoices = (): Choice[] => {
      const questions = mocked.prompt.mock.calls[0]?.[0] as { choices: Choice[] }[] | undefined;
      return questions?.[0]?.choices ?? [];
    };

    it("asks before looking for sessions, so data only in another folder is submitted", async () => {
      fs.rmSync(path.join(mocked.home, ".claude"), { recursive: true, force: true });
      const dir = otherFolder();
      mocked.store.set("starConfirmed", true);
      mocked.prompt.mockResolvedValueOnce({ include: [dir] });

      expect(await runSubmit({ nonInteractive: false })).toBe(0);

      const body = JSON.parse(String(callsTo("/cli/submit")[0]?.init?.body));
      expect(body.totalTokens).toBe(3000);
    });

    it("offers each folder checked, saves the ones left out, keeps earlier answers and asks once", async () => {
      const dir = otherFolder();
      const second = path.join(mocked.home, ".claude-second");
      fs.mkdirSync(path.join(second, "projects", "-home-user-second"), { recursive: true });
      fs.writeFileSync(
        path.join(second, "projects", "-home-user-second", "second.jsonl"),
        usageLine(21).replace('"sessionId":"demo"', '"sessionId":"second"') + "\n"
      );
      const earlier = path.join(mocked.home, "earlier");
      mocked.store.set("claudeDirs", [earlier]);
      mocked.store.set("declinedClaudeDirs", ["/gone"]);
      mocked.store.set("starConfirmed", true);
      mocked.prompt.mockResolvedValueOnce({ include: [dir] });

      expect(await runSubmit({ nonInteractive: false })).toBe(0);

      expect(askedChoices().map((c) => [c.value, c.checked])).toEqual([
        [second, true],
        [dir, true],
      ]);
      expect(mocked.store.get("claudeDirs")).toEqual([earlier, dir]);
      expect(mocked.store.get("declinedClaudeDirs")).toEqual(["/gone", second]);

      mocked.prompt.mockClear();
      expect(await runSubmit({ nonInteractive: false })).toBe(0);
      expect(mocked.prompt).not.toHaveBeenCalled();
    });

    it("saves a folder only the shell's CLAUDE_CONFIG_DIR names, without asking, for scheduled runs", async () => {
      const dir = otherFolder();
      vi.stubEnv("CLAUDE_CONFIG_DIR", dir);
      mocked.store.set("starConfirmed", true);
      mocked.store.set("declinedClaudeDirs", [dir]);

      expect(await runSubmit({ nonInteractive: false })).toBe(0);

      expect(mocked.prompt).not.toHaveBeenCalled();
      expect(mocked.store.get("claudeDirs")).toEqual([dir]);
      expect(mocked.store.get("declinedClaudeDirs")).toEqual([]);
      expect(logs.join("\n")).toContain(savedShellDirsNotice([dir]));

      vi.stubEnv("CLAUDE_CONFIG_DIR", "");
      mocked.store.delete("lastSync");
      expect(await runSubmit({ scheduled: true })).toBe(0);
      const last = callsTo("/cli/submit").at(-1);
      expect(JSON.parse(String(last?.init?.body)).totalTokens).toBe(6000);
    });

    it("saves a shell folder and says so once, however many times it runs", async () => {
      const dir = otherFolder();
      vi.stubEnv("CLAUDE_CONFIG_DIR", dir);
      mocked.store.set("starConfirmed", true);
      const notice = savedShellDirsNotice([dir]);

      expect(await runSubmit({ nonInteractive: false })).toBe(0);
      expect(await runSubmit({ nonInteractive: false })).toBe(0);

      expect(mocked.store.get("claudeDirs")).toEqual([dir]);
      expect(logs.filter((line) => line.includes(notice))).toHaveLength(1);
    });

    it("names every shell folder it saves in one line", async () => {
      const first = otherFolder();
      const second = path.join(mocked.home, "work-two");
      fs.mkdirSync(path.join(second, "projects"), { recursive: true });
      vi.stubEnv("CLAUDE_CONFIG_DIR", `${first},${second}`);
      mocked.store.set("starConfirmed", true);

      expect(await runSubmit({ nonInteractive: false })).toBe(0);

      expect(logs).toContainEqual(expect.stringContaining(savedShellDirsNotice([first, second])));
    });

    it("says nothing about shell folders when there are none", async () => {
      mocked.store.set("starConfirmed", true);
      expect(await runSubmit({ nonInteractive: false })).toBe(0);
      // The part that does not change with the number of folders
      const fixed = savedShellDirsNotice(["\u0000"]).split("\u0000")[1].split(" counts ")[0];
      expect(logs.some((line) => line.includes(fixed))).toBe(false);
    });

    it("a manual non-interactive submit saves a shell folder quietly, so scheduled runs match", async () => {
      const dir = otherFolder();
      vi.stubEnv("CLAUDE_CONFIG_DIR", dir);

      expect(await runSubmit()).toBe(0);

      expect(logs).toHaveLength(1);
      expect(mocked.store.get("claudeDirs")).toEqual([dir]);
      vi.stubEnv("CLAUDE_CONFIG_DIR", "");
      mocked.store.delete("lastSync");
      expect(await runSubmit({ scheduled: true })).toBe(0);
      const last = callsTo("/cli/submit").at(-1);
      expect(JSON.parse(String(last?.init?.body)).totalTokens).toBe(6000);
    });

    it("a scheduled run does not change the saved folders", async () => {
      const dir = otherFolder();
      vi.stubEnv("CLAUDE_CONFIG_DIR", dir);
      mocked.store.delete("lastSync");

      expect(await runSubmit({ scheduled: true })).toBe(0);

      expect(mocked.store.has("claudeDirs")).toBe(false);
    });

    it("asks about folders found on disk once, next to a saved shell folder", async () => {
      const shell = path.join(mocked.home, "work-shell");
      fs.mkdirSync(path.join(shell, "projects", "-home-user-shell"), { recursive: true });
      fs.writeFileSync(
        path.join(shell, "projects", "-home-user-shell", "shell.jsonl"),
        usageLine(31).replace('"sessionId":"demo"', '"sessionId":"shell"') + "\n"
      );
      const disk = otherFolder();
      vi.stubEnv("CLAUDE_CONFIG_DIR", shell);
      mocked.store.set("starConfirmed", true);
      mocked.prompt.mockResolvedValueOnce({ include: [] });

      expect(await runSubmit({ nonInteractive: false })).toBe(0);

      expect(mocked.prompt).toHaveBeenCalledTimes(1);
      expect(askedChoices().map((c) => c.value)).toEqual([disk]);
      expect(mocked.store.get("claudeDirs")).toEqual([shell]);
      expect(mocked.store.get("declinedClaudeDirs")).toEqual([disk]);

      mocked.prompt.mockClear();
      expect(await runSubmit({ nonInteractive: false })).toBe(0);
      expect(mocked.prompt).not.toHaveBeenCalled();
    });

    it("does not count a declined folder in the no-sessions hint", async () => {
      fs.rmSync(path.join(mocked.home, ".claude"), { recursive: true, force: true });
      mocked.store.set("declinedClaudeDirs", [otherFolder()]);

      expect(await runSubmit()).toBe(1);

      expect(errors[0]).toContain("No Claude Code sessions found");
      expect(errors[0]).not.toMatch(/other data folders? found/);
    });

    it("lists ~/.config/claude once in the no-sessions report when XDG_CONFIG_HOME is ~/.config", async () => {
      fs.rmSync(path.join(mocked.home, ".claude"), { recursive: true, force: true });
      vi.stubEnv("XDG_CONFIG_HOME", path.join(mocked.home, ".config"));

      expect(await runSubmit()).toBe(1);

      const config = path.join(mocked.home, ".config", "claude", "projects");
      expect(errors[0]?.split(config).length).toBe(2);
    });

    it("tells a non-interactive run that finds no sessions about folders waiting for an answer", async () => {
      fs.rmSync(path.join(mocked.home, ".claude"), { recursive: true, force: true });
      otherFolder();

      expect(await runSubmit()).toBe(1);

      expectSingleError(unconfirmedFoldersHint(1));
    });

    it("reports every folder it searched, from the variable and the saved list", async () => {
      fs.rmSync(path.join(mocked.home, ".claude"), { recursive: true, force: true });
      const a = path.join(mocked.home, "env-a");
      const b = path.join(mocked.home, "env-b");
      const saved = path.join(mocked.home, "saved");
      vi.stubEnv("CLAUDE_CONFIG_DIR", `${a},${b}`);
      mocked.store.set("claudeDirs", [saved]);

      expect(await runSubmit()).toBe(1);

      for (const dir of [a, b, saved]) {
        expect(errors[0]).toContain(path.join(dir, "projects"));
      }
    });
  });

  it("tells an interactive user once that counting changed, never a scheduled run", async () => {
    mocked.store.set("starConfirmed", true);
    const shown = () => logs.filter((line) => line.includes(COUNTING_NOTICE)).length;

    expect(await runSubmit({ nonInteractive: false })).toBe(0);
    expect(shown()).toBe(1);
    expect(mocked.store.get("countingNoticeShown")).toBe(true);

    expect(await runSubmit({ nonInteractive: false })).toBe(0);
    expect(shown()).toBe(1);
  });

  it("shows the counting notice when the server holds an earlier submit but lastSync is missing", async () => {
    // CLI 2.0.x and older never saved lastSync
    mocked.store.set("starConfirmed", true);
    mocked.store.delete("lastSync");
    routes.submit = () =>
      json(200, {
        success: true,
        rank: 7,
        previous: { totalTokens: 1000, totalCost: 1, lastSubmissionAt: "2026-08-01T00:00:00Z" },
      });

    expect(await runSubmit({ nonInteractive: false })).toBe(0);
    expect(logs.filter((line) => line.includes(COUNTING_NOTICE))).toHaveLength(1);
    expect(mocked.store.get("countingNoticeShown")).toBe(true);
  });

  it("only marks the counting notice as seen on a first submit, with nothing to compare", async () => {
    mocked.store.set("starConfirmed", true);
    mocked.store.delete("lastSync");

    expect(await runSubmit({ nonInteractive: false })).toBe(0);
    expect(logs.some((line) => line.includes(COUNTING_NOTICE))).toBe(false);
    expect(mocked.store.get("countingNoticeShown")).toBe(true);
  });

  it("does not show the counting notice outside an interactive submit", async () => {
    expect(await runSubmit()).toBe(0);
    mocked.store.delete("lastSync");
    expect(await runSubmit({ scheduled: true })).toBe(0);
    expect(logs.some((line) => line.includes(COUNTING_NOTICE))).toBe(false);
    expect(mocked.store.has("countingNoticeShown")).toBe(false);
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

  // `ccgather submit --scheduled`: the job `ccgather autosubmit` registers
  describe("scheduled", () => {
    const HOUR = 60 * 60 * 1000;

    it("skips without calling the server when the last submit is under 20 hours old", async () => {
      const recent = new Date(Date.now() - 19 * HOUR - 59 * 60 * 1000).toISOString();
      mocked.store.set("lastSync", recent);

      const code = await runSubmit({ scheduled: true });

      expect(code).toBe(0);
      expect(fetchCalls).toEqual([]);
      expect(errors).toEqual([]);
      expect(logs).toHaveLength(1);
      expect(logs[0]).toMatch(LOG_LINE);
      expect(logs[0]).toMatch(/ccgather: Skipped: submitted 19 hours ago\.$/);
      expect(mocked.store.get("lastSync")).toBe(recent);
      expect(mocked.prompt).not.toHaveBeenCalled();
      expectNoStreamWrites();
    });

    it("submits once 20 hours have passed, without an autoSync field", async () => {
      mocked.store.set("lastSync", new Date(Date.now() - 20 * HOUR - 1000).toISOString());

      const code = await runSubmit({ scheduled: true });

      expect(code).toBe(0);
      expect(mocked.prompt).not.toHaveBeenCalled();
      expect(mocked.ora).not.toHaveBeenCalled();
      expectNoStreamWrites();
      expect(logs).toHaveLength(1);
      expect(logs[0]).toMatch(/ccgather: Submitted 3\.00K tokens/);
      const [submitCall] = callsTo("/cli/submit");
      const body = JSON.parse(String(submitCall.init?.body));
      // The server decides the Autopilot badge; the CLI does not claim it
      expect(body).not.toHaveProperty("autoSync");
      // ...but it does say it is the autosubmit job, for the admin page
      expect(body.scheduled).toBe(true);
      expect(body.totalTokens).toBe(3000);
    });

    it("leaves the stored plan alone: no account fields from the scheduler's bare environment", async () => {
      mocked.store.delete("lastSync");
      expect(await runSubmit({ scheduled: true })).toBe(0);
      const body = JSON.parse(String(callsTo("/cli/submit")[0]?.init?.body));
      for (const field of ["ccplan", "rateLimitTier", "authMethod", "rawSubscriptionType"]) {
        expect(body, field).not.toHaveProperty(field);
      }
    });

    it("an interactive submit still reads the sign-in and sends the plan", async () => {
      mocked.store.set("starConfirmed", true);
      mocked.readCredentials.mockReturnValueOnce({
        ccplan: "max",
        rateLimitTier: "default_claude_max_20x",
        authMethod: "oauth",
        rawSubscriptionType: "max",
      });

      expect(await runSubmit({ nonInteractive: false })).toBe(0);

      const body = JSON.parse(String(callsTo("/cli/submit")[0]?.init?.body));
      expect(body.ccplan).toBe("max");
      expect(body.rateLimitTier).toBe("default_claude_max_20x");
    });

    it("does not read the sign-in at all, so a LaunchAgent never asks the Keychain", async () => {
      mocked.store.delete("lastSync");
      mocked.readCredentials.mockClear();
      expect(await runSubmit({ scheduled: true })).toBe(0);
      expect(mocked.readCredentials).not.toHaveBeenCalled();
      mocked.store.delete("lastSync");
      expect(await runSubmit({ nonInteractive: true })).toBe(0);
      expect(mocked.readCredentials).toHaveBeenCalled();
    });

    it("submits when there is no lastSync, or it lies in the future", async () => {
      mocked.store.delete("lastSync");
      expect(await runSubmit({ scheduled: true })).toBe(0);
      expect(callsTo("/cli/submit")).toHaveLength(1);

      mocked.store.set("lastSync", new Date(Date.now() + 2 * HOUR).toISOString());
      expect(await runSubmit({ scheduled: true })).toBe(0);
      expect(callsTo("/cli/submit")).toHaveLength(2);
    });

    it("fails like the plain non-interactive submit, with exit 1", async () => {
      routes.submit = () => json(503, { error: "Service unavailable" });
      expect(await runSubmit({ scheduled: true })).toBe(1);
      expectSingleError("Failed to submit: Service unavailable.");
    });

    describe("recording the result for `autosubmit status`", () => {
      type Record = { at: string; ok: boolean; message: string; summary: string };
      const recorded = () => mocked.store.get("lastScheduledRun") as Record | undefined;
      const messageOf = (line: string) => line.replace(LOG_LINE, "");

      it("records the skip with its text and time", async () => {
        mocked.store.set("lastSync", new Date(Date.now() - 10 * 60 * 1000).toISOString());
        const before = Date.now();

        expect(await runSubmit({ scheduled: true })).toBe(0);

        expect(logs).toHaveLength(1);
        expect(messageOf(logs[0])).toBe("Skipped: submitted 10 minutes ago.");
        expect(recorded()).toEqual({
          at: expect.any(String),
          ok: true,
          message: "Skipped: submitted 10 minutes ago.",
          summary: "skipped: submitted 10 minutes ago",
        });
        expect(Date.parse(recorded()!.at)).toBeGreaterThanOrEqual(before);
        expect(Date.parse(recorded()!.at)).toBeLessThanOrEqual(Date.now());
      });

      it("records a success, exactly as printed and without the token", async () => {
        mocked.store.set("lastSync", new Date(Date.now() - 21 * HOUR).toISOString());

        expect(await runSubmit({ scheduled: true })).toBe(0);

        expect(recorded()).toEqual({
          at: expect.any(String),
          ok: true,
          message: messageOf(logs[0]),
          summary: "submitted 1 day",
        });
        expect(recorded()!.message).toMatch(
          /^Submitted 3\.00K tokens .* as alice, global rank #7\.$/
        );
        expect(JSON.stringify(recorded())).not.toContain("test-token");
      });

      it("summarises a success by the days of usage that were sent", async () => {
        mocked.store.set("lastSync", new Date(Date.now() - 21 * HOUR).toISOString());
        const days = [10, 11, 12].map((day) => new Date(Date.UTC(2026, 8, day, 12)).toISOString());
        fs.writeFileSync(
          path.join(projectDir, "session.jsonl"),
          days.map((timestamp, index) => usageLine(index + 1, timestamp)).join("\n") + "\n"
        );

        expect(await runSubmit({ scheduled: true })).toBe(0);

        const body = JSON.parse(String(callsTo("/cli/submit")[0].init?.body));
        expect(body.daysTracked).toBe(3);
        expect(recorded()?.summary).toBe("submitted 3 days");
      });

      it("records a failure as not ok, before the process exits", async () => {
        mocked.store.set("lastSync", new Date(Date.now() - 21 * HOUR).toISOString());
        routes.submit = () => json(503, { error: "Service unavailable" });

        expect(await runSubmit({ scheduled: true })).toBe(1);

        expect(recorded()).toEqual({
          at: expect.any(String),
          ok: false,
          message: "Failed to submit: Service unavailable.",
          summary: "failed: Service unavailable",
        });
      });

      it("records a failure to verify the token", async () => {
        mocked.store.set("lastSync", new Date(Date.now() - 21 * HOUR).toISOString());
        routes.verify = () => json(401, { error: "Invalid API token" });

        expect(await runSubmit({ scheduled: true })).toBe(1);

        expect(recorded()?.ok).toBe(false);
        expect(recorded()?.message).toBe(messageOf(errors[0]));
        expect(recorded()?.message).toContain("Authentication refused by server (HTTP 401)");
      });

      // Each way a scheduled run can fail, and the summary `status` shows for it
      it.each<[string, () => void, string]>([
        ["no token saved", () => mocked.store.delete("apiToken"), "failed: not logged in"],
        [
          "token refused",
          () => {
            routes.verify = () => json(403, { error: "Invalid API token" });
          },
          "failed: authentication refused by server (HTTP 403)",
        ],
        [
          "token cannot be verified",
          () => {
            routes.verify = () => json(500, { error: "Internal server error" });
          },
          "failed: could not verify authentication (HTTP 500)",
        ],
        [
          "no sessions",
          () => fs.rmSync(path.join(mocked.home, ".claude"), { recursive: true, force: true }),
          "failed: no Claude Code sessions found",
        ],
        [
          "no usage data",
          () =>
            fs.writeFileSync(
              path.join(projectDir, "session.jsonl"),
              JSON.stringify({
                type: "user",
                sessionId: "demo",
                timestamp: new Date().toISOString(),
                message: { role: "user", content: "hello" },
              }) + "\n"
            ),
          "failed: no usage data found",
        ],
        [
          "submission limit",
          () => {
            routes.submit = () =>
              json(429, { error: "Rate limit exceeded", retryAfterMinutes: 25 });
          },
          "failed: submission limit reached, try again in 25 minute(s)",
        ],
        [
          "no response from the server",
          () => {
            routes.submit = stall;
          },
          "failed: no response from the server within 120 seconds",
        ],
      ])("summarises a failure: %s", async (_name, arrange, summary) => {
        mocked.store.set("lastSync", new Date(Date.now() - 21 * HOUR).toISOString());
        arrange();

        expect(await runSubmit({ scheduled: true })).toBe(1);

        expect(recorded()).toEqual({
          at: expect.any(String),
          ok: false,
          message: messageOf(errors[0]),
          summary,
        });
      });

      it("keeps the output and the exit code when writing the record throws", async () => {
        const realSet = mocked.store.set.bind(mocked.store);
        vi.spyOn(mocked.store, "set").mockImplementation((key, value) => {
          if (key === "lastScheduledRun") throw new Error("disk full");
          return realSet(key, value);
        });

        mocked.store.delete("lastSync");
        expect(await runSubmit({ scheduled: true })).toBe(0);
        expect(logs).toHaveLength(1);
        expect(logs[0]).toMatch(/ccgather: Submitted 3\.00K tokens/);
        expect(errors).toEqual([]);

        logs.length = 0;
        mocked.store.delete("lastSync");
        routes.submit = () => json(503, { error: "Service unavailable" });
        expect(await runSubmit({ scheduled: true })).toBe(1);
        expectSingleError("Failed to submit: Service unavailable.");
        expect(recorded()).toBeUndefined();
      });

      // Control: the manual non-interactive submit records nothing
      it("a plain non-interactive submit records nothing", async () => {
        expect(await runSubmit()).toBe(0);
        routes.submit = () => json(503, { error: "Service unavailable" });
        expect(await runSubmit()).toBe(1);
        expect(mocked.store.has("lastScheduledRun")).toBe(false);
      });
    });

    // Control: the manual `ccgather submit` ignores the guard
    it("plain non-interactive submit ignores the guard", async () => {
      mocked.store.set("lastSync", new Date(Date.now() - HOUR).toISOString());

      expect(await runSubmit()).toBe(0);

      const [submitCall] = callsTo("/cli/submit");
      expect(JSON.parse(String(submitCall.init?.body))).not.toHaveProperty("autoSync");
    });
  });
});

describe("formatAgo", () => {
  const MIN = 60 * 1000;
  const HOUR = 60 * MIN;

  it.each([
    [0, "less than a minute ago"],
    [59 * 1000, "less than a minute ago"],
    [MIN, "1 minute ago"],
    [119 * 1000, "1 minute ago"],
    [10 * MIN, "10 minutes ago"],
    [59 * MIN + 59 * 1000, "59 minutes ago"],
    [HOUR, "1 hour ago"],
    [HOUR + 59 * MIN, "1 hour ago"],
    [2 * HOUR, "2 hours ago"],
    [19 * HOUR + 59 * MIN, "19 hours ago"],
  ])("%i ms reads %s", (elapsed, expected) => {
    expect(formatAgo(elapsed)).toBe(expected);
  });
});
