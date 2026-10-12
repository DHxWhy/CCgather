/**
 * `ccgather autosubmit` — which absolute argv the job runs
 *
 * The file system is a fake: a set of existing paths and a realpath map, so
 * every platform's layout is tested on any host and nothing reads the real
 * npm or node installation.
 */

import { describe, it, expect, vi } from "vitest";
import * as path from "path";
import {
  ResolveDeps,
  findPackageRoot,
  resolveJobCommand,
  selectNodePath,
} from "../src/lib/autosubmit/shared";

interface FakeFs {
  files: string[];
  links?: Record<string, string>;
}

function deps(
  platform: NodeJS.Platform,
  fake: FakeFs,
  overrides: Partial<ResolveDeps> = {}
): ResolveDeps {
  const files = new Set(fake.files);
  const links = fake.links ?? {};
  return {
    platform,
    execPath: "",
    packageRoot: null,
    globalRoot: vi.fn(async () => null),
    exists: (file) => files.has(file) || file in links,
    realpath: (file) => links[file] ?? (files.has(file) ? file : null),
    pathEnv: "",
    version: "2.1.1",
    ...overrides,
  };
}

const WIN_NODE = String.raw`C:\Program Files\nodejs\node.exe`;
const WIN_NPX = String.raw`C:\Program Files\nodejs\node_modules\npm\bin\npx-cli.js`;
const WIN_NPM = String.raw`C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js`;
const WIN_GLOBAL = String.raw`C:\Users\alice\AppData\Roaming\npm\node_modules`;
const WIN_NPX_CACHE = String.raw`C:\Users\alice\AppData\Local\npm-cache\_npx\abc\node_modules\ccgather`;

describe("argv selection on Windows", () => {
  const files = [WIN_NODE, WIN_NPX, WIN_NPM];

  it("runs a pinned npx when started through npx", async () => {
    const globalRoot = vi.fn(async () => WIN_GLOBAL);
    const command = await resolveJobCommand(
      {},
      deps(
        "win32",
        { files: [...files, WIN_NPX_CACHE] },
        {
          execPath: WIN_NODE,
          packageRoot: WIN_NPX_CACHE,
          globalRoot,
        }
      )
    );
    expect(command).toEqual({
      argv: [WIN_NODE, WIN_NPX, "--yes", "ccgather@2.1.1", "submit", "--scheduled"],
      kind: "npx",
      spec: "ccgather@2.1.1",
    });
    // npm root -g is asked through npm-cli.js next to node, never npm.cmd
    expect(globalRoot).toHaveBeenCalledWith(WIN_NPM);
  });

  it("runs the global install's dist/index.js when it is the running copy", async () => {
    const globalPackage = path.win32.join(WIN_GLOBAL, "ccgather");
    const entry = path.win32.join(globalPackage, "dist", "index.js");
    const command = await resolveJobCommand(
      {},
      deps(
        "win32",
        { files: [...files, globalPackage, entry] },
        {
          execPath: WIN_NODE,
          packageRoot: globalPackage,
          globalRoot: async () => WIN_GLOBAL,
        }
      )
    );
    expect(command).toEqual({
      argv: [WIN_NODE, entry, "submit", "--scheduled"],
      kind: "global",
    });
  });

  it("does not treat a copy nested under the global root as the global install", async () => {
    const nested = path.win32.join(WIN_GLOBAL, "other-tool", "node_modules", "ccgather");
    const globalPackage = path.win32.join(WIN_GLOBAL, "ccgather");
    const command = await resolveJobCommand(
      {},
      deps(
        "win32",
        {
          files: [
            ...files,
            nested,
            globalPackage,
            path.win32.join(globalPackage, "dist", "index.js"),
          ],
        },
        { execPath: WIN_NODE, packageRoot: nested, globalRoot: async () => WIN_GLOBAL }
      )
    );
    expect(command.kind).toBe("npx");
  });

  it("uses ccgather@latest with autoUpdate, even from a global install", async () => {
    const globalPackage = path.win32.join(WIN_GLOBAL, "ccgather");
    const globalRoot = vi.fn(async () => WIN_GLOBAL);
    const command = await resolveJobCommand(
      { autoUpdate: true },
      deps(
        "win32",
        { files: [...files, globalPackage, path.win32.join(globalPackage, "dist", "index.js")] },
        { execPath: WIN_NODE, packageRoot: globalPackage, globalRoot }
      )
    );
    expect(command).toEqual({
      argv: [WIN_NODE, WIN_NPX, "--yes", "ccgather@latest", "submit", "--scheduled"],
      kind: "npx",
      spec: "ccgather@latest",
    });
    expect(globalRoot).not.toHaveBeenCalled();
  });

  it("falls back to the npx-cli.js beside npx.cmd on PATH", async () => {
    const otherNode = String.raw`D:\tools\node\node.exe`;
    const nvmDir = String.raw`C:\nvm4w\nodejs`;
    const npxBesideCmd = path.win32.join(nvmDir, "node_modules", "npm", "bin", "npx-cli.js");
    const command = await resolveJobCommand(
      {},
      deps(
        "win32",
        { files: [otherNode, path.win32.join(nvmDir, "npx.cmd"), npxBesideCmd] },
        { execPath: otherNode, pathEnv: String.raw`C:\Windows\system32;` + nvmDir }
      )
    );
    expect(command.argv).toEqual([
      otherNode,
      npxBesideCmd,
      "--yes",
      "ccgather@2.1.1",
      "submit",
      "--scheduled",
    ]);
  });

  it("refuses with a clear message when no npx-cli.js can be found", async () => {
    await expect(
      resolveJobCommand(
        {},
        deps("win32", { files: [WIN_NODE] }, { execPath: WIN_NODE, pathEnv: String.raw`C:\bin` })
      )
    ).rejects.toMatchObject({
      cause: `npm's npx-cli.js was not found for ${WIN_NODE}.`,
      action:
        "Install ccgather globally (npm i -g ccgather) and run `ccgather autosubmit on` again.",
    });
  });
});

