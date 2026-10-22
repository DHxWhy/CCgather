import { describe, it, expect } from "vitest";
import * as os from "os";

// tests/setup/isolate-environment.ts runs before every test file. These check that it did,
// with the real os module and the real config store.
describe("test isolation", () => {
  it("runs every test file with a throwaway HOME and no Claude folder variables", () => {
    expect(os.homedir()).toMatch(/ccgather-test-home-/);
    for (const name of ["CLAUDE_CONFIG_DIR", "XDG_CONFIG_HOME", "APPDATA"]) {
      expect(process.env[name], name).toBeUndefined();
    }
  });

  it("puts the real config store inside the throwaway HOME", async () => {
    const { getConfig } = await import("../src/lib/config");
    expect(getConfig().path.startsWith(os.homedir())).toBe(true);
  });
});
