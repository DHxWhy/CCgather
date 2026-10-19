/**
 * The main menu's auto-submit item, driven through the real menu in `index.ts`
 * with inquirer mocked: it is the second item, its label comes from config and
 * never from the OS scheduler, choosing it turns auto-submit on (or, when it is
 * on, offers Change time, Turn off and Back), and the menu always comes back.
 *
 * Only the three scheduler backends are fakes; the command handlers are real.
 * The star prompt is a fake too (the real one stars a repository under the
 * machine's GitHub login), and every test says how many times it was asked.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { AutosubmitStatus } from "../src/lib/autosubmit/shared";

interface Choice {
  name: string;
  value: string;
}

interface Question {
  type: string;
  name: string;
  message: string;
  choices?: Choice[];
  validate?: (value: string) => true | string;
}

// colors.white is chalk.visible, which prints nothing when colour is off (as it
// is under a test runner), so switch colour on before chalk loads
vi.hoisted(() => {
  process.env.FORCE_COLOR = "1";
});

const mocked = vi.hoisted(() => {
  const NODE = "/usr/bin/node";
  const NPX = "/usr/lib/node_modules/npm/bin/npx-cli.js";
  return {
    store: new Map<string, unknown>(),
    prompt: vi.fn(),
    starPrompt: vi.fn(async () => undefined),
    backend: {
      enable: vi.fn(),
      disable: vi.fn(),
      status: vi.fn(),
    },
    deps: {
      platform: "linux" as NodeJS.Platform,
      execPath: NODE,
      packageRoot: null,
      globalRoot: async () => null,
      exists: (file: string) => file === NODE || file === NPX,
      realpath: (file: string) => (file === NODE || file === NPX ? file : null),
      pathEnv: "",
      version: "2.2.0",
    },
  };
});

vi.mock("../src/lib/autosubmit/windows", () => ({
  createWindowsBackend: () => mocked.backend,
}));
vi.mock("../src/lib/autosubmit/macos", () => ({ createMacosBackend: () => mocked.backend }));
vi.mock("../src/lib/autosubmit/linux", () => ({ createLinuxBackend: () => mocked.backend }));
vi.mock("../src/lib/autosubmit/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/autosubmit/shared")>();
  return { ...actual, defaultResolveDeps: () => mocked.deps };
});

vi.mock("../src/lib/star-nudge", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/star-nudge")>();
  return { ...actual, promptStarNudge: mocked.starPrompt };
});

vi.mock("../src/commands/submit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/commands/submit")>();
  return { ...actual, submit: vi.fn(async () => undefined) };
});

vi.mock("../src/lib/ui", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/ui")>();
  return {
    ...actual,
    printAnimatedHeader: vi.fn(async () => undefined),
    dotAnimation: vi.fn(async () => undefined),
  };
});

vi.mock("inquirer", () => ({ default: { prompt: mocked.prompt } }));

// The menu path must not read the real conf store (it holds the user's API
// token) or reach any server
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
vi.mock("../src/lib/api", () => ({
  // A network error: the menu carries on without the welcome box
  getStatus: vi.fn(async () => {
    throw new Error("blocked in tests");
  }),
  reportAutosubmit: vi.fn(async () => ({ success: true })),
}));
vi.mock("open", () => ({ default: vi.fn(async () => undefined) }));

const plain = (text: string): string => text.replace(/\u001B\[[0-9;]*m/g, "");

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

describe("main menu: auto-submit item", () => {
  const originalArgv = process.argv;
  const platform = Object.getOwnPropertyDescriptor(process, "platform");
  let stdoutTTY: PropertyDescriptor | undefined;
  let stdinTTY: PropertyDescriptor | undefined;

  // What the user picks, in order, in each prompt; an empty queue ends the run
  // with an empty answer
  let mainPicks: string[];
  let listPicks: string[];
  let timeInputs: string[];
  let settingsPicks: string[];
  // What each prompt was handed
  let mainChoices: Choice[][];
  let listQuestions: Question[];
  let timeQuestions: Question[];
  let settingsChoices: Choice[][];
  let mainPrompts: number;
  // How often the star prompt was asked, and how often the test expects it
  let starAsked: number;
  let starExpected: number;
  let logs: string[];
  let errors: string[];
  // The job as the fake scheduler has it
  let job: AutosubmitStatus;

  async function runCli(): Promise<void> {
    process.argv = ["node", "ccgather"];
    await import("../src/index");
  }

  const names = (choices: Choice[]): string[] => choices.map((choice) => plain(choice.name));
  const values = (choices: Choice[]): string[] => choices.map((choice) => choice.value);
  const autosubmitName = (visit: number): string => plain(mainChoices[visit][1].name);

  function storeOn(time?: string): void {
    mocked.store.set("autoSync", true);
    if (time) mocked.store.set("autoSyncTime", time);
  }

  async function untilMenu(visits: number): Promise<void> {
    await vi.waitFor(() => expect(mainPrompts).toBe(visits));
  }

  beforeEach(() => {
    // index.ts parses argv on import, so each test needs a fresh module
    vi.resetModules();
    mainPicks = [];
    listPicks = [];
    timeInputs = [];
    settingsPicks = [];
    mainChoices = [];
    listQuestions = [];
    timeQuestions = [];
    settingsChoices = [];
    mainPrompts = 0;
    starAsked = 0;
    starExpected = 0;
    logs = [];
    errors = [];

    mocked.store.clear();
    mocked.store.set("apiToken", "test-token");
    mocked.store.set("autoSync", false);

    job = {
      registered: false,
      scheduler: "systemd user timer",
      log: "/home/alice/autosubmit.log",
    };
    mocked.backend.status.mockReset();
    mocked.backend.status.mockImplementation(async () => ({ ...job }));
    mocked.backend.enable.mockReset();
    mocked.backend.enable.mockImplementation(
      async (plan: { time: { hour: number; minute: number }; command: { argv: string[] } }) => {
        job = { ...job, registered: true, time: plan.time, argv: plan.command.argv };
        return { scheduler: "systemd user timer", notes: [] };
      }
    );
    mocked.backend.disable.mockReset();
    mocked.backend.disable.mockImplementation(async () => {
      job = { ...job, registered: false, time: undefined, argv: undefined };
      return true;
    });

    mocked.starPrompt.mockReset();
    mocked.starPrompt.mockImplementation(async () => {
      starAsked += 1;
    });

    mocked.prompt.mockReset();
    mocked.prompt.mockImplementation(async (questions: unknown) => {
      const [question] = questions as Question[];
      if (question.name === "action") {
        mainPrompts += 1;
        mainChoices.push([...(question.choices ?? [])]);
        const pick = mainPicks.shift();
        return pick ? { action: pick } : {};
      }
      if (question.name === "autosubmitAction") {
        listQuestions.push(question);
        const pick = listPicks.shift();
        if (!pick) throw new Error("no pick left for the Auto-submit list");
        return { autosubmitAction: pick };
      }
      if (question.name === "newTime") {
        timeQuestions.push(question);
        const input = timeInputs.shift();
        if (!input) throw new Error("no input left for the new time");
        return { newTime: input };
      }
      if (question.name === "settingsAction") {
        settingsChoices.push([...(question.choices ?? [])]);
        return { settingsAction: settingsPicks.shift() ?? "back" };
      }
      throw new Error(`unexpected prompt ${question.name}`);
    });

    stdoutTTY = Object.getOwnPropertyDescriptor(process.stdout, "isTTY");
    stdinTTY = Object.getOwnPropertyDescriptor(process.stdin, "isTTY");

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("blocked in tests", { status: 503 }))
    );
    vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      // The menu prints a blank line before acting on a choice
      const line = plain(args.join(" "));
      if (line) logs.push(line);
    });
    vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      errors.push(plain(args.join(" ")));
    });
    vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);
  });

  afterEach(() => {
    expect(starAsked).toBe(starExpected);
    process.argv = originalArgv;
    process.exitCode = undefined;
    if (platform) Object.defineProperty(process, "platform", platform);
    restoreTTY(process.stdout, stdoutTTY);
    restoreTTY(process.stdin, stdinTTY);
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("is the second item, right under Submit usage data, and reads OFF", async () => {
    await runCli();
    await untilMenu(1);

    expect(values(mainChoices[0])).toEqual(["submit", "autosubmit", "leaderboard", "settings"]);
    expect(names(mainChoices[0])[0]).toBe("📤  Submit usage data");
    expect(autosubmitName(0)).toBe("🔁  Auto-submit: OFF");
  });

  it("reads ON with its time when config says it is on", async () => {
    storeOn("14:23");
    await runCli();
    await untilMenu(1);
    expect(autosubmitName(0)).toBe("🔁  Auto-submit: ON · daily 14:23");
  });

  it.each([
    ["off", () => undefined],
    ["on", () => storeOn("14:23")],
  ])("drawing the menu (%s) does not ask the scheduler anything", async (_state, arrange) => {
    arrange();
    await runCli();
    await untilMenu(1);
    expect(mocked.backend.status).not.toHaveBeenCalled();
    expect(mocked.backend.enable).not.toHaveBeenCalled();
    expect(mocked.backend.disable).not.toHaveBeenCalled();
  });

  it("choosing it when off turns auto-submit on, then returns to the menu showing ON", async () => {
    mainPicks = ["autosubmit"];
    await runCli();
    await untilMenu(2);

    expect(listQuestions).toEqual([]);
    expect(mocked.backend.enable).toHaveBeenCalledTimes(1);
    const { time } = mocked.backend.enable.mock.calls[0][0] as {
      time: { hour: number; minute: number };
    };
    const at = `${String(time.hour).padStart(2, "0")}:${String(time.minute).padStart(2, "0")}`;
    expect(mocked.store.get("autoSync")).toBe(true);
    expect(mocked.store.get("autoSyncTime")).toBe(at);
    expect(logs).toContain("✔ Auto-submit is on.");
    expect(autosubmitName(0)).toBe("🔁  Auto-submit: OFF");
    expect(autosubmitName(1)).toBe(`🔁  Auto-submit: ON · daily ${at}`);
  });

  it("choosing it when config says off but the scheduler has the job takes the already-on path", async () => {
    job = { ...job, registered: true, time: { hour: 20, minute: 15 }, argv: undefined };
    mainPicks = ["autosubmit"];
    await runCli();
    await untilMenu(2);

    expect(logs[0]).toBe(
      "Auto-submit is already on (daily 20:15). Use --at HH:MM to change the time."
    );
    expect(mocked.store.get("autoSync")).toBe(true);
    expect(autosubmitName(1)).toBe("🔁  Auto-submit: ON · daily 20:15");
  });

  it("choosing it when on offers Change time, Turn off and Back, and Back changes nothing", async () => {
    storeOn("14:23");
    mainPicks = ["autosubmit"];
    listPicks = ["back"];
    await runCli();
    await untilMenu(2);

    expect(listQuestions).toHaveLength(1);
    expect(listQuestions[0].type).toBe("list");
    expect(listQuestions[0].message).toBe("Auto-submit");
    expect(names(listQuestions[0].choices ?? [])).toEqual(["Change time", "Turn off", "Back"]);
    expect(mocked.backend.status).not.toHaveBeenCalled();
    expect(mocked.backend.enable).not.toHaveBeenCalled();
    expect(mocked.backend.disable).not.toHaveBeenCalled();
    expect(autosubmitName(1)).toBe("🔁  Auto-submit: ON · daily 14:23");
  });

  it("Change time asks for HH:MM, re-registers at it and returns, with no star prompt", async () => {
    // A terminal and an account that has not starred: the one place a prompt
    // could wrongly appear
    setTTY(process.stdout);
    setTTY(process.stdin);
    storeOn("14:23");
    job = { ...job, registered: true, time: { hour: 14, minute: 23 } };
    mainPicks = ["autosubmit"];
    listPicks = ["time"];
    timeInputs = ["21:30"];
    await runCli();
    await untilMenu(2);

    expect(timeQuestions).toHaveLength(1);
    expect(timeQuestions[0].type).toBe("input");
    expect(timeQuestions[0].message).toBe("New time (HH:MM, 24-hour):");
    const validate = timeQuestions[0].validate!;
    expect(validate("21:30")).toBe(true);
    expect(validate("7:05")).toBe(true);
    for (const bad of ["25:00", "9pm", "12:60", ""]) {
      expect(validate(bad), bad).not.toBe(true);
    }

    expect(mocked.backend.enable).toHaveBeenCalledTimes(1);
    expect(mocked.backend.enable).toHaveBeenCalledWith(
      expect.objectContaining({ time: { hour: 21, minute: 30 } })
    );
    expect(logs).toEqual(["✔ Auto-submit now runs every day at 21:30 (your local time)."]);
    expect(mocked.store.get("autoSyncTime")).toBe("21:30");
    expect(autosubmitName(1)).toBe("🔁  Auto-submit: ON · daily 21:30");
  });

  it("Turn off removes the job, clears config and returns showing OFF, with no star prompt", async () => {
    setTTY(process.stdout);
    setTTY(process.stdin);
    storeOn("14:23");
    job = { ...job, registered: true, time: { hour: 14, minute: 23 } };
    mainPicks = ["autosubmit"];
    listPicks = ["off"];
    await runCli();
    await untilMenu(2);

    expect(mocked.backend.disable).toHaveBeenCalledTimes(1);
    expect(logs).toEqual(["✔ Auto-submit is off. The daily job was removed."]);
    expect(mocked.store.get("autoSync")).toBe(false);
    expect(mocked.store.has("autoSyncTime")).toBe(false);
    expect(autosubmitName(1)).toBe("🔁  Auto-submit: OFF");
  });

  // The scheduler has lost the job although config says on: Change time then
  // registers it afresh, which is still not the moment the star prompt is for
  describe("when config says on but the scheduler has no job", () => {
    beforeEach(() => {
      setTTY(process.stdout);
      setTTY(process.stdin);
      storeOn("14:23");
    });

    it("Change time registers the job and does not offer the star prompt", async () => {
      mainPicks = ["autosubmit"];
      listPicks = ["time"];
      timeInputs = ["21:30"];
      await runCli();
      await untilMenu(2);

      expect(mocked.backend.enable).toHaveBeenCalledTimes(1);
      expect(job.registered).toBe(true);
      expect(logs).toContain("✔ Auto-submit is on.");
    });

    // Control: the same setup through the OFF item does offer it
    it("the OFF item, on the same setup, does offer it", async () => {
      starExpected = 1;
      mocked.store.set("autoSync", false);
      mainPicks = ["autosubmit"];
      await runCli();
      await untilMenu(2);

      expect(mocked.backend.enable).toHaveBeenCalledTimes(1);
      expect(starAsked).toBe(1);
    });
  });

  it("is left out on a platform auto-submit does not support", async () => {
    Object.defineProperty(process, "platform", { value: "freebsd", configurable: true });
    await runCli();
    await untilMenu(1);
    expect(values(mainChoices[0])).toEqual(["submit", "leaderboard", "settings"]);
  });

  it("a failing turn-on prints its lines and returns to the menu", async () => {
    mocked.backend.enable.mockRejectedValue(new Error("boom"));
    mainPicks = ["autosubmit"];
    await runCli();
    await untilMenu(2);

    expect(errors).toEqual(["✖ Could not register: boom"]);
    expect(process.exitCode).toBeUndefined();
    expect(mocked.store.get("autoSync")).toBe(false);
    expect(autosubmitName(1)).toBe("🔁  Auto-submit: OFF");
  });

  it("a failing Turn off prints its line and returns to the menu still showing ON", async () => {
    storeOn("14:23");
    mocked.backend.disable.mockRejectedValue(new Error("Access is denied"));
    mainPicks = ["autosubmit"];
    listPicks = ["off"];
    await runCli();
    await untilMenu(2);

    expect(errors).toEqual(["✖ Could not turn auto-submit off: Access is denied"]);
    expect(process.exitCode).toBeUndefined();
    expect(autosubmitName(1)).toBe("🔁  Auto-submit: ON · daily 14:23");
  });

  it("turning it on from the menu offers the star prompt, once the schedule is registered", async () => {
    setTTY(process.stdout);
    setTTY(process.stdin);
    starExpected = 1;
    let registeredWhenAsked = -1;
    mocked.starPrompt.mockImplementation(async () => {
      starAsked += 1;
      registeredWhenAsked = mocked.backend.enable.mock.calls.length;
    });
    mainPicks = ["autosubmit"];
    await runCli();
    await untilMenu(2);
    expect(starAsked).toBe(1);
    expect(registeredWhenAsked).toBe(1);
  });

  it("does not offer the star prompt from the menu once the account has starred", async () => {
    setTTY(process.stdout);
    setTTY(process.stdin);
    mocked.store.set("starConfirmed", true);
    mainPicks = ["autosubmit"];
    await runCli();
    await untilMenu(2);
    expect(mocked.backend.enable).toHaveBeenCalledTimes(1);
  });

  it("Settings no longer has an auto-submit entry", async () => {
    mainPicks = ["settings"];
    settingsPicks = ["back"];
    await runCli();
    await untilMenu(2);

    expect(settingsChoices).toHaveLength(1);
    expect(values(settingsChoices[0])).toEqual(["auth", "back"]);
  });
});
