import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import inquirer from "inquirer";
import { getConfig, isAuthenticated } from "../lib/config.js";
import { reportAutosubmit } from "../lib/api.js";
import type { CliConfig } from "../lib/config.js";
import type Conf from "conf";
import { colors } from "../lib/ui.js";
import { promptStarNudge, shouldPromptStar } from "../lib/star-nudge.js";
import {
  AutosubmitError,
  AutosubmitStatus,
  Backend,
  DailyTime,
  JobCommand,
  ResolveDeps,
  SCHEDULED_MIN_INTERVAL_HOURS,
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
  // Internal, not a CLI flag: false keeps the star prompt away from a turn-on
  // that comes from the on-state menu (default true)
  starPrompt?: boolean;
}

// The result of the last `submit --scheduled` run, as `submit` keeps it in config
export type LastScheduledRun = NonNullable<CliConfig["lastScheduledRun"]>;

// Test seams: the backend, the argv inputs, the clock, the platform, the
// terminal check, the star prompt and the recorded last run default to the real
// system
export interface AutosubmitContext {
  backend?: Backend;
  resolveDeps?: ResolveDeps;
  now?: () => Date;
  platform?: NodeJS.Platform;
  isTTY?: boolean;
  promptStar?: (config: Conf<CliConfig>) => Promise<void>;
  lastScheduledRun?: LastScheduledRun;
  // The server report of the on/off state (default: the real API call)
  report?: (enabled: boolean) => Promise<unknown>;
}

// Tell the server the job's state for the admin page; never fails the command
async function reportState(context: AutosubmitContext, enabled: boolean): Promise<void> {
  try {
    await (context.report ?? reportAutosubmit)(enabled);
  } catch {
    // Best-effort: the next scheduled submit reports the state again
  }
}

const SUPPORTED_PLATFORMS: NodeJS.Platform[] = ["win32", "darwin", "linux"];

export function getBackend(platform: NodeJS.Platform = process.platform): Backend {
  switch (platform) {
    case "win32":
      return createWindowsBackend();
    case "darwin":
      return createMacosBackend();
    case "linux":
      return createLinuxBackend();
    default:
      throw new AutosubmitError(
        `Auto-submit does not support ${platform} yet.`,
        "See the README for a cron line you can add yourself.",
        true
      );
  }
}

function backendFor(context: AutosubmitContext): Backend {
  return context.backend ?? getBackend(context.platform);
}

// What the user types to reach this command: a global install runs `ccgather`
function commandPrefix(kind: JobCommand["kind"] | undefined): string {
  return kind === "global" ? "ccgather autosubmit" : "npx ccgather autosubmit";
}

function describeRuns(kind: JobCommand["kind"], spec?: string): string {
  if (kind === "global") return "your global install of ccgather";
  if (spec === "ccgather@latest") return "the newest ccgather release each day, via npx";
  return `${spec} via npx`;
}

/** Which command a registered job runs, read back from its argv; null if it is none of ours */
function classifyArgv(argv: string[]): { kind: JobCommand["kind"]; spec?: string } | null {
  if (argv.slice(-2).join(" ") !== "submit --scheduled") return null;
  if (argv.length === 4) return { kind: "global" };
  if (argv.length === 6 && argv[2] === "--yes" && /^ccgather@./.test(argv[3])) {
    return { kind: "npx", spec: argv[3] };
  }
  return null;
}

function sameArgv(a: string[] | undefined, b: string[]): boolean {
  return a !== undefined && a.length === b.length && a.every((value, index) => value === b[index]);
}

function printFailureLines(cause: string, action: string | undefined): void {
  console.error(`${colors.error("✖")} ${cause}`);
  if (action) console.error(`  ${action}`);
}

/**
 * Print a failure as the cause on one line and the next step on a second.
 * `prefix` says what was being attempted ("Could not register: ").
 */
export function printFailure(err: unknown, prefix: string): void {
  if (err instanceof AutosubmitError) {
    printFailureLines(err.bare ? err.cause : `${prefix}${err.cause}`, err.action);
  } else {
    printFailureLines(`${prefix}${err instanceof Error ? err.message : String(err)}`, undefined);
  }
}

export const REGISTER_FAILED = "Could not register: ";
export const TURN_OFF_FAILED = "Could not turn auto-submit off: ";
export const READ_FAILED = "Could not read the scheduler: ";

