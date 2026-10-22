import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

// A scan reads the saved data folders from the conf store (an external module, so mocking
// "os" does not move it) and folders from XDG_CONFIG_HOME and CLAUDE_CONFIG_DIR. A test that
// reaches the scan without pinning all three reads the developer's real transcripts.
describe("test isolation", () => {
  it("every test that imports the scan or submit mocks the config store and pins both variables", () => {
    const dir = __dirname;
    const offenders = fs
      .readdirSync(dir)
      .filter((name) => name.endsWith(".test.ts"))
      .filter((name) => {
        const source = fs.readFileSync(path.join(dir, name), "utf-8");
        const reachesScan = /from "\.\.\/src\/(lib\/ccgather-json|commands\/submit)"/.test(source);
        const isolated =
          source.includes('vi.mock("../src/lib/config"') &&
          source.includes('vi.stubEnv("XDG_CONFIG_HOME"') &&
          source.includes('vi.stubEnv("CLAUDE_CONFIG_DIR"');
        return reachesScan && !isolated;
      });

    expect(offenders).toEqual([]);
  });
});
