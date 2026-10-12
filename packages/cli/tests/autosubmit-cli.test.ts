/**
 * Commander wiring for `ccgather autosubmit [on|off|status]` and
 * `ccgather submit --scheduled`. The command handlers are mocked, so nothing
 * here reaches a scheduler, a server or the real conf store.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mocked = vi.hoisted(() => ({
  AutosubmitError:
    undefined as unknown as typeof import("../src/lib/autosubmit/shared").AutosubmitError,
  submit: vi.fn(async (_options?: unknown): Promise<void> => undefined),
  enable: vi.fn(async (_options?: unknown): Promise<void> => undefined),
  off: vi.fn(async (): Promise<void> => undefined),
  status: vi.fn(async (): Promise<void> => undefined),
  printAnimatedHeader: vi.fn(async () => undefined),
  prompt: vi.fn(async (): Promise<Record<string, unknown>> => {
    throw new Error("inquirer.prompt must not be called");
  }),
}));

vi.mock("../src/commands/submit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/commands/submit")>();
  return { ...actual, submit: mocked.submit };
});

// The handlers are fakes; how a failure is printed is the real thing
vi.mock("../src/commands/autosubmit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/commands/autosubmit")>();
  // printFailure tells an AutosubmitError by its class, so hand the test the one
  // this module graph uses
  const shared = await import("../src/lib/autosubmit/shared");
  mocked.AutosubmitError = shared.AutosubmitError;
  return {
    ...actual,
    autosubmitEnable: mocked.enable,
    autosubmitOff: mocked.off,
    autosubmitStatus: mocked.status,
  };
});

vi.mock("../src/lib/ui", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/ui")>();
  return { ...actual, printAnimatedHeader: mocked.printAnimatedHeader };
});

vi.mock("inquirer", () => ({ default: { prompt: mocked.prompt } }));

vi.mock("../src/lib/config", () => ({
  getConfig: () => ({ get: () => undefined, set: () => {}, delete: () => {} }),
  getApiUrl: () => "https://ccgather.test/api",
  isAuthenticated: () => false,
}));
vi.mock("../src/lib/api", () => ({
  getStatus: vi.fn(async () => ({ success: false, error: "blocked in tests" })),
}));
vi.mock("open", () => ({ default: vi.fn(async () => undefined) }));

describe("ccgather autosubmit routing", () => {
  const originalArgv = process.argv;
  let errors: string[];

  async function runCli(args: string[]): Promise<void> {
    process.argv = ["node", "ccgather", ...args];
    await import("../src/index");
  }

  beforeEach(() => {
    vi.resetModules();
    for (const fn of [mocked.submit, mocked.enable, mocked.off, mocked.status]) {
      fn.mockReset();
      fn.mockResolvedValue(undefined);
    }
    mocked.printAnimatedHeader.mockClear();
    mocked.prompt.mockReset();
    mocked.prompt.mockRejectedValue(new Error("inquirer.prompt must not be called"));
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("blocked in tests", { status: 503 }))
    );
    errors = [];
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      errors.push(args.join(" ").replace(/\u001B\[[0-9;]*m/g, ""));
    });
    vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);
  });

  afterEach(() => {
    process.argv = originalArgv;
    process.exitCode = undefined;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  function expectNoMenu(): void {
    expect(mocked.printAnimatedHeader).not.toHaveBeenCalled();
    expect(mocked.prompt).not.toHaveBeenCalled();
  }

  class Exit extends Error {
    constructor(readonly code: number | string | null | undefined) {
      super(`process.exit(${code})`);
    }
  }

  it("`autosubmit on` enables with no options", async () => {
    await runCli(["autosubmit", "on"]);
    await vi.waitFor(() => expect(mocked.enable).toHaveBeenCalledWith({}));
    expect(mocked.off).not.toHaveBeenCalled();
    expect(mocked.status).not.toHaveBeenCalled();
    expectNoMenu();
  });

  it("`autosubmit on --at 21:30 --auto-update` passes both options", async () => {
    await runCli(["autosubmit", "on", "--at", "21:30", "--auto-update"]);
    await vi.waitFor(() =>
      expect(mocked.enable).toHaveBeenCalledWith({ at: "21:30", autoUpdate: true })
    );
  });

  it("a bare `autosubmit` shows its help with exit code 1 and registers nothing", async () => {
    const exit = vi.spyOn(process, "exit").mockImplementation((code) => {
      throw new Exit(code);
    });
    const stderr: string[] = [];
    vi.spyOn(process.stderr, "write").mockImplementation((chunk: string | Uint8Array) => {
      stderr.push(String(chunk));
      return true;
    });

    await expect(runCli(["autosubmit"])).rejects.toThrow(Exit);

    expect(exit).toHaveBeenCalledWith(1);
    const help = stderr.join("");
    expect(help).toMatch(/Usage: ccgather autosubmit \[options\] \[command\]/);
    expect(help).toMatch(/^\s+on \[options\]/m);
    expect(help).toMatch(/^\s+off\s/m);
    expect(help).toMatch(/^\s+status\s/m);
    expect(mocked.enable).not.toHaveBeenCalled();
    expect(mocked.off).not.toHaveBeenCalled();
    expect(mocked.status).not.toHaveBeenCalled();
    expectNoMenu();
  });

  it("`autosubmit off` removes the job", async () => {
    await runCli(["autosubmit", "off"]);
    await vi.waitFor(() => expect(mocked.off).toHaveBeenCalledTimes(1));
    expect(mocked.enable).not.toHaveBeenCalled();
    expectNoMenu();
  });

  it("`autosubmit status` reports the job", async () => {
    await runCli(["autosubmit", "status"]);
    await vi.waitFor(() => expect(mocked.status).toHaveBeenCalledTimes(1));
    expect(mocked.enable).not.toHaveBeenCalled();
    expectNoMenu();
  });

  it.each([
    [["disable"], /unknown command 'disable'/],
    [["of"], /unknown command 'of'/],
    [["on", "--time", "21:30"], /unknown option '--time'/],
    [["on", "extra"], /too many arguments for 'on'/],
  ])("`autosubmit %s` is refused with exit code 1 and changes nothing", async (words, message) => {
    const exit = vi.spyOn(process, "exit").mockImplementation((code) => {
      throw new Exit(code);
    });
    const stderr: string[] = [];
    vi.spyOn(process.stderr, "write").mockImplementation((chunk: string | Uint8Array) => {
      stderr.push(String(chunk));
      return true;
    });

    await expect(runCli(["autosubmit", ...words])).rejects.toThrow(Exit);

    expect(exit).toHaveBeenCalledWith(1);
    expect(stderr.join("")).toMatch(message);
    expect(mocked.enable).not.toHaveBeenCalled();
    expect(mocked.off).not.toHaveBeenCalled();
    expect(mocked.status).not.toHaveBeenCalled();
    expectNoMenu();
  });

  it("a failure with a next step is two stderr lines and exit code 1", async () => {
    mocked.enable.mockImplementation(async () => {
      throw new mocked.AutosubmitError(
        "no cron daemon is running.",
        "On WSL, enable systemd or start cron (sudo service cron start), then run this again."
      );
    });
    await runCli(["autosubmit", "on"]);
    await vi.waitFor(() => expect(process.exitCode).toBe(1));
    expect(errors).toEqual([
      "✖ Could not register: no cron daemon is running.",
      "  On WSL, enable systemd or start cron (sudo service cron start), then run this again.",
    ]);
  });

  it("a plain error from a backend is one stderr line and exit code 1", async () => {
    mocked.enable.mockRejectedValue(new Error("crontab refused the new table: bad time"));
    await runCli(["autosubmit", "on"]);
    await vi.waitFor(() => expect(process.exitCode).toBe(1));
    expect(errors).toEqual(["✖ Could not register: crontab refused the new table: bad time"]);
  });

  it("a bad --at is not prefixed with what was attempted", async () => {
    mocked.enable.mockImplementation(async () => {
      throw new mocked.AutosubmitError(
        "--at must be HH:MM (24-hour), for example 21:30.",
        undefined,
        true
      );
    });
    await runCli(["autosubmit", "on", "--at", "9pm"]);
    await vi.waitFor(() => expect(process.exitCode).toBe(1));
    expect(errors).toEqual(["✖ --at must be HH:MM (24-hour), for example 21:30."]);
  });

  it("`off` and `status` failures say what they were doing, with exit code 1", async () => {
    mocked.off.mockRejectedValue(
      new Error("Could not remove the scheduled task: Access is denied")
    );
    await runCli(["autosubmit", "off"]);
    await vi.waitFor(() => expect(process.exitCode).toBe(1));
    expect(errors).toEqual([
      "✖ Could not turn auto-submit off: Could not remove the scheduled task: Access is denied",
    ]);

    errors.length = 0;
    process.exitCode = undefined;
    vi.resetModules();
    mocked.status.mockRejectedValue(new Error("systemctl failed"));
    await runCli(["autosubmit", "status"]);
    await vi.waitFor(() => expect(process.exitCode).toBe(1));
    expect(errors).toEqual(["✖ Could not read the scheduler: systemctl failed"]);
  });

  it("`submit --scheduled` runs the scheduled submit", async () => {
    await runCli(["submit", "--scheduled"]);
    await vi.waitFor(() =>
      expect(mocked.submit).toHaveBeenCalledWith({ nonInteractive: true, scheduled: true })
    );
    expectNoMenu();
  });

  it("plain `submit` is unchanged", async () => {
    await runCli(["submit"]);
    await vi.waitFor(() => expect(mocked.submit).toHaveBeenCalledWith({ nonInteractive: true }));
  });

  it("a bare `ccgather` still opens the menu", async () => {
    mocked.prompt.mockResolvedValue({ startAuth: false });
    await runCli([]);
    await vi.waitFor(() => expect(mocked.prompt).toHaveBeenCalledTimes(2));
    expect(mocked.printAnimatedHeader).toHaveBeenCalledTimes(1);
    expect(mocked.enable).not.toHaveBeenCalled();
    expect(mocked.submit).not.toHaveBeenCalled();
  });
});
