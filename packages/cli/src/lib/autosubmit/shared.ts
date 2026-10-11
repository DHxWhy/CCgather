import { execFile } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { VERSION } from "../ui.js";

/**
 * Shared pieces of `ccgather autosubmit`: the daily time, the exact argv the
 * job runs, and a never-throwing wrapper around the OS scheduler commands.
 *
 * The job never goes through PATH or a shell to find ccgather: its argv is
 * decided once, when the user turns autosubmit on, and every element is an
 * absolute path or a literal argument.
 */

export const JOB_NAME = "ccgather-autosubmit";

// A scheduled run is skipped when the last submit was less than this long ago.
// Lives here so `autosubmit on` can state the same number the skip uses.
export const SCHEDULED_MIN_INTERVAL_HOURS = 20;
export const SCHEDULED_MIN_INTERVAL_MS = SCHEDULED_MIN_INTERVAL_HOURS * 60 * 60 * 1000;

/**
 * A failure the user can act on: one line of cause and, when there is one, the
 * next step. `bare` leaves out the "Could not ..." prefix the command adds.
 */
export class AutosubmitError extends Error {
  constructor(
    readonly cause: string,
    readonly action?: string,
    readonly bare: boolean = false
  ) {
    super(cause);
    this.name = "AutosubmitError";
  }
}

export interface DailyTime {
  hour: number;
  minute: number;
}

export interface JobCommand {
  // Absolute argv: [node, script, ...args]
  argv: string[];
  // "global": the global install's dist/index.js. "npx": npm's npx-cli.js
  kind: "global" | "npx";
  // The package spec npx runs (`ccgather@2.1.1` or `ccgather@latest`)
  spec?: string;
}

export interface EnablePlan {
  command: JobCommand;
  time: DailyTime;
  home: string;
  // Set only when XDG_CONFIG_HOME was set at enable time (conf reads it on Linux)
  xdgConfigHome?: string;
}

export interface EnableResult {
  // The scheduler in a few words: "Task Scheduler", "launchd", "systemd user timer", "cron"
  scheduler: string;
  // Extra lines for this OS (catch-up behaviour, notifications, linger)
  notes: string[];
}

export interface AutosubmitStatus {
  registered: boolean;
  // The scheduler in a few words, as EnableResult.scheduler
  scheduler: string;
  time?: DailyTime;
  argv?: string[];
  state?: string;
  // Set only when the scheduler reports that its last run failed, so a run that
  // died before the CLI could record anything still shows up
  lastFailure?: string;
  nextRun?: string;
  log: string;
  // The last line the job wrote to its log file, when it has one
  lastLogLine?: string;
}

export interface Backend {
  enable(plan: EnablePlan): Promise<EnableResult>;
  // Resolves true when something was removed
  disable(): Promise<boolean>;
  status(): Promise<AutosubmitStatus>;
}

// ═══════════════════════════════════════════════════════════════════════════
// Time
// ═══════════════════════════════════════════════════════════════════════════

/**
 * The local time five minutes after `now`, rounded to the nearest minute. People
 * turn autosubmit on at different moments, so the load spreads itself, and the
 * machine is usually awake at the time they picked.
 */
export function defaultDailyTime(now: Date): DailyTime {
  const later = new Date(Math.round((now.getTime() + 5 * 60 * 1000) / 60000) * 60000);
  return { hour: later.getHours(), minute: later.getMinutes() };
}

/** Parse `HH:MM` (24-hour); returns null for anything else */
export function parseDailyTime(value: string): DailyTime | null {
  const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(value.trim());
  if (!match) return null;
  return { hour: Number(match[1]), minute: Number(match[2]) };
}