export async function autosubmitEnable(
  options: AutosubmitOptions,
  context: AutosubmitContext = {}
): Promise<void> {
  if (!isAuthenticated()) {
    throw new AutosubmitError(
      "you are not logged in.",
      "Run `npx ccgather` to log in, then run this again."
    );
  }

  let time: DailyTime | null = null;
  if (options.at !== undefined) {
    time = parseDailyTime(options.at);
    if (!time) {
      throw new AutosubmitError(
        "--at must be HH:MM (24-hour), for example 21:30.",
        undefined,
        true
      );
    }
  }

  const backend = backendFor(context);
  const command = await resolveJobCommand(
    { autoUpdate: options.autoUpdate === true },
    context.resolveDeps ?? defaultResolveDeps()
  );

  const current = await backend.status();
  const wasOn = current.registered;
  if (!time) {
    // Re-running without --at keeps the registered time (a repair should not
    // move the schedule); a first run picks five minutes from now
    time =
      wasOn && current.time
        ? current.time
        : defaultDailyTime((context.now ?? (() => new Date()))());
  }

  const result = await backend.enable({
    command,
    time,
    home: os.homedir(),
    xdgConfigHome: process.env.XDG_CONFIG_HOME || undefined,
  });
  const config = getConfig();
  config.set("autoSync", true);
  config.set("autoSyncTime", formatDailyTime(time));

  const at = formatDailyTime(time);
  const cli = commandPrefix(command.kind);
  const lines: string[] = [];

  if (wasOn && options.at !== undefined) {
    lines.push(`${colors.success("✔")} Auto-submit now runs every day at ${at} (your local time).`);
  } else if (wasOn) {
    lines.push(`Auto-submit is already on (daily ${at}). Use --at HH:MM to change the time.`);
    // A moved node or a newer version is picked up by the re-registration above
    if (!sameArgv(current.argv, command.argv)) {
      lines.push(`  The job was updated: it now runs ${describeRuns(command.kind, command.spec)}.`);
    }
  } else {
    lines.push(`${colors.success("✔")} Auto-submit is on.`);
    lines.push(`  Runs every day at ${at} (your local time) via ${result.scheduler}.`);
    lines.push(
      `  A run is skipped if you submitted in the ${SCHEDULED_MIN_INTERVAL_HOURS} hours before it, so the first one may be.`
    );
    lines.push(`  Check: ${cli} status   Stop: ${cli} off`);
    if (options.autoUpdate) {
      lines.push("  It runs the newest ccgather release each day, with access to your token.");
    } else if (command.kind === "npx") {
      lines.push(
        `  Tip: this job stays on ccgather ${command.spec?.replace(/^ccgather@/, "")}. To follow upgrades, install globally (npm i -g ccgather) or add --auto-update.`
      );
    }
    for (const note of result.notes) lines.push(`  ${note}`);
  }
  for (const line of lines) console.log(line);

  await reportState(context, true);

  if (!wasOn && options.starPrompt !== false) await offerStarPrompt(context);
}

/**
 * Scheduled runs never show the star prompt, so offer it when auto-submit is
 * turned on. A failure here never fails the command.
 */
async function offerStarPrompt(context: AutosubmitContext): Promise<void> {
  try {
    const config = getConfig();
    const isTTY = context.isTTY ?? Boolean(process.stdout.isTTY && process.stdin.isTTY);
    const ask = shouldPromptStar({
      isTTY,
      // Asked once, now, whether or not a submit has happened: the first-submit
      // rule and the decline spacing (takeStarPromptTurn) belong to submits
      hasSubmittedBefore: true,
      starConfirmed: config.get("starConfirmed") === true,
      hasStarred: null,
    });
    if (ask) await (context.promptStar ?? promptStarNudge)(config);
  } catch {
    // The prompt is a courtesy; auto-submit is already on
  }
}

export async function autosubmitOff(context: AutosubmitContext = {}): Promise<void> {
  const backend = backendFor(context);
  const removed = await backend.disable();
  const config = getConfig();
  config.set("autoSync", false);
  config.delete("autoSyncTime");
  console.log(
    removed
      ? `${colors.success("✔")} Auto-submit is off. The daily job was removed.`
      : "Auto-submit was not on."
  );
  await reportState(context, false);
}

