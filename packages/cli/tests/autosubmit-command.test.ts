/**
 * `ccgather autosubmit` command handlers, against a fake backend and a fake
 * conf store: login refusal, time choice, messages, the autoSync flag, the last
 * scheduled outcome in `status` and the star prompt offered when it is turned on.
 *
 * The real star prompt would run `gh api --method PUT /user/starred/...` under
 * the machine's GitHub login, so that module's prompt is mocked and every test
 * that reaches it injects its own fake through the context.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mocked = vi.hoisted(() => ({
  store: new Map<string, unknown>(),
  realPrompt: vi.fn(async () => undefined),
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

import {
  autosubmitEnable,
  autosubmitOff,
  autosubmitSettingsState,
  autosubmitStatus,
  formatStatus,
  toggleAutosubmit,
} from "../src/commands/autosubmit";
import { AutosubmitStatus, Backend, ResolveDeps } from "../src/lib/autosubmit/shared";

const NODE = "/usr/bin/node";
const NPX = "/usr/lib/node_modules/npm/bin/npx-cli.js";

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
    version: "2.1.1",
  };
}

function fakeBackend(current: Partial<AutosubmitStatus> = {}) {
  const backend = {
    enable: vi.fn(async () => ({ log: "/home/alice/autosubmit.log", notes: ["A note."] })),
    disable: vi.fn(async () => true),
    status: vi.fn(async (): Promise<AutosubmitStatus> => ({
      registered: false,
      mechanism: "crontab entry",
      log: "/home/alice/autosubmit.log",
      ...current,
    })),
  };
  return backend satisfies Backend;
}

describe("autosubmit commands", () => {
  let logs: string[];

  beforeEach(() => {
    mocked.store.clear();
    mocked.store.set("apiToken", "test-token");
    mocked.store.set("autoSync", false);
    logs = [];
    vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      logs.push(args.join(" "));
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("refuses to enable when not logged in, without touching the scheduler", async () => {
    mocked.store.delete("apiToken");
    const backend = fakeBackend();
    await expect(autosubmitEnable({}, { backend, resolveDeps: fakeDeps() })).rejects.toThrow(
      "Log in first with `npx ccgather`."
    );
    expect(backend.status).not.toHaveBeenCalled();
    expect(backend.enable).not.toHaveBeenCalled();
    expect(mocked.store.get("autoSync")).toBe(false);
  });

  it("enables five minutes from now, sets autoSync and prints where the log is", async () => {
    const backend = fakeBackend();
    await autosubmitEnable(
      {},
      { backend, resolveDeps: fakeDeps(), now: () => new Date(2026, 9, 11, 14, 17, 42) }
    );

    expect(backend.enable).toHaveBeenCalledWith(
      expect.objectContaining({
        command: {
          argv: [NODE, NPX, "--yes", "ccgather@2.1.1", "submit", "--scheduled"],
          kind: "npx",
          spec: "ccgather@2.1.1",
        },
        time: { hour: 14, minute: 23 },
      })
    );
    expect(mocked.store.get("autoSync")).toBe(true);
    expect(logs).toEqual([
      "Autosubmit is on. Runs every day at 14:23, your local time. A run is skipped if you submitted in the 20 hours before it, so the first one may be.",
      "It uses ccgather@2.1.1 via npx and stays on that version. To have it follow upgrades, install ccgather globally (`npm install -g ccgather`) and run `ccgather autosubmit on` again.",
      "Log: /home/alice/autosubmit.log. Turn it off with `npx ccgather autosubmit off`; check it with `npx ccgather autosubmit status`.",
      "A note.",
    ]);
  });

  it.each([
    [new Date(2026, 9, 11, 14, 17, 42), { hour: 14, minute: 23 }],
    [new Date(2026, 9, 11, 14, 17, 20), { hour: 14, minute: 22 }],
    [new Date(2026, 9, 11, 23, 57, 40), { hour: 0, minute: 3 }],
  ])("picks the default time from the clock: %s", async (now, time) => {
    const backend = fakeBackend();
    await autosubmitEnable({}, { backend, resolveDeps: fakeDeps(), now: () => now });
    expect(backend.enable).toHaveBeenCalledWith(expect.objectContaining({ time }));
  });

  it("uses --at and warns plainly about --auto-update", async () => {
    const backend = fakeBackend();
    await autosubmitEnable({ at: "07:05", autoUpdate: true }, { backend, resolveDeps: fakeDeps() });
    expect(backend.status).not.toHaveBeenCalled();
    expect(backend.enable).toHaveBeenCalledWith(
      expect.objectContaining({ time: { hour: 7, minute: 5 } })
    );
    expect(logs[0]).toBe(
      "Autosubmit is on. Runs every day at 07:05, your local time. A run is skipped if you submitted in the 20 hours before it, so the first one may be."
    );
    expect(logs[1]).toBe("It uses the newest ccgather release each day, via npx.");
    expect(logs).toContain(
      "--auto-update: each day it runs whatever ccgather release is newest that day, with access to your token."
    );
  });

  it("keeps the registered time when re-run without --at", async () => {
    const backend = fakeBackend({ registered: true, time: { hour: 20, minute: 15 } });
    await autosubmitEnable(
      {},
      { backend, resolveDeps: fakeDeps(), now: () => new Date(2026, 9, 11, 14, 17, 42) }
    );
    expect(backend.enable).toHaveBeenCalledWith(
      expect.objectContaining({ time: { hour: 20, minute: 15 } })
    );
  });

  it("refuses a malformed --at", async () => {
    const backend = fakeBackend();
    await expect(
      autosubmitEnable({ at: "9pm" }, { backend, resolveDeps: fakeDeps() })
    ).rejects.toThrow("--at must be HH:MM");
    expect(backend.enable).not.toHaveBeenCalled();
  });

  it("off removes the job and clears autoSync, and is quiet when nothing was there", async () => {
    mocked.store.set("autoSync", true);
    const backend = fakeBackend();
    await autosubmitOff({ backend });
    expect(mocked.store.get("autoSync")).toBe(false);
    expect(logs).toEqual(["Autosubmit is off; the scheduled job was removed."]);

    logs.length = 0;
    backend.disable.mockResolvedValueOnce(false);
    await autosubmitOff({ backend });
    expect(logs).toEqual(["Autosubmit is off."]);
  });

  it("status prints what the backend read from the OS", async () => {
    const backend = fakeBackend({ registered: false });
    await autosubmitStatus({ backend });
    expect(logs).toEqual([
      "Autosubmit is off (no crontab entry found).",
      "Turn it on with `npx ccgather autosubmit on`.",
    ]);
  });
});

describe("formatStatus", () => {
  const status: AutosubmitStatus = {
    registered: true,
    mechanism: 'Task Scheduler task "ccgather-autosubmit"',
    time: { hour: 9, minute: 5 },
    argv: [
      String.raw`C:\Program Files\nodejs\node.exe`,
      String.raw`C:\gone\npx-cli.js`,
      "--yes",
      "ccgather@2.1.1",
      "submit",
      "--scheduled",
    ],
    state: "Ready",
    lastRun: "10/7/2026 9:05:01 AM",
    lastResult: "0 (success)",
    nextRun: "10/8/2026 9:05:00 AM",
    log: String.raw`C:\Users\alice\AppData\Local\ccgather\autosubmit.log`,
    lastLogLine: "[2026-10-07T13:05:02.000Z] ccgather: Submitted 1.00K tokens.",
  };

  it("lists the command, flags missing paths and says how to repair", () => {
    const exists = (file: string) => file === String.raw`C:\Program Files\nodejs\node.exe`;
    expect(formatStatus(status, exists)).toEqual([
      'Autosubmit is on: Task Scheduler task "ccgather-autosubmit" every day at 09:05.',
      String.raw`Runs: "C:\Program Files\nodejs\node.exe" C:\gone\npx-cli.js --yes ccgather@2.1.1 submit --scheduled`,
      String.raw`Missing: C:\gone\npx-cli.js`,
      "Run `npx ccgather autosubmit on` again to repair.",
      "State: Ready",
      "Last run: 10/7/2026 9:05:01 AM",
      "Last result: 0 (success)",
      "Next run: 10/8/2026 9:05:00 AM",
      String.raw`Log: C:\Users\alice\AppData\Local\ccgather\autosubmit.log`,
      "Last log line: [2026-10-07T13:05:02.000Z] ccgather: Submitted 1.00K tokens.",
    ]);
  });

  it("does not ask to repair when every path exists", () => {
    const lines = formatStatus(status, () => true);
    expect(lines.some((line) => line.startsWith("Missing:"))).toBe(false);
    expect(lines).not.toContain("Run `npx ccgather autosubmit on` again to repair.");
  });

  it("asks to repair when the command cannot be read", () => {
    expect(formatStatus({ ...status, argv: undefined }, () => true)).toContain(
      "Could not read the command it runs. Run `npx ccgather autosubmit on` again to repair."
    );
  });
});

describe("Settings menu entry", () => {
  let logs: string[];
  let errors: string[];

  beforeEach(() => {
    mocked.store.clear();
    mocked.store.set("apiToken", "test-token");
    mocked.store.set("autoSync", false);
    logs = [];
    errors = [];
    vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      logs.push(args.join(" "));
    });
    vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      errors.push(args.join(" "));
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("is labelled on, with its time, when the scheduler has the job", async () => {
    const backend = fakeBackend({ registered: true, time: { hour: 14, minute: 23 } });
    expect(await autosubmitSettingsState({ backend })).toEqual({
      label: "Autosubmit: on, every day at 14:23",
      on: true,
    });
  });

  it("is labelled off when the scheduler has no job", async () => {
    expect(await autosubmitSettingsState({ backend: fakeBackend() })).toEqual({
      label: "Autosubmit: off",
      on: false,
    });
  });

  it("says so when the scheduler cannot be read", async () => {
    const backend = fakeBackend();
    backend.status.mockRejectedValue(new Error("schtasks failed"));
    expect(await autosubmitSettingsState({ backend })).toEqual({
      label: "Autosubmit: could not read the OS scheduler",
      on: false,
    });
  });

  it("is left out on a platform autosubmit does not support", async () => {
    expect(await autosubmitSettingsState({ platform: "freebsd" })).toBeNull();
  });

  it("turns autosubmit on exactly as `autosubmit on` when it is off", async () => {
    const backend = fakeBackend();
    const ok = await toggleAutosubmit(false, {
      backend,
      resolveDeps: fakeDeps(),
      now: () => new Date(2026, 9, 11, 14, 17, 42),
    });
    expect(ok).toBe(true);
    expect(backend.enable).toHaveBeenCalledWith(
      expect.objectContaining({ time: { hour: 14, minute: 23 } })
    );
    expect(mocked.store.get("autoSync")).toBe(true);
    expect(logs[0]).toMatch(/^Autosubmit is on\. Runs every day at 14:23, your local time\. /);
  });

  it("turns autosubmit off exactly as `autosubmit off` when it is on", async () => {
    mocked.store.set("autoSync", true);
    const backend = fakeBackend({ registered: true, time: { hour: 14, minute: 23 } });
    const ok = await toggleAutosubmit(true, { backend, resolveDeps: fakeDeps() });
    expect(ok).toBe(true);
    expect(backend.disable).toHaveBeenCalledTimes(1);
    expect(backend.enable).not.toHaveBeenCalled();
    expect(mocked.store.get("autoSync")).toBe(false);
    expect(logs).toEqual(["Autosubmit is off; the scheduled job was removed."]);
  });

  it("prints one line and does not throw when the toggle fails", async () => {
    const backend = fakeBackend();
    backend.enable.mockRejectedValue(new Error("crontab is not available"));
    const exit = vi.spyOn(process, "exit");
    const ok = await toggleAutosubmit(false, { backend, resolveDeps: fakeDeps() });
    expect(ok).toBe(false);
    expect(errors).toEqual(["ccgather autosubmit: crontab is not available"]);
    expect(exit).not.toHaveBeenCalled();
  });
});

describe("autosubmit on: wording and the star prompt", () => {
  const ELIGIBLE = "2026-10-10T08:00:00.000Z";
  let logs: string[];
  let errors: string[];

  function globalDeps(): ResolveDeps {
    const pkg = "/usr/lib/node_modules/ccgather";
    const entry = `${pkg}/dist/index.js`;
    const files = new Set([NODE, NPX, pkg, entry]);
    return {
      ...fakeDeps(),
      packageRoot: pkg,
      globalRoot: async () => "/usr/lib/node_modules",
      exists: (file) => files.has(file),
      realpath: (file) => (files.has(file) ? file : null),
    };
  }

  // A prompt that remembers what had been printed when it was called
  function fakePrompt() {
    const seen: string[][] = [];
    const prompt = vi.fn(async () => {
      seen.push([...logs]);
    });
    return { prompt, seen };
  }

  beforeEach(() => {
    mocked.store.clear();
    mocked.store.set("apiToken", "test-token");
    mocked.store.set("autoSync", false);
    mocked.realPrompt.mockClear();
    logs = [];
    errors = [];
    vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      logs.push(args.join(" "));
    });
    vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      errors.push(args.join(" "));
    });
  });

  afterEach(() => {
    expect(mocked.realPrompt).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it("says a run is skipped within 20 hours of a submit, in the first line", async () => {
    await autosubmitEnable(
      {},
      {
        backend: fakeBackend(),
        resolveDeps: fakeDeps(),
        now: () => new Date(2026, 9, 11, 14, 17, 42),
        isTTY: false,
      }
    );
    expect(logs[0]).toBe(
      "Autosubmit is on. Runs every day at 14:23, your local time. A run is skipped if you submitted in the 20 hours before it, so the first one may be."
    );
  });

  it("suggests a global install when the job is pinned to a version through npx", async () => {
    await autosubmitEnable(
      {},
      { backend: fakeBackend(), resolveDeps: { ...fakeDeps(), version: "2.2.0" }, isTTY: false }
    );
    expect(logs[1]).toBe(
      "It uses ccgather@2.2.0 via npx and stays on that version. To have it follow upgrades, install ccgather globally (`npm install -g ccgather`) and run `ccgather autosubmit on` again."
    );
  });

  it("leaves the lines for a global install and for ccgather@latest as they were", async () => {
    await autosubmitEnable({}, { backend: fakeBackend(), resolveDeps: globalDeps(), isTTY: false });
    expect(logs[1]).toBe("It uses your global install of ccgather.");

    logs.length = 0;
    await autosubmitEnable(
      { autoUpdate: true },
      { backend: fakeBackend(), resolveDeps: fakeDeps(), isTTY: false }
    );
    expect(logs[1]).toBe("It uses the newest ccgather release each day, via npx.");
  });

  it("offers the star prompt after the last output line when eligible", async () => {
    mocked.store.set("lastSync", ELIGIBLE);
    const { prompt, seen } = fakePrompt();
    await autosubmitEnable(
      {},
      { backend: fakeBackend(), resolveDeps: fakeDeps(), isTTY: true, promptStar: prompt }
    );
    expect(prompt).toHaveBeenCalledTimes(1);
    expect(seen[0]).toEqual(logs);
    expect(logs.at(-1)).toBe("A note.");
  });

  it("does not offer it once the star is confirmed", async () => {
    mocked.store.set("lastSync", ELIGIBLE);
    mocked.store.set("starConfirmed", true);
    const { prompt } = fakePrompt();
    await autosubmitEnable(
      {},
      { backend: fakeBackend(), resolveDeps: fakeDeps(), isTTY: true, promptStar: prompt }
    );
    expect(prompt).not.toHaveBeenCalled();
  });

  it("does not offer it before the first submit", async () => {
    const { prompt } = fakePrompt();
    await autosubmitEnable(
      {},
      { backend: fakeBackend(), resolveDeps: fakeDeps(), isTTY: true, promptStar: prompt }
    );
    expect(prompt).not.toHaveBeenCalled();
  });

  it("does not offer it without a terminal", async () => {
    mocked.store.set("lastSync", ELIGIBLE);
    const { prompt } = fakePrompt();
    await autosubmitEnable(
      {},
      { backend: fakeBackend(), resolveDeps: fakeDeps(), isTTY: false, promptStar: prompt }
    );
    expect(prompt).not.toHaveBeenCalled();
  });

  it("never offers it on off or on status", async () => {
    mocked.store.set("lastSync", ELIGIBLE);
    const { prompt } = fakePrompt();
    const backend = fakeBackend({ registered: true, time: { hour: 14, minute: 23 } });
    await autosubmitOff({ backend, isTTY: true, promptStar: prompt });
    await autosubmitStatus({ backend, isTTY: true, promptStar: prompt });
    expect(prompt).not.toHaveBeenCalled();
  });

  it("does not offer it when enabling fails", async () => {
    mocked.store.set("lastSync", ELIGIBLE);
    const { prompt } = fakePrompt();
    const backend = fakeBackend();
    backend.enable.mockRejectedValue(new Error("crontab is not available"));
    await expect(
      autosubmitEnable({}, { backend, resolveDeps: fakeDeps(), isTTY: true, promptStar: prompt })
    ).rejects.toThrow("crontab is not available");
    expect(prompt).not.toHaveBeenCalled();
  });

  it("does not fail the command when the prompt throws", async () => {
    mocked.store.set("lastSync", ELIGIBLE);
    const prompt = vi.fn(async () => {
      throw new Error("prompt blew up");
    });
    const context = {
      backend: fakeBackend(),
      resolveDeps: fakeDeps(),
      isTTY: true,
      promptStar: prompt,
    };
    await expect(autosubmitEnable({}, context)).resolves.toBeUndefined();
    expect(prompt).toHaveBeenCalledTimes(1);
    expect(mocked.store.get("autoSync")).toBe(true);

    expect(await toggleAutosubmit(false, context)).toBe(true);
    expect(errors).toEqual([]);
  });

  it("asks when the Settings toggle turns it on, not when it turns it off", async () => {
    mocked.store.set("lastSync", ELIGIBLE);
    const { prompt } = fakePrompt();
    await toggleAutosubmit(false, {
      backend: fakeBackend(),
      resolveDeps: fakeDeps(),
      isTTY: true,
      promptStar: prompt,
    });
    expect(prompt).toHaveBeenCalledTimes(1);

    await toggleAutosubmit(true, {
      backend: fakeBackend({ registered: true, time: { hour: 14, minute: 23 } }),
      resolveDeps: fakeDeps(),
      isTTY: true,
      promptStar: prompt,
    });
    expect(prompt).toHaveBeenCalledTimes(1);
  });
});

describe("status: last outcome", () => {
  const base: AutosubmitStatus = {
    registered: true,
    mechanism: "crontab entry",
    time: { hour: 14, minute: 7 },
    argv: [
      "/usr/bin/node",
      "/usr/lib/npx-cli.js",
      "--yes",
      "ccgather@2.2.0",
      "submit",
      "--scheduled",
    ],
    nextRun: "Thu 2026-10-08 14:07:00 EDT",
    log: "/home/alice/.local/state/ccgather/autosubmit.log",
  };
  const outcome = {
    at: new Date(2026, 9, 11, 14, 23, 5).toISOString(),
    ok: true,
    message: "Skipped: submitted 10 minutes ago.",
  };
  const OUTCOME_LINE = "Last outcome (2026-10-11 14:23): Skipped: submitted 10 minutes ago.";
  const exists = () => true;

  it("names the scheduler in the first line, for the systemd timer and for cron", () => {
    expect(
      formatStatus(
        { ...base, mechanism: "systemd user timer ccgather-autosubmit.timer" },
        exists
      )[0]
    ).toBe("Autosubmit is on: systemd user timer ccgather-autosubmit.timer every day at 14:07.");
    expect(formatStatus(base, exists)[0]).toBe(
      "Autosubmit is on: crontab entry every day at 14:07."
    );
  });

  it("shows the outcome after the last result and before the next run", () => {
    const lines = formatStatus({ ...base, lastResult: "0 (success)" }, exists, outcome);
    expect(lines).toContain(OUTCOME_LINE);
    expect(lines.indexOf(OUTCOME_LINE)).toBe(lines.indexOf("Last result: 0 (success)") + 1);
    expect(lines.indexOf(OUTCOME_LINE)).toBe(
      lines.indexOf("Next run: Thu 2026-10-08 14:07:00 EDT") - 1
    );
  });

  it("leaves the last log line out when it ends with the same message", () => {
    const lines = formatStatus(
      {
        ...base,
        lastLogLine: "[2026-10-11T18:23:05.000Z] ccgather: Skipped: submitted 10 minutes ago.",
      },
      exists,
      outcome
    );
    expect(lines).toContain(OUTCOME_LINE);
    expect(lines.some((line) => line.startsWith("Last log line:"))).toBe(false);
  });

  it("keeps the last log line when it says something else, such as a crash", () => {
    const lines = formatStatus(
      { ...base, lastLogLine: "node: command not found" },
      exists,
      outcome
    );
    expect(lines).toContain(OUTCOME_LINE);
    expect(lines).toContain("Last log line: node: command not found");
  });

  it("shows no outcome when the job is off or nothing was recorded", () => {
    expect(
      formatStatus(
        { registered: false, mechanism: "crontab entry", log: "x" },
        exists,
        outcome
      ).some((line) => line.startsWith("Last outcome"))
    ).toBe(false);
    expect(formatStatus(base, exists).some((line) => line.startsWith("Last outcome"))).toBe(false);
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

    it("takes the record from the context", async () => {
      mocked.store.set("lastScheduledRun", { ...outcome, message: "from config" });
      await autosubmitStatus({ backend: fakeBackend(base), lastScheduledRun: outcome });
      expect(logs).toContain(OUTCOME_LINE);
    });

    it("reads it from config when the context has none", async () => {
      mocked.store.set("lastScheduledRun", outcome);
      await autosubmitStatus({ backend: fakeBackend(base) });
      expect(logs).toContain(OUTCOME_LINE);
    });
  });
});
