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
  autosubmitStatus,
  formatStatus,
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

  it("enables at a random time, sets autoSync and prints where the log is", async () => {
    const backend = fakeBackend();
    await autosubmitEnable({}, { backend, resolveDeps: fakeDeps(), random: () => 0.5 });

    expect(backend.enable).toHaveBeenCalledWith(
      expect.objectContaining({
        command: {
          argv: [NODE, NPX, "--yes", "ccgather@2.1.1", "submit", "--scheduled"],
          kind: "npx",
          spec: "ccgather@2.1.1",
        },
        time: { hour: 15, minute: 30 },
      })
    );
    expect(mocked.store.get("autoSync")).toBe(true);
    expect(logs).toEqual([
      "Autosubmit is on: it submits your usage every day at 15:30 with ccgather@2.1.1 via npx; to move to a newer release, run `npx ccgather@latest autosubmit`.",
      "Log: /home/alice/autosubmit.log. Turn it off with `npx ccgather autosubmit off`; check it with `npx ccgather autosubmit status`.",
      "A note.",
    ]);
  });

  it("uses --time and warns plainly about --auto-update", async () => {
    const backend = fakeBackend();
    await autosubmitEnable(
      { time: "07:05", autoUpdate: true },
      { backend, resolveDeps: fakeDeps() }
    );
    expect(backend.status).not.toHaveBeenCalled();
    expect(backend.enable).toHaveBeenCalledWith(
      expect.objectContaining({ time: { hour: 7, minute: 5 } })
    );
    expect(logs[0]).toContain("the newest ccgather release each day");
    expect(logs).toContain(
      "--auto-update: each day it runs whatever ccgather release is newest that day, with access to your token."
    );
  });

  it("keeps the registered time when re-run without --time", async () => {
    const backend = fakeBackend({ registered: true, time: { hour: 20, minute: 15 } });
    await autosubmitEnable({}, { backend, resolveDeps: fakeDeps(), random: () => 0 });
    expect(backend.enable).toHaveBeenCalledWith(
      expect.objectContaining({ time: { hour: 20, minute: 15 } })
    );
  });

  it("refuses a malformed --time", async () => {
    const backend = fakeBackend();
    await expect(
      autosubmitEnable({ time: "9pm" }, { backend, resolveDeps: fakeDeps() })
    ).rejects.toThrow("--time must be HH:MM");
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
      "Turn it on with `npx ccgather autosubmit`.",
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
      "Run `npx ccgather autosubmit` again to repair.",
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
    expect(lines).not.toContain("Run `npx ccgather autosubmit` again to repair.");
  });

  it("asks to repair when the command cannot be read", () => {
    expect(formatStatus({ ...status, argv: undefined }, () => true)).toContain(
      "Could not read the command it runs. Run `npx ccgather autosubmit` again to repair."
    );
  });
});