export function formatDailyTime(time: DailyTime): string {
  return `${String(time.hour).padStart(2, "0")}:${String(time.minute).padStart(2, "0")}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// Running scheduler commands
// ═══════════════════════════════════════════════════════════════════════════

export interface RunResult {
  // Exit code; -1 when the program could not be started at all
  code: number;
  stdout: string;
  stderr: string;
  // Set when the program could not be started (for example ENOENT)
  spawnError?: string;
}

/** Drop a leading byte order mark (U+FEFF) */
export function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/**
 * Decode a child process's output: UTF-16 LE when it has that byte order
 * mark or looks like UTF-16, otherwise UTF-8 (dropping a UTF-8 BOM). This
 * does not decode the console's OEM code page that whoami and schtasks write
 * in, so only their ASCII parts are relied on; Windows status text comes from
 * PowerShell with its output forced to UTF-8.
 */
export function decodeOutput(output: string | Buffer | undefined | null): string {
  if (output === undefined || output === null) return "";
  if (typeof output === "string") return output;
  if (output.length >= 2 && output[0] === 0xff && output[1] === 0xfe) {
    return output.subarray(2).toString("utf16le");
  }
  if (output.length >= 3 && output[0] === 0xef && output[1] === 0xbb && output[2] === 0xbf) {
    return output.subarray(3).toString("utf8");
  }
  if (output.length >= 2 && output[1] === 0x00) {
    return output.toString("utf16le");
  }
  return output.toString("utf8");
}

/**
 * Run a program with an argv array, never through a shell. Never rejects: a
 * non-zero exit or a missing program comes back in the result.
 */
export function run(file: string, args: string[]): Promise<RunResult> {
  return new Promise((resolve) => {
    execFile(
      file,
      args,
      { encoding: "buffer", windowsHide: true, timeout: 60_000 },
      (error, stdout, stderr) => {
        const out = decodeOutput(stdout);
        const err = decodeOutput(stderr);
        if (!error) {
          resolve({ code: 0, stdout: out, stderr: err });
          return;
        }
        const failure = error as NodeJS.ErrnoException & { code?: number | string };
        if (typeof failure.code === "number") {
          resolve({ code: failure.code, stdout: out, stderr: err });
          return;
        }
        resolve({
          code: -1,
          stdout: out,
          stderr: err,
          spawnError: failure.message,
        });
      }
    );
  });
}

/** The first useful line of a failed command, for an error message */
export function describeFailure(result: RunResult): string {
  const text = (result.spawnError || result.stderr || result.stdout || "").trim();
  const line = text.split(/\r?\n/).find((entry) => entry.trim().length > 0);
  return line ? line.trim() : `exit code ${result.code}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// Files
// ═══════════════════════════════════════════════════════════════════════════

/** Escape text for an XML element or attribute */
export function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function xmlUnescape(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/** The last non-empty line of a log file, reading at most its last 4 KB */
export function readLastLogLine(file: string): string | undefined {
  try {
    const size = fs.statSync(file).size;
    const length = Math.min(size, 4096);
    const buffer = Buffer.alloc(length);
    const fd = fs.openSync(file, "r");
    try {
      fs.readSync(fd, buffer, 0, length, size - length);
    } finally {
      fs.closeSync(fd);
    }
    const lines = buffer
      .toString("utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    return lines.length > 0 ? lines[lines.length - 1] : undefined;
  } catch {
    return undefined;
  }
}

/** Refuse values a scheduler file cannot hold on one line */
export function assertSingleLine(values: string[]): void {
  for (const value of values) {
    if (/[\r\n\0]/.test(value)) {
      throw new Error(`Cannot schedule a path containing a line break: ${JSON.stringify(value)}`);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Which command the job runs
// ═══════════════════════════════════════════════════════════════════════════

export interface ResolveDeps {
  platform: NodeJS.Platform;
  execPath: string;
  // Root of the running ccgather package, or null when it cannot be found
  packageRoot: string | null;
  // `npm root -g`, or null when npm cannot answer
  globalRoot: (npmCliJs: string | null) => Promise<string | null>;
  exists: (file: string) => boolean;
  // Canonical path, or null when the file does not exist
  realpath: (file: string) => string | null;
  pathEnv: string;
  version: string;
}

// Unversioned locations a package manager keeps pointing at the current node
const STABLE_NODE_ALIASES: Partial<Record<NodeJS.Platform, string[]>> = {
  darwin: ["/opt/homebrew/bin/node", "/usr/local/bin/node"],
  linux: ["/usr/local/bin/node", "/usr/bin/node"],
};

function pathFor(platform: NodeJS.Platform): path.PlatformPath {
  return platform === "win32" ? path.win32 : path.posix;
}

/**
 * The node binary to bake in. nvm, fnm, Volta and Homebrew Cellar paths carry
 * a version and go stale on upgrade, so prefer a stable alias that resolves to
 * the same binary; otherwise keep execPath and let `status` flag it if it goes.
 */
export function selectNodePath(deps: ResolveDeps): string {
  const real = deps.realpath(deps.execPath);
  if (real) {
    // Homebrew keeps <prefix>/opt/<formula> pointing at the current version,
    // including keg-only formulae such as node@22 that have no bin/node link
    const cellar = /^(.*)\/Cellar\/([^/]+)\/[^/]+\/bin\/node$/.exec(real);
    const candidates = cellar ? [`${cellar[1]}/opt/${cellar[2]}/bin/node`] : [];
    candidates.push(...(STABLE_NODE_ALIASES[deps.platform] ?? []));
    for (const alias of candidates) {
      if (deps.exists(alias) && deps.realpath(alias) === real) {
        return alias;
      }
    }
  }
  return deps.execPath;
}

function npmScriptNextTo(nodePath: string, script: string, deps: ResolveDeps): string | null {
  const p = pathFor(deps.platform);
  const nodeDir = p.dirname(nodePath);
  const candidate =
    deps.platform === "win32"
      ? p.join(nodeDir, "node_modules", "npm", "bin", script)
      : p.join(nodeDir, "..", "lib", "node_modules", "npm", "bin", script);
  return deps.exists(candidate) ? candidate : null;
}

function npxScriptOnPath(deps: ResolveDeps): string | null {
  const p = pathFor(deps.platform);
  const delimiter = deps.platform === "win32" ? ";" : ":";
  for (const dir of deps.pathEnv.split(delimiter)) {
    if (!dir) continue;
    if (deps.platform === "win32") {
      // npx.cmd cannot be spawned without a shell; use the npx-cli.js beside it
      if (!deps.exists(p.join(dir, "npx.cmd"))) continue;
      const script = p.join(dir, "node_modules", "npm", "bin", "npx-cli.js");
      if (deps.exists(script)) return script;
    } else {
      const shim = p.join(dir, "npx");
      if (!deps.exists(shim)) continue;
      const real = deps.realpath(shim);
      if (real && p.basename(real) === "npx-cli.js") return real;
    }
  }
  return null;
}

/** npm's npx-cli.js for the chosen node, falling back to the one on PATH */
export function findNpxCli(nodePath: string, deps: ResolveDeps): string | null {
  return (
    npmScriptNextTo(nodePath, "npx-cli.js", deps) ??
    npmScriptNextTo(deps.execPath, "npx-cli.js", deps) ??
    npxScriptOnPath(deps)
  );
}

/**
 * Decide the job's argv.
 *
 * 1. A global install (the running package is exactly `<npm root -g>/ccgather`)
 *    runs its own dist/index.js, so it follows `npm install -g` upgrades.
 * 2. Anything else (npx, pnpm dlx, bunx, a project's node_modules) runs
 *    `npx --yes ccgather@<this version>`, or `ccgather@latest` with autoUpdate.
 *    --auto-update always takes this route, even from a global install.
 */
export async function resolveJobCommand(
  options: { autoUpdate?: boolean },
  deps: ResolveDeps
): Promise<JobCommand> {
  const p = pathFor(deps.platform);
  const nodePath = selectNodePath(deps);
  const scheduledArgs = ["submit", "--scheduled"];

  if (!options.autoUpdate && deps.packageRoot) {
    const runningRoot = deps.realpath(deps.packageRoot);
    const globalRoot = await deps.globalRoot(
      npmScriptNextTo(nodePath, "npm-cli.js", deps) ??
        npmScriptNextTo(deps.execPath, "npm-cli.js", deps)
    );
    if (runningRoot && globalRoot) {
      const globalPackage = p.join(globalRoot, "ccgather");
      const entry = p.join(globalPackage, "dist", "index.js");
      if (deps.realpath(globalPackage) === runningRoot && deps.exists(entry)) {
        return { argv: [nodePath, entry, ...scheduledArgs], kind: "global" };
      }
    }
  }

  const npxCli = findNpxCli(nodePath, deps);
  if (!npxCli) {
    throw new AutosubmitError(
      `npm's npx-cli.js was not found for ${nodePath}.`,
      "Install ccgather globally (npm i -g ccgather) and run `ccgather autosubmit on` again."
    );
  }
  const spec = options.autoUpdate ? "ccgather@latest" : `ccgather@${deps.version}`;
  return { argv: [nodePath, npxCli, "--yes", spec, ...scheduledArgs], kind: "npx", spec };
}

/**
 * The root of the running ccgather package. The published build is one CJS
 * bundle (dist/index.js) and tests run the TypeScript sources, so walk up from
 * this file until the package.json named "ccgather".
 */
export function findPackageRoot(start?: string): string | null {
  const from =
    start ??
    (typeof __filename !== "undefined" ? __filename : undefined) ??
    (typeof require !== "undefined" ? require.main?.filename : undefined) ??
    process.argv[1];
  if (!from) return null;

  let dir = path.dirname(path.resolve(from));
  for (;;) {
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf-8")) as {
        name?: string;
      };
      if (pkg.name === "ccgather") return dir;
    } catch {
      // No package.json here; keep walking up
    }
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

function realpathOrNull(file: string): string | null {
  try {
    return fs.realpathSync(file);
  } catch {
    return null;
  }
}

async function npmGlobalRoot(npmCliJs: string | null): Promise<string | null> {
  if (!npmCliJs) return null;
  // npm.cmd cannot be spawned without a shell, so run npm-cli.js with node
  const result = await run(process.execPath, [npmCliJs, "root", "-g"]);
  const root = result.stdout.trim();
  return result.code === 0 && root ? root : null;
}

export function defaultResolveDeps(): ResolveDeps {
  return {
    platform: process.platform,
    execPath: process.execPath,
    packageRoot: findPackageRoot(),
    globalRoot: npmGlobalRoot,
    exists: (file) => fs.existsSync(file),
    realpath: realpathOrNull,
    pathEnv: process.env.PATH ?? process.env.Path ?? "",
    version: VERSION,
  };
}
