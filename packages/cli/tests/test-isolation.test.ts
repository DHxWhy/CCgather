import { describe, it, expect, vi } from "vitest";
import * as os from "os";
import { isolateEnvironment } from "./setup/isolation";

// What the setup must clear, listed here on its own so a name dropped there is caught.
const MUST_CLEAR = [
  "CLAUDE_CONFIG_DIR",
  "CLAUDE_SECURESTORAGE_CONFIG_DIR",
  "XDG_CONFIG_HOME",
  "APPDATA",
  "LOCALAPPDATA",
  "ANTHROPIC_CONFIG_DIR",
  "ANTHROPIC_PROFILE",
];

// tests/setup/isolate-environment.ts runs before every test file. These check that it did,
// with the real os module and the real config store.
describe("test isolation", () => {
  it("runs every test file with a throwaway HOME and no Claude folder variables", () => {
    expect(os.homedir()).toMatch(/ccgather-test-home-/);
    for (const name of ["CLAUDE_CONFIG_DIR", "XDG_CONFIG_HOME", "APPDATA"]) {
      expect(process.env[name], name).toBeUndefined();
    }
  });

  it("clears those variables and moves HOME even when the shell sets them", () => {
    const before = { ...process.env };
    try {
      for (const name of MUST_CLEAR) process.env[name] = "/polluted";
      process.env.HOME = "/polluted-home";
      process.env.USERPROFILE = "/polluted-home";

      isolateEnvironment("/tmp/isolated-home");

      for (const name of MUST_CLEAR) expect(process.env[name], name).toBeUndefined();
      expect(process.env.HOME).toBe("/tmp/isolated-home");
      expect(process.env.USERPROFILE).toBe("/tmp/isolated-home");
    } finally {
      for (const name of Object.keys(process.env)) {
        if (!(name in before)) delete process.env[name];
      }
      Object.assign(process.env, before);
    }
  });

  it("the setup file itself clears them when loaded under a polluted shell", async () => {
    const before = { ...process.env };
    try {
      for (const name of MUST_CLEAR) process.env[name] = "/polluted";
      process.env.HOME = "/polluted-home";
      vi.resetModules();

      await import("./setup/isolate-environment");

      for (const name of MUST_CLEAR) expect(process.env[name], name).toBeUndefined();
      expect(process.env.HOME).toMatch(/ccgather-test-home-/);
    } finally {
      for (const name of Object.keys(process.env)) {
        if (!(name in before)) delete process.env[name];
      }
      Object.assign(process.env, before);
    }
  });

  it("puts the real config store inside the throwaway HOME", async () => {
    const { getConfig } = await import("../src/lib/config");
    expect(getConfig().path.startsWith(os.homedir())).toBe(true);
  });
});
