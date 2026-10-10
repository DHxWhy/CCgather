/**
 * `ccgather submit` must reach the non-interactive pipeline directly, skipping
 * the animated header, the update check and the menu. A bare `ccgather` must
 * still open the menu.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mocked = vi.hoisted(() => ({
  submit: vi.fn(async (_options?: unknown): Promise<void> => undefined),
  printAnimatedHeader: vi.fn(async () => undefined),
  prompt: vi.fn(async (): Promise<Record<string, unknown>> => {
    throw new Error("inquirer.prompt must not be called");
  }),
}));

// Keep the real logResult so its line format is what gets asserted
vi.mock("../src/commands/submit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/commands/submit")>();
  return { ...actual, submit: mocked.submit };
});

vi.mock("../src/lib/ui", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/ui")>();
  return { ...actual, printAnimatedHeader: mocked.printAnimatedHeader };
});

vi.mock("inquirer", () => ({ default: { prompt: mocked.prompt } }));

// The menu path must not read the real conf store (it holds the user's API
// token) or reach any server
vi.mock("../src/lib/config", () => ({
  getConfig: () => ({ get: () => undefined, set: () => {}, delete: () => {} }),
  getApiUrl: () => "https://ccgather.test/api",
  isAuthenticated: () => false,
}));
vi.mock("../src/lib/api", () => ({
  getStatus: vi.fn(async () => ({ success: false, error: "blocked in tests" })),
}));
vi.mock("open", () => ({ default: vi.fn(async () => undefined) }));

describe("ccgather command routing", () => {
  const originalArgv = process.argv;
  let fetchMock: ReturnType<typeof vi.fn>;
  let errors: string[];

  async function runCli(args: string[]): Promise<void> {
    process.argv = ["node", "ccgather", ...args];
    await import("../src/index");
  }

  beforeEach(() => {
    // index.ts parses argv on import, so each test needs a fresh module
    vi.resetModules();
    mocked.submit.mockReset();
    mocked.submit.mockResolvedValue(undefined);
    mocked.printAnimatedHeader.mockClear();
    mocked.prompt.mockReset();
    mocked.prompt.mockRejectedValue(new Error("inquirer.prompt must not be called"));

    fetchMock = vi.fn(async () => new Response("blocked in tests", { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);

    errors = [];
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      errors.push(args.join(" "));
    });
    vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);
  });

  afterEach(() => {
    process.argv = originalArgv;
    process.exitCode = undefined;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("runs the non-interactive submit without the menu", async () => {
    await runCli(["submit"]);

    await vi.waitFor(() => expect(mocked.submit).toHaveBeenCalledWith({ nonInteractive: true }));
    expect(mocked.printAnimatedHeader).not.toHaveBeenCalled();
    expect(mocked.prompt).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(process.exitCode).toBeUndefined();
  });

  it("reports an unexpected error as one timestamped line and exit code 1", async () => {
    mocked.submit.mockRejectedValue(new Error("boom"));

    await runCli(["submit"]);

    await vi.waitFor(() => expect(process.exitCode).toBe(1));
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/^\[\d{4}-\d{2}-\d{2}T[^\]]+\] ccgather: Unexpected error: boom$/);
    expect(mocked.printAnimatedHeader).not.toHaveBeenCalled();
  });

  it("still opens the menu for a bare `ccgather`", async () => {
    // Decline the login offer; the menu prompt then answers nothing and ends
    mocked.prompt.mockResolvedValue({ startAuth: false });

    await runCli([]);

    await vi.waitFor(() => expect(mocked.prompt).toHaveBeenCalledTimes(2));
    expect(mocked.printAnimatedHeader).toHaveBeenCalledTimes(1);
    expect(mocked.submit).not.toHaveBeenCalled();
    // Only the npm update check may go out, and it is stubbed
    for (const [input] of fetchMock.mock.calls as unknown as [string][]) {
      expect(String(input)).toBe("https://registry.npmjs.org/ccgather/latest");
    }
  });
});
