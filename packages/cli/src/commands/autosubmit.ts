import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { getConfig, isAuthenticated } from "../lib/config.js";
import {
  AutosubmitStatus,
  Backend,
  DailyTime,
  JobCommand,
  ResolveDeps,
  defaultResolveDeps,
  formatDailyTime,
  defaultDailyTime,
  parseDailyTime,
  resolveJobCommand,
} from "../lib/autosubmit/shared.js";
import { createWindowsBackend } from "../lib/autosubmit/windows.js";
import { createMacosBackend } from "../lib/autosubmit/macos.js";
import { createLinuxBackend } from "../lib/autosubmit/linux.js";

/**
 * `ccgather autosubmit`: register a daily job with the operating system's own
 * scheduler (Task Scheduler, launchd, systemd or cron) that runs
 * `ccgather submit --scheduled`.
 */

export interface AutosubmitOptions {
  at?: string;
  autoUpdate?: boolean;
}

// Test seams: the backend, the argv inputs, the clock and the platform default
// to the real system
export interface AutosubmitContext {
  backend?: Backend;
  resolveDeps?: ResolveDeps;
  now?: () => Date;
  platform?: NodeJS.Platform;
}

export function getBackend(platform: NodeJS.Platform = process.platform): Backend {
  switch (platform) {
    case "win32":
      return createWindowsBackend();
    case "darwin":
      return createMacosBackend();
    case "linux":
      return createLinuxBackend();
    default:
      throw new Error(
        `Autosubmit does not support ${platform} yet. See the README for a cron line you can add yourself.`
      );
  }
}

function describeCommand(command: JobCommand): string {
  if (command.kind === "global") return "your global install of ccgather";
  if (command.spec === "ccgather@latest") return "the newest ccgather release each day, via npx";
  return `${command.spec} via npx; to move to a newer release, run \`npx ccgather@latest autosubmit on\``;
}

function backendFor(context: AutosubmitContext): Backend {
  return context.backend ?? getBackend(context.platform);
}

export async function autosubmitEnable(
  options: AutosubmitOptions,
  context: AutosubmitContext = {}
): Promise<void> {
  if (!isAuthenticated()) {
    throw new Error("Log in first with `npx ccgather`.");
  }

  let time: DailyTime | null = null;
  if (options.at !== undefined) {
    time = parseDailyTime(options.at);
    if (!time) throw new Error(`--at must be HH:MM (24-hour), for example 21:30.`);
  }

  const backend = backendFor(context);
  const command = await resolveJobCommand(
    { autoUpdate: options.autoUpdate === true },
    context.resolveDeps ?? defaultResolveDeps()
  );

  if (!time) {
    // Re-running without --at keeps the registered time (a repair should not
    // move the schedule); a first run picks five minutes from now
    const current = await backend.status();
    time =
      current.registered && current.time
        ? current.time
        : defaultDailyTime((context.now ?? (() => new Date()))());
  }

  const result = await backend.enable({
    command,
    time,
    home: os.homedir(),
    xdgConfigHome: process.env.XDG_CONFIG_HOME || undefined,
  });
  getConfig().set("autoSync", true);

  console.log(`Autosubmit is on. Runs every day at ${formatDailyTime(time)}, your local time.`);
  console.log(`It uses ${describeCommand(command)}.`);
  console.log(
    `Log: ${result.log}. Turn it off with \`npx ccgather autosubmit off\`; check it with \`npx ccgather autosubmit status\`.`
  );
  if (options.autoUpdate) {
    console.log(
      "--auto-update: each day it runs whatever ccgather release is newest that day, with access to your token."
    );
  }
  for (const note of result.notes) console.log(note);
}

export async function autosubmitOff(context: AutosubmitContext = {}): Promise<void> {
  const backend = backendFor(context);
  const removed = await backend.disable();
  getConfig().set("autoSync", false);
  console.log(removed ? "Autosubmit is off; the scheduled job was removed." : "Autosubmit is off.");
}

function isAbsolutePath(value: string): boolean {
  return path.isAbsolute(value) || path.win32.isAbsolute(value);
}

function quoteForDisplay(value: string): string {
  return /\s/.test(value) ? `"${value}"` : value;
}

/** Status lines, read from the OS rather than from config */
export function formatStatus(
  status: AutosubmitStatus,
  exists: (file: string) => boolean = fs.existsSync
): string[] {
  const lines: string[] = [];
  if (!status.registered) {
    lines.push(`Autosubmit is off (no ${status.mechanism} found).`);
    if (status.state) lines.push(`State: ${status.state}`);
    lines.push("Turn it on with `npx ccgather autosubmit on`.");
    return lines;
  }

  const when = status.time ? ` every day at ${formatDailyTime(status.time)}` : "";
  lines.push(`Autosubmit is on: ${status.mechanism}${when}.`);

  if (status.argv && status.argv.length > 0) {
    lines.push(`Runs: ${status.argv.map(quoteForDisplay).join(" ")}`);
    const missing = status.argv.filter((arg) => isAbsolutePath(arg) && !exists(arg));
    for (const file of missing) lines.push(`Missing: ${file}`);
    if (missing.length > 0) lines.push("Run `npx ccgather autosubmit on` again to repair.");
  } else {
    lines.push(
      "Could not read the command it runs. Run `npx ccgather autosubmit on` again to repair."
    );
  }

  if (status.state) lines.push(`State: ${status.state}`);
  if (status.lastRun) lines.push(`Last run: ${status.lastRun}`);
  if (status.lastResult) lines.push(`Last result: ${status.lastResult}`);
  if (status.nextRun) lines.push(`Next run: ${status.nextRun}`);
  lines.push(`Log: ${status.log}`);
  if (status.lastLogLine) lines.push(`Last log line: ${status.lastLogLine}`);
  return lines;
}

export async function autosubmitStatus(context: AutosubmitContext = {}): Promise<void> {
  const backend = backendFor(context);
  for (const line of formatStatus(await backend.status())) console.log(line);
}

export interface AutosubmitSettingsState {
  // What the Settings menu entry shows
  label: string;
  // True when the job is registered; choosing the entry then turns it off
  on: boolean;
}

/**
 * The Settings menu entry for autosubmit, read from the OS scheduler. Null on a
 * platform autosubmit does not support, so the menu leaves the entry out.
 */
export async function autosubmitSettingsState(
  context: AutosubmitContext = {}
): Promise<AutosubmitSettingsState | null> {
  let backend: Backend;
  try {
    backend = backendFor(context);
  } catch {
    return null;
  }

  try {
    const status = await backend.status();
    if (!status.registered) return { label: "Autosubmit: off", on: false };
    const when = status.time ? `, every day at ${formatDailyTime(status.time)}` : "";
    return { label: `Autosubmit: on${when}`, on: true };
  } catch {
    return { label: "Autosubmit: could not read the OS scheduler", on: false };
  }
}

/**
 * Choosing the Settings entry: turn autosubmit off when it is on, otherwise on
 * (exactly `autosubmit on` / `autosubmit off`). A failure prints one line and
 * never throws, so the menu carries on.
 */
export async function toggleAutosubmit(
  on: boolean,
  context: AutosubmitContext = {}
): Promise<boolean> {
  try {
    if (on) {
      await autosubmitOff(context);
    } else {
      await autosubmitEnable({}, context);
    }
    return true;
  } catch (err) {
    console.error(`ccgather autosubmit: ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }
}
