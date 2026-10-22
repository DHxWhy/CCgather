// Every test file runs with a throwaway HOME and none of the variables that point at Claude
// data folders. A scan reads the saved folders through conf, an external module that finds
// its file from HOME (vi.mock("os") does not reach it), and folders from XDG_CONFIG_HOME,
// CLAUDE_CONFIG_DIR and APPDATA: without this a test could read the developer's transcripts
// or write the real conf store.
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { afterAll } from "vitest";
import { isolateEnvironment } from "./isolation";

const home = fs.mkdtempSync(path.join(os.tmpdir(), "ccgather-test-home-"));
isolateEnvironment(home);

afterAll(() => {
  fs.rmSync(home, { recursive: true, force: true });
});
