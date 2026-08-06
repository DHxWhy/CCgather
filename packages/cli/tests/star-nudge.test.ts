import { describe, it, expect } from "vitest";
import { shouldPromptStar, type StarPromptState } from "../src/lib/star-nudge";

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

  it("keeps asking on every submit while not starred (declines are not remembered)", () => {
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