describe("argv selection on macOS and Linux", () => {
  const cellarNode = "/opt/homebrew/Cellar/node/22.9.0/bin/node";
  const brewNpx = "/opt/homebrew/lib/node_modules/npm/bin/npx-cli.js";

  it("prefers Homebrew's stable /opt/homebrew/bin/node over the versioned Cellar path", async () => {
    const d = deps(
      "darwin",
      {
        files: [cellarNode, brewNpx],
        links: { "/opt/homebrew/bin/node": cellarNode },
      },
      { execPath: cellarNode }
    );
    expect(selectNodePath(d)).toBe("/opt/homebrew/bin/node");
    const command = await resolveJobCommand({}, d);
    // npx-cli.js is found next to the alias, also through the stable path
    expect(command.argv).toEqual([
      "/opt/homebrew/bin/node",
      brewNpx,
      "--yes",
      "ccgather@2.1.1",
      "submit",
      "--scheduled",
    ]);
  });

  it("uses Homebrew's opt path for a keg-only node@22, for node and npx-cli.js", async () => {
    const kegNode = "/opt/homebrew/Cellar/node@22/22.9.0/bin/node";
    const optNode = "/opt/homebrew/opt/node@22/bin/node";
    const optNpx = "/opt/homebrew/opt/node@22/lib/node_modules/npm/bin/npx-cli.js";
    const d = deps(
      "darwin",
      {
        files: [
          kegNode,
          "/opt/homebrew/Cellar/node@22/22.9.0/lib/node_modules/npm/bin/npx-cli.js",
          // An unrelated node on the usual alias must not be picked
          "/opt/homebrew/Cellar/node/24.0.0/bin/node",
        ],
        links: {
          [optNode]: kegNode,
          [optNpx]: "/opt/homebrew/Cellar/node@22/22.9.0/lib/node_modules/npm/bin/npx-cli.js",
          "/opt/homebrew/bin/node": "/opt/homebrew/Cellar/node/24.0.0/bin/node",
        },
      },
      { execPath: kegNode }
    );
    expect(selectNodePath(d)).toBe(optNode);
    expect((await resolveJobCommand({}, d)).argv).toEqual([
      optNode,
      optNpx,
      "--yes",
      "ccgather@2.1.1",
      "submit",
      "--scheduled",
    ]);
  });

  it("does not use an opt path that resolves to a different binary", () => {
    const kegNode = "/opt/homebrew/Cellar/node@22/22.9.0/bin/node";
    const d = deps(
      "darwin",
      {
        files: [kegNode, "/opt/homebrew/Cellar/node@22/22.10.0/bin/node"],
        links: {
          "/opt/homebrew/opt/node@22/bin/node": "/opt/homebrew/Cellar/node@22/22.10.0/bin/node",
        },
      },
      { execPath: kegNode }
    );
    expect(selectNodePath(d)).toBe(kegNode);
  });

  it("keeps an nvm node when no alias resolves to the same binary", async () => {
    const nvmNode = "/home/alice/.nvm/versions/node/v22.9.0/bin/node";
    const nvmNpx = "/home/alice/.nvm/versions/node/v22.9.0/lib/node_modules/npm/bin/npx-cli.js";
    const d = deps(
      "linux",
      {
        files: [nvmNode, nvmNpx, "/usr/bin/node-18"],
        links: { "/usr/bin/node": "/usr/bin/node-18" },
      },
      { execPath: nvmNode }
    );
    expect(selectNodePath(d)).toBe(nvmNode);
    expect((await resolveJobCommand({}, d)).argv.slice(0, 2)).toEqual([nvmNode, nvmNpx]);
  });

  it("uses the realpath of npx on PATH when npm is not next to node", async () => {
    const node = "/opt/node/bin/node";
    const real = "/usr/share/nodejs/npm/bin/npx-cli.js";
    const d = deps(
      "linux",
      { files: [node, real], links: { "/usr/bin/npx": real } },
      { execPath: node, pathEnv: "/usr/local/bin:/usr/bin" }
    );
    expect((await resolveJobCommand({}, d)).argv[1]).toBe(real);
  });

  it("ignores an npx on PATH that is not npm's npx-cli.js", async () => {
    const node = "/opt/node/bin/node";
    const d = deps(
      "linux",
      { files: [node, "/usr/bin/npx"] },
      { execPath: node, pathEnv: "/usr/bin" }
    );
    await expect(resolveJobCommand({}, d)).rejects.toThrow(/npx-cli\.js/);
  });

  it("runs a global install through the stable node alias", async () => {
    const globalRoot = "/usr/local/lib/node_modules";
    const pkg = `${globalRoot}/ccgather`;
    const entry = `${pkg}/dist/index.js`;
    const d = deps(
      "linux",
      {
        files: [
          "/usr/local/bin/node-real",
          "/usr/local/lib/node_modules/npm/bin/npm-cli.js",
          pkg,
          entry,
        ],
        links: { "/usr/local/bin/node": "/usr/local/bin/node-real" },
      },
      {
        execPath: "/usr/local/bin/node-real",
        packageRoot: pkg,
        globalRoot: async () => globalRoot,
      }
    );
    expect(await resolveJobCommand({}, d)).toEqual({
      argv: ["/usr/local/bin/node", entry, "submit", "--scheduled"],
      kind: "global",
    });
  });
});

describe("finding the running package", () => {
  it("walks up from a source file to the ccgather package.json", () => {
    const root = findPackageRoot(
      path.join(__dirname, "..", "src", "lib", "autosubmit", "shared.ts")
    );
    expect(root).toBe(path.resolve(__dirname, ".."));
  });

  it("works with no argument under vitest", () => {
    expect(findPackageRoot()).toBe(path.resolve(__dirname, ".."));
  });
});
