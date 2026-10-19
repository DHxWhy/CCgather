/**
 * `ccgather autosubmit` command handlers, against a fake backend and a fake
 * conf store: login refusal, time choice, the messages for on, already on, a
 * changed time, off and status, how failures read, and the star prompt offered
 * when auto-submit is turned on.
 *
 * The real star prompt would run `gh api --method PUT /user/starred/...` under
 * the machine's GitHub login, so that module's prompt is mocked and every test
 * that reaches it injects its own fake through the context.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mocked = vi.hoisted(() => ({
  store: new Map<string, unknown>(),
  realPrompt: vi.fn(async () => undefined),
  // The server report of the on/off state (a real call would hit the network)
  report: vi.fn(async () => ({ success: true, data: { enabled: true } })),
}));

vi.mock("../src/lib/star-nudge", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/star-nudge")>();
  return { ...actual, promptStarNudge: mocked.realPrompt };
});

vi.mock("../src/lib/config", () => ({
  getConfig: () => ({
    get: (key: string) => mocked.store.get(key),
    set: (key: string, value: unknown) => {
      mocked.store.set(key, value);
    },
    delete: (key: string) => {
      mocked.store.delete(key);
    },
  }),
  getApiUrl: () => "https://ccgather.test/api",
  isAuthenticated: () => mocked.store.has("apiToken"),
}));

vi.mock("../src/lib/api", () => ({ reportAutosubmit: mocked.report }));

import {
  autosubmitEnable,
  autosubmitMenuLabel,
  autosubmitOff,
  autosubmitStatus,
  formatStatus,
  printFailure,
  READ_FAILED,
  REGISTER_FAILED,
  TURN_OFF_FAILED,
} from "../src/commands/autosubmit";
import {
  AutosubmitError,
  AutosubmitStatus,
  Backend,
  ResolveDeps,
} from "../src/lib/autosubmit/shared";

const NODE = "/usr/bin/node";
const NPX = "/usr/lib/node_modules/npm/bin/npx-cli.js";
const PKG = "/usr/lib/node_modules/ccgather";
const GLOBAL_ENTRY = `${PKG}/dist/index.js`;
const PINNED = [NODE, NPX, "--yes", "ccgather@2.2.0", "submit", "--scheduled"];
const LATEST = [NODE, NPX, "--yes", "ccgather@latest", "submit", "--scheduled"];
const GLOBAL = [NODE, GLOBAL_ENTRY, "submit", "--scheduled"];

// Colour is off under a test runner, but not when FORCE_COLOR is set
const plain = (text: string): string => text.replace(/\u001B\[[0-9;]*m/g, "");

function fakeDeps(): ResolveDeps {
  const files = new Set([NODE, NPX]);
  return {
    platform: "linux",
    execPath: NODE,
    packageRoot: null,
    globalRoot: async () => null,
    exists: (file) => files.has(file),
    realpath: (file) => (files.has(file) ? file : null),
    pathEnv: "",
    version: "2.2.0",
  };
}

function globalDeps(): ResolveDeps {
  const files = new Set([NODE, NPX, PKG, GLOBAL_ENTRY]);
  return {
    ...fakeDeps(),
    packageRoot: PKG,
    globalRoot: async () => "/usr/lib/node_modules",
    exists: (file) => files.has(file),
    realpath: (file) => (files.has(file) ? file : null),
  };
}

function fakeBackend(current: Partial<AutosubmitStatus> = {}, notes: string[] = []) {
  const backend = {
    enable: vi.fn(async () => ({ scheduler: "systemd user timer", notes })),
    disable: vi.fn(async () => true),
    status: vi.fn(async (): Promise<AutosubmitStatus> => ({
      registered: false,
      scheduler: "systemd user timer",
      log: "/home/alice/autosubmit.log",
      ...current,
    })),
  };
  return backend satisfies Backend;
}

const FIRST_LINES = [
  "✔ Auto-submit is on.",
  "  Runs every day at 14:23 (your local time) via systemd user timer.",
  "  A run is skipped if you submitted in the 20 hours before it, so the first one may be.",
];
const AT_14_17 = () => new Date(2026, 9, 11, 14, 17, 42);

describe("autosubmit on", () => {
  let logs: string[];

  beforeEach(() => {
    mocked.store.clear();
    mocked.store.set("apiToken", "test-token");
    mocked.store.set("autoSync", false);
    mocked.realPrompt.mockClear();
    logs = [];
    vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      logs.push(plain(args.join(" ")));
    });
  });

  afterEach(() => {
    expect(mocked.realPrompt).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it("reports the on state to the server after registering, and ignores a failure", async () => {
    mocked.report.mockClear();
    mocked.store.delete("apiToken");
    await expect(
      autosubmitEnable({}, { backend: fakeBackend(), resolveDeps: fakeDeps() })
    ).rejects.toBeInstanceOf(AutosubmitError);
    expect(mocked.report).not.toHaveBeenCalled();

    mocked.store.set("apiToken", "test-token");
    const backend = fakeBackend();
    await autosubmitEnable({}, { backend, resolveDeps: fakeDeps(), now: AT_14_17, isTTY: false });
    expect(mocked.report).toHaveBeenCalledTimes(1);
    expect(mocked.report).toHaveBeenCalledWith(true);

    const report = vi.fn(async () => {
      throw new Error("offline");
    });
    await autosubmitEnable(
      {},
      { backend, resolveDeps: fakeDeps(), now: AT_14_17, isTTY: false, report }
    );
    expect(report).toHaveBeenCalledWith(true);
    expect(mocked.store.get("autoSync")).toBe(true);
  });

  it("refuses when not logged in, without touching the scheduler", async () => {
    mocked.store.delete("apiToken");
    const backend = fakeBackend();
    await expect(autosubmitEnable({}, { backend, resolveDeps: fakeDeps() })).rejects.toMatchObject({
      cause: "you are not logged in.",
      action: "Run `npx ccgather` to log in, then run this again.",
    });
    expect(backend.status).not.toHaveBeenCalled();
    expect(backend.enable).not.toHaveBeenCalled();
    expect(mocked.store.get("autoSync")).toBe(false);
  });

  it("turning on from off prints the five lines for a job pinned through npx", async () => {
    const backend = fakeBackend();
    await autosubmitEnable({}, { backend, resolveDeps: fakeDeps(), now: AT_14_17, isTTY: false });

    expect(backend.enable).toHaveBeenCalledWith(
      expect.objectContaining({
        command: { argv: PINNED, kind: "npx", spec: "ccgather@2.2.0" },
        time: { hour: 14, minute: 23 },
      })
    );
    expect(mocked.store.get("autoSync")).toBe(true);
    expect(mocked.store.get("autoSyncTime")).toBe("14:23");
    expect(logs).toEqual([
      ...FIRST_LINES,
      "  Check: npx ccgather autosubmit status   Stop: npx ccgather autosubmit off",
      "  Tip: this job stays on ccgather 2.2.0. To follow upgrades, install globally (npm i -g ccgather) or add --auto-update.",
    ]);
  });

  it("names `ccgather autosubmit` and gives no tip for a global install", async () => {
    await autosubmitEnable(
      {},
      { backend: fakeBackend(), resolveDeps: globalDeps(), now: AT_14_17, isTTY: false }
    );
    expect(logs).toEqual([
      ...FIRST_LINES,
      "  Check: ccgather autosubmit status   Stop: ccgather autosubmit off",
    ]);
  });

  it("says what --auto-update does instead of the tip", async () => {
    const backend = fakeBackend();
    await autosubmitEnable(
      { autoUpdate: true },
      { backend, resolveDeps: fakeDeps(), now: AT_14_17, isTTY: false }
    );
    expect(backend.enable).toHaveBeenCalledWith(
      expect.objectContaining({
        command: { argv: LATEST, kind: "npx", spec: "ccgather@latest" },
      })
    );
    expect(logs).toEqual([
      ...FIRST_LINES,
      "  Check: npx ccgather autosubmit status   Stop: npx ccgather autosubmit off",
      "  It runs the newest ccgather release each day, with access to your token.",
    ]);
  });

  it("indents the backend's notes after the lines, with no Log line", async () => {
    await autosubmitEnable(
      {},
      {
        backend: fakeBackend({}, ["First note.", "Second note."]),
        resolveDeps: globalDeps(),
        now: AT_14_17,
        isTTY: false,
      }
    );
    expect(logs.slice(-2)).toEqual(["  First note.", "  Second note."]);
    expect(logs.some((line) => line.includes("Log:"))).toBe(false);
  });

  it("takes the 20 hours from the interval the scheduled run uses", async () => {
    await autosubmitEnable(
      {},
      { backend: fakeBackend(), resolveDeps: fakeDeps(), now: AT_14_17, isTTY: false }
    );
    expect(logs[2]).toContain("in the 20 hours before it");
  });

  it.each([
    [new Date(2026, 9, 11, 14, 17, 42), { hour: 14, minute: 23 }],
    [new Date(2026, 9, 11, 14, 17, 20), { hour: 14, minute: 22 }],
    [new Date(2026, 9, 11, 23, 57, 40), { hour: 0, minute: 3 }],
  ])("picks the default time from the clock: %s", async (now, time) => {
    const backend = fakeBackend();
    await autosubmitEnable({}, { backend, resolveDeps: fakeDeps(), now: () => now, isTTY: false });
    expect(backend.enable).toHaveBeenCalledWith(expect.objectContaining({ time }));
  });

  it("uses --at for a first turn-on", async () => {
    const backend = fakeBackend();
    await autosubmitEnable({ at: "07:05" }, { backend, resolveDeps: fakeDeps(), isTTY: false });
    expect(backend.enable).toHaveBeenCalledWith(
      expect.objectContaining({ time: { hour: 7, minute: 5 } })
    );
    expect(logs[1]).toBe("  Runs every day at 07:05 (your local time) via systemd user timer.");
    expect(mocked.store.get("autoSyncTime")).toBe("07:05");
  });

  describe("when it is already on", () => {
    const on = { registered: true, time: { hour: 20, minute: 15 }, argv: PINNED };

    it("re-registers at the same time and says so, without a star prompt", async () => {
      const backend = fakeBackend(on);
      const promptStar = vi.fn(async () => undefined);
      await autosubmitEnable(
        {},
        { backend, resolveDeps: fakeDeps(), now: AT_14_17, isTTY: true, promptStar }
      );
      expect(backend.enable).toHaveBeenCalledTimes(1);
      expect(backend.enable).toHaveBeenCalledWith(
        expect.objectContaining({ time: { hour: 20, minute: 15 } })
      );
      expect(logs).toEqual([
        "Auto-submit is already on (daily 20:15). Use --at HH:MM to change the time.",
      ]);
      expect(mocked.store.get("autoSync")).toBe(true);
      expect(mocked.store.get("autoSyncTime")).toBe("20:15");
      expect(promptStar).not.toHaveBeenCalled();
    });

    it.each([
      ["a global install", PINNED, globalDeps(), "your global install of ccgather"],
      ["a pinned version", GLOBAL, fakeDeps(), "ccgather@2.2.0 via npx"],
    ])("adds the updated line when the job now runs %s", async (_name, old, deps, what) => {
      const backend = fakeBackend({ ...on, argv: old });
      await autosubmitEnable({}, { backend, resolveDeps: deps });
      expect(logs).toEqual([
        "Auto-submit is already on (daily 20:15). Use --at HH:MM to change the time.",
        `  The job was updated: it now runs ${what}.`,
      ]);
    });

    it("describes a job that now follows the newest release", async () => {
      const backend = fakeBackend(on);
      await autosubmitEnable({ autoUpdate: true }, { backend, resolveDeps: fakeDeps() });
      expect(backend.enable).toHaveBeenCalledWith(
        expect.objectContaining({ command: expect.objectContaining({ argv: LATEST }) })
      );
      expect(logs[1]).toBe(
        "  The job was updated: it now runs the newest ccgather release each day, via npx."
      );
    });

    it("adds the updated line when the old command could not be read", async () => {
      const backend = fakeBackend({ ...on, argv: undefined });
      await autosubmitEnable({}, { backend, resolveDeps: fakeDeps() });
      expect(logs[1]).toBe("  The job was updated: it now runs ccgather@2.2.0 via npx.");
    });

    it("leaves the updated line out when the command is the same", async () => {
      await autosubmitEnable({}, { backend: fakeBackend(on), resolveDeps: fakeDeps() });
      expect(logs).toHaveLength(1);
    });

    it("with --at, re-registers at the new time and says so, without a star prompt", async () => {
      const backend = fakeBackend(on);
      const promptStar = vi.fn(async () => undefined);
      await autosubmitEnable(
        { at: "21:30" },
        { backend, resolveDeps: fakeDeps(), isTTY: true, promptStar }
      );
      expect(backend.enable).toHaveBeenCalledWith(
        expect.objectContaining({ time: { hour: 21, minute: 30 } })
      );
      expect(logs).toEqual(["✔ Auto-submit now runs every day at 21:30 (your local time)."]);
      expect(mocked.store.get("autoSyncTime")).toBe("21:30");
      expect(promptStar).not.toHaveBeenCalled();
    });
  });
});

describe("autosubmit failures", () => {
  let errors: string[];

  beforeEach(() => {
    mocked.store.clear();
    mocked.store.set("apiToken", "test-token");
    mocked.store.set("autoSync", false);
    errors = [];
    vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      errors.push(plain(args.join(" ")));
    });
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function register(options: Parameters<typeof autosubmitEnable>[0], context = {}) {
    try {
      await autosubmitEnable(options, { resolveDeps: fakeDeps(), ...context });
    } catch (err) {
      printFailure(err, REGISTER_FAILED);
    }
  }

  it("not logged in: the cause, then the next step", async () => {
    mocked.store.delete("apiToken");
    await register({}, { backend: fakeBackend() });
    expect(errors).toEqual([
      "✖ Could not register: you are not logged in.",
      "  Run `npx ccgather` to log in, then run this again.",
    ]);
  });

  it("npx's script not found: the cause, then the next step", async () => {
    await register(
      {},
      {
        backend: fakeBackend(),
        resolveDeps: { ...fakeDeps(), exists: (file: string) => file === NODE },
      }
    );
    expect(errors).toEqual([
      `✖ Could not register: npm's npx-cli.js was not found for ${NODE}.`,
      "  Install ccgather globally (npm i -g ccgather) and run `ccgather autosubmit on` again.",
    ]);
  });

  it("no cron daemon: the cause, then the next step", async () => {
    const backend = fakeBackend();
    backend.enable.mockRejectedValue(
      new AutosubmitError(
        "no cron daemon is running.",
        "On WSL, enable systemd or start cron (sudo service cron start), then run this again."
      )
    );
    await register({}, { backend });
    expect(errors).toEqual([
      "✖ Could not register: no cron daemon is running.",
      "  On WSL, enable systemd or start cron (sudo service cron start), then run this again.",
    ]);
    expect(mocked.store.get("autoSync")).toBe(false);
  });

  it("anything else from a backend: its message, one line", async () => {
    const backend = fakeBackend();
    backend.enable.mockRejectedValue(new Error("crontab refused the new table: bad time"));
    await register({}, { backend });
    expect(errors).toEqual(["✖ Could not register: crontab refused the new table: bad time"]);
  });

  it("a bad --at: one line, nothing registered", async () => {
    const backend = fakeBackend();
    await register({ at: "9pm" }, { backend });
    expect(errors).toEqual(["✖ --at must be HH:MM (24-hour), for example 21:30."]);
    expect(backend.status).not.toHaveBeenCalled();
    expect(backend.enable).not.toHaveBeenCalled();
  });

  it("an unsupported platform: the cause, then the README", async () => {
    await register({}, { platform: "freebsd" });
    expect(errors).toEqual([
      "✖ Auto-submit does not support freebsd yet.",
      "  See the README for a cron line you can add yourself.",
    ]);
  });

  it("off and status say what they were doing", async () => {
    printFailure(new Error("schtasks failed"), TURN_OFF_FAILED);
    printFailure(new Error("systemctl failed"), READ_FAILED);
    expect(errors).toEqual([
      "✖ Could not turn auto-submit off: schtasks failed",
      "✖ Could not read the scheduler: systemctl failed",
    ]);
  });
});

describe("autosubmit off", () => {
  let logs: string[];

  beforeEach(() => {
    mocked.store.clear();
    mocked.store.set("apiToken", "test-token");
    mocked.store.set("autoSync", true);
    mocked.store.set("autoSyncTime", "14:23");
    logs = [];
    vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      logs.push(plain(args.join(" ")));
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("says the job was removed, and clears the config", async () => {
    const backend = fakeBackend({ registered: true });
    await autosubmitOff({ backend });
    expect(backend.disable).toHaveBeenCalledTimes(1);
    expect(logs).toEqual(["✔ Auto-submit is off. The daily job was removed."]);
    expect(mocked.store.get("autoSync")).toBe(false);
    expect(mocked.store.has("autoSyncTime")).toBe(false);
  });

  it("says it was not on when there was nothing to remove, and clears the config", async () => {
    const backend = fakeBackend();
    backend.disable.mockResolvedValue(false);
    await autosubmitOff({ backend });
    expect(logs).toEqual(["Auto-submit was not on."]);
    expect(mocked.store.get("autoSync")).toBe(false);
    expect(mocked.store.has("autoSyncTime")).toBe(false);
  });
});

describe("autosubmit off — server report", () => {
  beforeEach(() => {
    mocked.store.clear();
    mocked.store.set("apiToken", "test-token");
    mocked.report.mockClear();
    vi.spyOn(console, "log").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reports the off state to the server, and ignores a failure", async () => {
    await autosubmitOff({ backend: fakeBackend({ registered: true }) });
    expect(mocked.report).toHaveBeenCalledTimes(1);
    expect(mocked.report).toHaveBeenCalledWith(false);

    const report = vi.fn(async () => {
      throw new Error("offline");
    });
    await autosubmitOff({ backend: fakeBackend(), report });
    expect(report).toHaveBeenCalledWith(false);
    expect(mocked.store.get("autoSync")).toBe(false);
  });
});

describe("auto-submit menu label", () => {
  beforeEach(() => {
    mocked.store.clear();
  });

  it("reads config only", () => {
    expect(autosubmitMenuLabel("linux")).toBe("Auto-submit: OFF");
    mocked.store.set("autoSync", true);
    expect(autosubmitMenuLabel("linux")).toBe("Auto-submit: ON");
    mocked.store.set("autoSyncTime", "14:23");
    expect(autosubmitMenuLabel("win32")).toBe("Auto-submit: ON · daily 14:23");
    expect(autosubmitMenuLabel("darwin")).toBe("Auto-submit: ON · daily 14:23");
  });

  it("is left out on a platform auto-submit does not support", () => {
    expect(autosubmitMenuLabel("freebsd")).toBeNull();
  });
});

describe("autosubmit on: the star prompt", () => {
  let logs: string[];

  // A prompt that remembers what had been printed, and whether the job was
  // registered, when it was called
  function fakePrompt(backend: ReturnType<typeof fakeBackend>) {
    const seen: { logs: string[]; registered: number }[] = [];
    const prompt = vi.fn(async () => {
      seen.push({ logs: [...logs], registered: backend.enable.mock.calls.length });
    });
    return { prompt, seen };
  }

  beforeEach(() => {
    mocked.store.clear();
    mocked.store.set("apiToken", "test-token");
    mocked.store.set("autoSync", false);
    mocked.realPrompt.mockClear();
    logs = [];
    vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      logs.push(plain(args.join(" ")));
    });
  });

  afterEach(() => {
    expect(mocked.realPrompt).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it("is offered on a turn-on with no earlier submit, after the schedule is registered and printed", async () => {
    expect(mocked.store.has("lastSync")).toBe(false);
    const backend = fakeBackend();
    const { prompt, seen } = fakePrompt(backend);
    await autosubmitEnable(
      {},
      { backend, resolveDeps: fakeDeps(), isTTY: true, promptStar: prompt }
    );
    expect(prompt).toHaveBeenCalledTimes(1);
    expect(seen[0].registered).toBe(1);
    expect(seen[0].logs).toEqual(logs);
    expect(logs[0]).toBe("✔ Auto-submit is on.");
  });

  it("is offered however recently the last prompt was declined", async () => {
    mocked.store.set("starPromptSnooze", 5);
    mocked.store.set("starDeclineCount", 3);
    const backend = fakeBackend();
    const { prompt } = fakePrompt(backend);
    await autosubmitEnable(
      {},
      { backend, resolveDeps: fakeDeps(), isTTY: true, promptStar: prompt }
    );
    expect(prompt).toHaveBeenCalledTimes(1);
    // The decline spacing is a submit's: this turn-on neither reads nor spends it
    expect(mocked.store.get("starPromptSnooze")).toBe(5);
  });

  it("is not offered once the star is confirmed", async () => {
    mocked.store.set("starConfirmed", true);
    const backend = fakeBackend();
    const { prompt } = fakePrompt(backend);
    await autosubmitEnable(
      {},
      { backend, resolveDeps: fakeDeps(), isTTY: true, promptStar: prompt }
    );
    expect(prompt).not.toHaveBeenCalled();
  });

  it("is not offered without a terminal", async () => {
    const backend = fakeBackend();
    const { prompt } = fakePrompt(backend);
    await autosubmitEnable(
      {},
      { backend, resolveDeps: fakeDeps(), isTTY: false, promptStar: prompt }
    );
    expect(prompt).not.toHaveBeenCalled();
  });

  it("is not offered on off or on status", async () => {
    const backend = fakeBackend({ registered: true, time: { hour: 14, minute: 23 } });
    const { prompt } = fakePrompt(backend);
    await autosubmitOff({ backend, isTTY: true, promptStar: prompt });
    await autosubmitStatus({ backend, isTTY: true, promptStar: prompt });
    expect(prompt).not.toHaveBeenCalled();
  });

  it("is not offered when registering fails", async () => {
    const backend = fakeBackend();
    backend.enable.mockRejectedValue(new Error("crontab is not available"));
    const { prompt } = fakePrompt(backend);
    await expect(
      autosubmitEnable({}, { backend, resolveDeps: fakeDeps(), isTTY: true, promptStar: prompt })
    ).rejects.toThrow("crontab is not available");
    expect(prompt).not.toHaveBeenCalled();
  });

  it("does not fail the command, or touch the schedule, when the prompt throws", async () => {
    const backend = fakeBackend();
    const prompt = vi.fn(async () => {
      throw new Error("prompt blew up");
    });
    await expect(
      autosubmitEnable({}, { backend, resolveDeps: fakeDeps(), isTTY: true, promptStar: prompt })
    ).resolves.toBeUndefined();
    expect(prompt).toHaveBeenCalledTimes(1);
    expect(backend.enable).toHaveBeenCalledTimes(1);
    expect(backend.disable).not.toHaveBeenCalled();
    expect(mocked.store.get("autoSync")).toBe(true);
  });
});

describe("formatStatus", () => {
  const exists = () => true;
  const LOG = "/home/alice/.local/state/ccgather/autosubmit.log";
  const base: AutosubmitStatus = {
    registered: true,
    scheduler: "systemd user timer",
    time: { hour: 14, minute: 23 },
    argv: PINNED,
    state: "active",
    nextRun: new Date(2026, 9, 13, 14, 23).toISOString(),
    log: LOG,
  };
  const run = {
    at: new Date(2026, 9, 12, 14, 23, 5).toISOString(),
    ok: true,
    message: "Skipped: submitted 10 minutes ago.",
    summary: "skipped: submitted 10 minutes ago",
  };

  it("shows the job, the command, the last run's outcome and the log", () => {
    expect(formatStatus(base, exists, run)).toEqual([
      "Auto-submit: ON",
      "  Schedule:  daily at 14:23 (systemd user timer)",
      "  Runs:      ccgather@2.2.0 via npx",
      "  Last run:  2026-10-12 14:23 · skipped: submitted 10 minutes ago",
      "  Next run:  2026-10-13 14:23",
      `  Log:       ${LOG}`,
    ]);
  });

  it("shows the off layout", () => {
    expect(formatStatus({ registered: false, scheduler: "cron", log: LOG }, exists, run)).toEqual([
      "Auto-submit: OFF",
      "  Turn it on with: npx ccgather autosubmit on",
    ]);
  });

  it("says none yet when no run was recorded", () => {
    expect(formatStatus(base, exists)).toContain("  Last run:  none yet");
  });

  it.each([
    ["a success", "submitted 4 days"],
    ["a skip", "skipped: submitted 10 minutes ago"],
    ["a failure", "failed: submission limit reached, try again in 25 minute(s)"],
  ])("shows the summary of %s", (_name, summary) => {
    expect(formatStatus(base, exists, { ...run, summary })).toContain(
      `  Last run:  2026-10-12 14:23 · ${summary}`
    );
  });

  it("names the command a global install runs, and the newest release", () => {
    expect(formatStatus({ ...base, argv: GLOBAL }, exists)).toContain(
      "  Runs:      your global install of ccgather"
    );
    expect(formatStatus({ ...base, argv: LATEST }, exists)).toContain(
      "  Runs:      the newest ccgather release each day, via npx"
    );
  });

  it("shows the command itself when it fits none of them", () => {
    const argv = ["/opt/my node/node", "/opt/job.js", "go"];
    expect(formatStatus({ ...base, argv }, exists)).toContain(
      '  Runs:      "/opt/my node/node" /opt/job.js go'
    );
  });

  it("flags each missing path and says how to repair, by the command the job runs", () => {
    const missing = (file: string) => file !== NPX && file !== GLOBAL_ENTRY;
    expect(formatStatus(base, missing)).toContain(
      `  Problem:   ${NPX} is missing. Run \`npx ccgather autosubmit on\` to repair.`
    );
    expect(formatStatus({ ...base, argv: GLOBAL }, missing)).toContain(
      `  Problem:   ${GLOBAL_ENTRY} is missing. Run \`ccgather autosubmit on\` to repair.`
    );
    expect(formatStatus(base, exists).some((line) => line.includes("Problem:"))).toBe(false);
  });

  it("asks to repair when the command cannot be read", () => {
    expect(formatStatus({ ...base, argv: undefined }, exists)).toContain(
      "  Problem:   could not read the command it runs. Run `npx ccgather autosubmit on` to repair."
    );
  });

  it.each(["Ready", "Running", "active", "waiting", "not running"])(
    "leaves the state out when it is the normal %s",
    (state) => {
      expect(formatStatus({ ...base, state }, exists).some((line) => line.includes("State:"))).toBe(
        false
      );
    }
  );

  it("shows the state when the scheduler reports something else", () => {
    const lines = formatStatus({ ...base, state: "Disabled" }, exists, run);
    expect(lines).toContain("  State:     Disabled");
    expect(lines.indexOf("  State:     Disabled")).toBeLessThan(
      lines.findIndex((line) => line.startsWith("  Last run:"))
    );
  });

  describe("a run the scheduler reports failed", () => {
    const failed = { ...base, lastFailure: "exit-code (exit 203)" };
    const PROBLEM =
      "  Problem:   the scheduler reports the last run failed: exit-code (exit 203). See the log.";

    it("shows a Problem row right after Last run when nothing was recorded", () => {
      const lines = formatStatus(failed, exists);
      expect(lines).toContain(PROBLEM);
      expect(lines.indexOf(PROBLEM)).toBe(lines.indexOf("  Last run:  none yet") + 1);
    });

    it("shows it beside a recorded run that succeeded or was skipped", () => {
      expect(formatStatus(failed, exists, run)).toContain(PROBLEM);
      expect(formatStatus(failed, exists, { ...run, summary: "submitted 3 days" })).toContain(
        PROBLEM
      );
    });

    it("does not say it twice when the recorded run already failed", () => {
      const record = { ...run, ok: false, summary: "failed: not logged in" };
      expect(formatStatus(failed, exists, record).some((l) => l.includes("Problem:"))).toBe(false);
    });

    it("shows nothing when the scheduler reports no failure", () => {
      expect(formatStatus(base, exists, run).some((l) => l.includes("Problem:"))).toBe(false);
      expect(formatStatus(base, exists).some((l) => l.includes("Problem:"))).toBe(false);
    });
  });

  it("gives the next run as the scheduler wrote it when it does not parse", () => {
    expect(formatStatus({ ...base, nextRun: "soon" }, exists)).toContain("  Next run:  soon");
    const { nextRun: _next, ...without } = base;
    expect(formatStatus(without, exists).some((line) => line.includes("Next run"))).toBe(false);
  });

  it("leaves the log tail out when the log ends with the recorded run's message", () => {
    const lines = formatStatus(
      {
        ...base,
        lastLogLine: "[2026-10-12T18:23:05.000Z] ccgather: Skipped: submitted 10 minutes ago.",
      },
      exists,
      run
    );
    expect(lines.some((line) => line.includes("Log tail"))).toBe(false);
  });

  it("shows the log tail when it says something else, such as a crash", () => {
    const lines = formatStatus({ ...base, lastLogLine: "node: command not found" }, exists, run);
    expect(lines.at(-1)).toBe("  Log tail:  node: command not found");
    expect(lines.at(-2)).toBe(`  Log:       ${LOG}`);
  });

  it("shows the log tail when there is no recorded run to match it", () => {
    expect(formatStatus({ ...base, lastLogLine: "node: command not found" }, exists)).toContain(
      "  Log tail:  node: command not found"
    );
  });

  describe("autosubmitStatus", () => {
    let logs: string[];

    beforeEach(() => {
      mocked.store.clear();
      logs = [];
      vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
        logs.push(args.join(" "));
      });
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("prints what the backend read, with the record from the context", async () => {
      mocked.store.set("lastScheduledRun", { ...run, summary: "from config" });
      await autosubmitStatus({ backend: fakeBackend(base), lastScheduledRun: run });
      expect(logs).toContain("  Last run:  2026-10-12 14:23 · skipped: submitted 10 minutes ago");
    });

    it("reads the record from config when the context has none", async () => {
      mocked.store.set("lastScheduledRun", run);
      await autosubmitStatus({ backend: fakeBackend(base) });
      expect(logs).toContain("  Last run:  2026-10-12 14:23 · skipped: submitted 10 minutes ago");
    });

    it("prints the off layout when the scheduler has no job", async () => {
      await autosubmitStatus({ backend: fakeBackend() });
      expect(logs).toEqual(["Auto-submit: OFF", "  Turn it on with: npx ccgather autosubmit on"]);
    });
  });
});