function isAbsolutePath(value: string): boolean {
  return path.isAbsolute(value) || path.win32.isAbsolute(value);
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

// A date and time to the minute, local: 2026-10-11 14:23
function formatMinute(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function formatLocalMinute(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : formatMinute(date);
}

// Scheduler states that mean nothing is wrong: waiting for the next run, or running
const NORMAL_STATES = new Set(["ready", "running", "queued", "active", "waiting", "not running"]);

const LABEL_WIDTH = 11;

function row(label: string, value: string): string {
  return `  ${`${label}:`.padEnd(LABEL_WIDTH)}${value}`;
}

/** Status lines: the scheduler's job, plus the last scheduled run's own record */
export function formatStatus(
  status: AutosubmitStatus,
  exists: (file: string) => boolean = fs.existsSync,
  lastScheduledRun?: LastScheduledRun
): string[] {
  if (!status.registered) {
    const lines = ["Auto-submit: OFF"];
    if (status.state) lines.push(row("State", status.state));
    lines.push("  Turn it on with: npx ccgather autosubmit on");
    return lines;
  }

  const lines = ["Auto-submit: ON"];
  const when = status.time ? `daily at ${formatDailyTime(status.time)}` : "daily";
  lines.push(row("Schedule", `${when} (${status.scheduler})`));

  const known = status.argv ? classifyArgv(status.argv) : null;
  const cli = commandPrefix(known?.kind);
  if (status.argv && status.argv.length > 0) {
    lines.push(
      row(
        "Runs",
        known
          ? describeRuns(known.kind, known.spec)
          : status.argv.map((arg) => (/\s/.test(arg) ? `"${arg}"` : arg)).join(" ")
      )
    );
    for (const file of status.argv.filter((arg) => isAbsolutePath(arg) && !exists(arg))) {
      lines.push(row("Problem", `${file} is missing. Run \`${cli} on\` to repair.`));
    }
  } else {
    lines.push(row("Problem", `could not read the command it runs. Run \`${cli} on\` to repair.`));
  }

  if (status.state && !NORMAL_STATES.has(status.state.toLowerCase())) {
    lines.push(row("State", status.state));
  }
  lines.push(
    row(
      "Last run",
      lastScheduledRun
        ? `${formatLocalMinute(lastScheduledRun.at)} · ${lastScheduledRun.summary}`
        : "none yet"
    )
  );
  // A run that died before the CLI started records nothing; the scheduler knows.
  // When the record already says the run failed, the user has been told.
  if (status.lastFailure && (!lastScheduledRun || lastScheduledRun.ok)) {
    lines.push(
      row(
        "Problem",
        `the scheduler reports the last run failed: ${status.lastFailure}. See the log.`
      )
    );
  }
  if (status.nextRun) {
    const next = new Date(status.nextRun);
    lines.push(row("Next run", Number.isNaN(next.getTime()) ? status.nextRun : formatMinute(next)));
  }
  lines.push(row("Log", status.log));
  // The last run above is the log's last line when the run got as far as the
  // CLI; a crash before that shows only here
  if (
    status.lastLogLine &&
    !(lastScheduledRun && status.lastLogLine.endsWith(lastScheduledRun.message))
  ) {
    lines.push(row("Log tail", status.lastLogLine));
  }
  return lines;
}

export async function autosubmitStatus(context: AutosubmitContext = {}): Promise<void> {
  const backend = backendFor(context);
  const lastScheduledRun = context.lastScheduledRun ?? getConfig().get("lastScheduledRun");
  for (const line of formatStatus(await backend.status(), fs.existsSync, lastScheduledRun)) {
    console.log(line);
  }
}

/**
 * The main menu's label for auto-submit, from config only: drawing the menu must
 * not query the OS scheduler (on Windows that starts PowerShell). Null on a
 * platform auto-submit does not support, so the menu leaves the item out.
 */
export function autosubmitMenuLabel(platform: NodeJS.Platform = process.platform): string | null {
  if (!SUPPORTED_PLATFORMS.includes(platform)) return null;
  const config = getConfig();
  if (config.get("autoSync") !== true) return "Auto-submit: OFF";
  const time = config.get("autoSyncTime");
  return time ? `Auto-submit: ON · daily ${time}` : "Auto-submit: ON";
}

/**
 * Choosing the main menu's auto-submit item. Off: the same path as
 * `autosubmit on`. On: Change time, Turn off or Back. A failure prints its lines
 * and returns, so the menu carries on.
 */
export async function autosubmitMenuChoose(context: AutosubmitContext = {}): Promise<void> {
  const config = getConfig();
  if (config.get("autoSync") !== true) {
    await runFromMenu(() => autosubmitEnable({}, context), REGISTER_FAILED);
    return;
  }

  const { autosubmitAction } = await inquirer.prompt([
    {
      type: "list",
      name: "autosubmitAction",
      message: "Auto-submit",
      choices: [
        { name: "Change time", value: "time" },
        { name: "Turn off", value: "off" },
        { name: "Back", value: "back" },
      ],
      loop: false,
    },
  ]);

  if (autosubmitAction === "time") {
    const { newTime } = await inquirer.prompt([
      {
        type: "input",
        name: "newTime",
        message: "New time (HH:MM, 24-hour):",
        validate: (value: string) =>
          parseDailyTime(value) ? true : "Use HH:MM, 24-hour, for example 21:30.",
      },
    ]);
    await runFromMenu(
      () => autosubmitEnable({ at: newTime, starPrompt: false }, context),
      REGISTER_FAILED
    );
  } else if (autosubmitAction === "off") {
    await runFromMenu(() => autosubmitOff(context), TURN_OFF_FAILED);
  }
}

async function runFromMenu(action: () => Promise<void>, prefix: string): Promise<void> {
  try {
    await action();
  } catch (err) {
    printFailure(err, prefix);
  }
}
