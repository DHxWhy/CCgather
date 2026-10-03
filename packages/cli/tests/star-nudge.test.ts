import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import Conf from "conf";
import type { CliConfig } from "../src/lib/config";

const prompt = vi.hoisted(() => ({ answer: "n", questions: [] as string[] }));

vi.mock("readline", async (importOriginal) => {
  const actual = await importOriginal<typeof import("readline")>();
  return {
    ...actual,
    createInterface: () => ({
      on: () => {},
      close: () => {},
      question: (question: string, callback: (answer: string) => void) => {
        prompt.questions.push(question);
        callback(prompt.answer);
      },
    }),
  };
});

// Accepting must never reach the real gh CLI or a browser from a test run.
vi.mock("child_process", async (importOriginal) => {
  const actual = await importOriginal<typeof import("child_process")>();
  return {
    ...actual,
    execFileSync: vi.fn(() => {
      throw new Error("gh is blocked in tests");
    }),
  };
});
vi.mock("open", () => ({ default: vi.fn(async () => undefined) }));

import { execFileSync } from "child_process";
import {
  shouldPromptStar,
  shouldRequestStarStatus,
  takeStarPromptTurn,
  promptStarNudge,
  STAR_PROMPT_MESSAGES,
  STAR_REPROMPT_INTERVAL,
  type StarPromptState,
} from "../src/lib/star-nudge";

function makeState(overrides: Partial<StarPromptState> = {}): StarPromptState {
  return {
    hasStarred: null,
    isTTY: true,
    hasSubmittedBefore: true,
    ...overrides,
  };
}

describe("shouldPromptStar", () => {
  it("prompts a returning submitter whose star status is unknown", () => {
    expect(shouldPromptStar(makeState({ hasStarred: null }))).toBe(true);
    expect(shouldPromptStar(makeState({ hasStarred: undefined }))).toBe(true);
  });

  it("prompts a returning submitter who has not starred", () => {
    expect(shouldPromptStar(makeState({ hasStarred: false }))).toBe(true);
  });

  it("stays eligible on every submit while not starred", () => {
    const state = makeState({ hasStarred: false });
    expect(shouldPromptStar(state)).toBe(true);
    expect(shouldPromptStar(state)).toBe(true);
    expect(shouldPromptStar(state)).toBe(true);
  });

  it("stays quiet on the very first submit", () => {
    expect(shouldPromptStar(makeState({ hasSubmittedBefore: false }))).toBe(false);
    expect(shouldPromptStar(makeState({ hasSubmittedBefore: false, hasStarred: false }))).toBe(
      false
    );
  });

  it("never prompts when the server confirmed a star", () => {
    expect(shouldPromptStar(makeState({ hasStarred: true }))).toBe(false);
  });

  it("never prompts once starConfirmed is cached locally, even when the server was not asked", () => {
    expect(shouldPromptStar(makeState({ starConfirmed: true, hasStarred: undefined }))).toBe(false);
    expect(shouldPromptStar(makeState({ starConfirmed: true, hasStarred: null }))).toBe(false);
    expect(shouldPromptStar(makeState({ starConfirmed: true, hasStarred: false }))).toBe(false);
  });

  it("never prompts outside a TTY", () => {
    expect(shouldPromptStar(makeState({ isTTY: false }))).toBe(false);
  });
});

describe("shouldRequestStarStatus", () => {
  it("does not ask on the very first submit", () => {
    expect(shouldRequestStarStatus({ hasSubmittedBefore: false })).toBe(false);
  });

  it("asks on every later submit until the server has confirmed the star", () => {
    expect(shouldRequestStarStatus({ hasSubmittedBefore: true })).toBe(true);
    expect(shouldRequestStarStatus({ hasSubmittedBefore: true, starServerConfirmed: false })).toBe(
      true
    );
    expect(shouldRequestStarStatus({ hasSubmittedBefore: true, starServerConfirmed: true })).toBe(
      false
    );
  });
});

describe("star prompt after a decline", () => {
  let configDir: string;
  let config: Conf<CliConfig>;

  async function runEligibleSubmits(count: number): Promise<boolean[]> {
    const shown: boolean[] = [];
    for (let i = 0; i < count; i++) {
      const show = takeStarPromptTurn(config);
      shown.push(show);
      if (show) await promptStarNudge(config);
    }
    return shown;
  }

  beforeEach(() => {
    configDir = fs.mkdtempSync(path.join(os.tmpdir(), "ccgather-star-"));
    config = new Conf<CliConfig>({ cwd: configDir, projectName: "ccgather-test" });
    prompt.answer = "n";
    prompt.questions = [];
    vi.stubEnv("PATH", "");
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    fs.rmSync(configDir, { recursive: true, force: true });
  });

  it("asks again only every STAR_REPROMPT_INTERVAL submits while the user keeps declining", async () => {
    const submits = STAR_REPROMPT_INTERVAL * 4;
    const shown = await runEligibleSubmits(submits);

    expect(shown).toEqual(
      Array.from({ length: submits }, (_, i) => i % STAR_REPROMPT_INTERVAL === 0)
    );
  });

  it("uses the next message after each decline and wraps around", async () => {
    const prompts = STAR_PROMPT_MESSAGES.length + 1;
    await runEligibleSubmits(prompts * STAR_REPROMPT_INTERVAL);

    expect(prompt.questions).toHaveLength(prompts);
    prompt.questions.forEach((question, i) => {
      expect(question).toContain(STAR_PROMPT_MESSAGES[i % STAR_PROMPT_MESSAGES.length].question);
    });
  });

  it("keeps every message distinct", () => {
    for (const field of ["title", "body", "question"] as const) {
      const values = STAR_PROMPT_MESSAGES.map((message) => message[field]);
      expect(new Set(values).size).toBe(values.length);
    }
    expect(STAR_PROMPT_MESSAGES.length).toBeGreaterThan(1);
  });

  it("keeps asking the server after a star made through the gh CLI", async () => {
    prompt.answer = "y";
    vi.mocked(execFileSync).mockImplementationOnce(() => Buffer.from(""));

    await promptStarNudge(config);

    expect(config.get("starConfirmed")).toBe(true);
    expect(
      shouldRequestStarStatus({
        hasSubmittedBefore: true,
        starServerConfirmed: config.get("starServerConfirmed") === true,
      })
    ).toBe(true);
  });

  it("does not treat an accepted prompt as a decline", async () => {
    prompt.answer = "y";
    const shown = await runEligibleSubmits(3);

    expect(shown).toEqual([true, true, true]);
    expect(new Set(prompt.questions).size).toBe(1);
    expect(config.get("starConfirmed")).toBeUndefined();
  });
});
