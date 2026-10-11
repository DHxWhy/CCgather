/**
 * The Settings menu's autosubmit entry, driven through the real menu in
 * `index.ts` with inquirer mocked: the entry shows the scheduler's state,
 * choosing it toggles autosubmit, the menu comes back with the new state, and an
 * unsupported platform has no entry.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

interface Choice {
  name: string;
  value: string;
}

// colors.white is chalk.visible, which prints nothing when colour is off (as it
// is under a test runner), so switch colour on before chalk loads
vi.hoisted(() => {
  process.env.FORCE_COLOR = "1";
});

const mocked = vi.hoisted(() => ({
  state: null as { label: string; on: boolean } | null,
  settingsState: vi.fn(),
  toggle: vi.fn(),
  prompt: vi.fn(),
}));

vi.mock("../src/commands/autosubmit", () => ({
  autosubmitEnable: vi.fn(async () => undefined),
  autosubmitOff: vi.fn(async () => undefined),
  autosubmitStatus: vi.fn(async () => undefined),
  autosubmitSettingsState: mocked.settingsState,
  toggleAutosubmit: mocked.toggle,
}));

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
  getConfig: () => ({ get: () => undefined, set: () => {}, delete: () => {} }),
  getApiUrl: () => "https://ccgather.test/api",
  isAuthenticated: () => true,
}));
vi.mock("../src/lib/api", () => ({
  // A network error: the menu carries on without the welcome box
  getStatus: vi.fn(async () => {
    throw new Error("blocked in tests");
  }),
}));
vi.mock("open", () => ({ default: vi.fn(async () => undefined) }));

describe("Settings menu: autosubmit entry", () => {
  const originalArgv = process.argv;
  // The choices handed to each Settings prompt, in order
  let settingsChoices: Choice[][];
  // What the user picks in the Settings prompt, in order
  let picks: string[];
  let mainMenuPrompts: number;

  async function runCli(): Promise<void> {
    process.argv = ["node", "ccgather"];
    await import("../src/index");
  }

  function autosubmitEntries(choices: Choice[]): Choice[] {
    return choices.filter((choice) => choice.value === "autosubmit");
  }

  beforeEach(() => {
    // index.ts parses argv on import, so each test needs a fresh module
    vi.resetModules();
    settingsChoices = [];
    picks = [];
    mainMenuPrompts = 0;

    mocked.state = { label: "Autosubmit: off", on: false };
    mocked.settingsState.mockReset();
    mocked.settingsState.mockImplementation(async () => mocked.state);
    mocked.toggle.mockReset();
    mocked.toggle.mockImplementation(async (on: boolean) => {
      mocked.state = on
        ? { label: "Autosubmit: off", on: false }
        : { label: "Autosubmit: on, every day at 14:23", on: true };
      return true;
    });

    mocked.prompt.mockReset();
    mocked.prompt.mockImplementation(async (questions: unknown) => {
      const [question] = questions as { name: string; choices?: Choice[] }[];
      if (question.name === "action") {
        mainMenuPrompts += 1;
        // First visit: open Settings. After Back the run ends on an empty answer
        return mainMenuPrompts === 1 ? { action: "settings" } : {};
      }
      if (question.name === "settingsAction") {
        settingsChoices.push([...(question.choices ?? [])]);
        const pick = picks.shift();
        if (!pick) throw new Error("no pick left for the Settings prompt");
        return { settingsAction: pick };
      }
      throw new Error(`unexpected prompt ${question.name}`);
    });

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("blocked in tests", { status: 503 }))
    );
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);
  });

  afterEach(() => {
    process.argv = originalArgv;
    process.exitCode = undefined;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("shows the state, toggles it on and off, and comes back with the new state", async () => {
    picks = ["autosubmit", "autosubmit", "back"];

    await runCli();
    await vi.waitFor(() => expect(mainMenuPrompts).toBe(2));

    expect(settingsChoices).toHaveLength(3);

    // 1. Off: one entry, offering to turn it on
    const [first] = autosubmitEntries(settingsChoices[0]);
    expect(autosubmitEntries(settingsChoices[0])).toHaveLength(1);
    expect(first.name).toContain("Autosubmit: off");
    expect(first.name).toContain("select to turn it on");

    // 2. Choosing it turned autosubmit on, once, and the menu came back as on
    expect(mocked.toggle).toHaveBeenNthCalledWith(1, false);
    const [second] = autosubmitEntries(settingsChoices[1]);
    expect(autosubmitEntries(settingsChoices[1])).toHaveLength(1);
    expect(second.name).toContain("Autosubmit: on, every day at 14:23");
    expect(second.name).toContain("select to turn it off");

    // 3. Choosing it again turned it off, once; Back then ended the run
    expect(mocked.toggle).toHaveBeenNthCalledWith(2, true);
    expect(mocked.toggle).toHaveBeenCalledTimes(2);
    const [third] = autosubmitEntries(settingsChoices[2]);
    expect(third.name).toContain("Autosubmit: off");
    expect(picks).toEqual([]);
  });

  it("has no autosubmit entry on an unsupported platform", async () => {
    mocked.state = null;
    picks = ["back"];

    await runCli();
    await vi.waitFor(() => expect(mainMenuPrompts).toBe(2));

    expect(settingsChoices).toHaveLength(1);
    const values = settingsChoices[0].map((choice) => choice.value);
    expect(values).toEqual(["auth", "back"]);
    expect(mocked.toggle).not.toHaveBeenCalled();
  });
});
