/**
 * `ccgather autosubmit` command handlers, against a fake backend and a fake
 * conf store: login refusal, time choice, messages, and the autoSync flag.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mocked = vi.hoisted(() => ({
  store: new Map<string, unknown>(),
}));

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
      "Autosubmit is on. Runs every day at 14:23, your local time.",
      "It uses ccgather@2.1.1 via npx; to move to a newer release, run `npx ccgather@latest autosubmit on`.",
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
    expect(logs[0]).toBe("Autosubmit is on. Runs every day at 07:05, your local time.");
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
    expect(logs[0]).toBe("Autosubmit is on. Runs every day at 14:23, your local time.");
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
