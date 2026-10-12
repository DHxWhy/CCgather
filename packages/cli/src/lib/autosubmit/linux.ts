import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import {
  AutosubmitStatus,
  AutosubmitError,
  Backend,
  DailyTime,
  EnablePlan,
  EnableResult,
  JOB_NAME,
  assertSingleLine,
  describeFailure,
  formatDailyTime,
  readLastLogLine,
  run,
} from "./shared.js";

/**
 * Linux: a systemd user timer where the user manager really runs, otherwise
 * one crontab line between marker comments.
 */

export const SERVICE_UNIT = `${JOB_NAME}.service`;
export const TIMER_UNIT = `${JOB_NAME}.timer`;
export const CRON_BEGIN = "# ccgather autosubmit begin";
export const CRON_END = "# ccgather autosubmit end";
export const JOURNAL_HINT = `journalctl --user -u ${JOB_NAME}`;
const SYSTEMD_SCHEDULER = "systemd user timer";
const CRON_SCHEDULER = "cron";
export const LINGER_HINT = "loginctl enable-linger $USER";

export interface LinuxPaths {
  service: string;
  timer: string;
  // The link `systemctl --user enable` creates
  timerWants: string;
  cronLog: string;
}

export function linuxPaths(home: string): LinuxPaths {
  const unitDir = path.join(home, ".config", "systemd", "user");
  return {
    service: path.join(unitDir, SERVICE_UNIT),
    timer: path.join(unitDir, TIMER_UNIT),
    timerWants: path.join(unitDir, "timers.target.wants", TIMER_UNIT),
    cronLog: path.join(home, ".local", "state", "ccgather", "autosubmit.log"),
  };
}

// PATH for the job: node's own directory first, for npx's child processes
function jobPath(argv: string[]): string {
  const dirs = [path.posix.dirname(argv[0]), "/usr/local/bin", "/usr/bin", "/bin"];
  return [...new Set(dirs)].join(":");
}

// ═══════════════════════════════════════════════════════════════════════════
// systemd
// ═══════════════════════════════════════════════════════════════════════════

/**
 * One quoted unit-file word. Inside double quotes systemd reads C escapes, so
 * \ and " are backslash-escaped; % starts a specifier (%%), and in ExecStart a
 * $ starts a variable ($$). Environment= does not expand $.
 */
export function systemdQuote(value: string, options: { dollar: boolean }): string {
  let escaped = value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/%/g, "%%");
  if (options.dollar) escaped = escaped.replace(/\$/g, () => "$$");
  return `"${escaped}"`;
}

export interface UnitOptions {
  argv: string[];
  xdgConfigHome?: string;
}

export function buildServiceUnit(options: UnitOptions): string {
  const environment = [`PATH=${jobPath(options.argv)}`];
  if (options.xdgConfigHome) environment.push(`XDG_CONFIG_HOME=${options.xdgConfigHome}`);
  return [
    "[Unit]",
    "Description=Submit Claude Code usage to CCgather (ccgather autosubmit)",
    "",
    "[Service]",
    "Type=oneshot",
    "WorkingDirectory=%h",
    ...environment.map((entry) => `Environment=${systemdQuote(entry, { dollar: false })}`),
    `ExecStart=${options.argv.map((arg) => systemdQuote(arg, { dollar: true })).join(" ")}`,
    "",
  ].join("\n");
}

export function buildTimerUnit(time: DailyTime): string {
  return [
    "[Unit]",
    `Description=Run ccgather autosubmit every day at ${formatDailyTime(time)}`,
    "",
    "[Timer]",
    `OnCalendar=*-*-* ${formatDailyTime(time)}:00`,
    "Persistent=true",
    "",
    "[Install]",
    "WantedBy=timers.target",
    "",
  ].join("\n");
}

/** Read the words of an ExecStart line written by buildServiceUnit */
export function parseExecStart(unit: string): string[] | undefined {
  const line = /^ExecStart=(.*)$/m.exec(unit);
  if (!line) return undefined;
  const words: string[] = [];
  const pattern = /"((?:[^"\\]|\\.)*)"/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(line[1])) !== null) {
    words.push(
      match[1]
        .replace(/\\(.)/g, "$1")
        .replace(/%%/g, "%")
        .replace(/\$\$/g, () => "$")
    );
  }
  return words;
}

export function parseOnCalendar(unit: string): DailyTime | undefined {
  const match = /^OnCalendar=\*-\*-\* (\d{2}):(\d{2})/m.exec(unit);
  return match ? { hour: Number(match[1]), minute: Number(match[2]) } : undefined;
}

/** `systemctl show` prints Key=Value lines */
export function parseSystemctlShow(text: string): Record<string, string> {
  const values: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const index = line.indexOf("=");
    if (index > 0) values[line.slice(0, index)] = line.slice(index + 1).trim();
  }
  return values;
}

function present(value: string | undefined): string | undefined {
  return value && value !== "n/a" && value !== "0" ? value : undefined;
}

/**
 * The user manager really runs: `is-system-running` says running or degraded
 * (it exits non-zero for degraded, so the exit code is ignored) and
 * XDG_RUNTIME_DIR is set, which systemctl --user needs to reach it.
 */
export async function systemdUserAvailable(env: NodeJS.ProcessEnv): Promise<boolean> {
  if (!env.XDG_RUNTIME_DIR) return false;
  const result = await run("systemctl", ["--user", "is-system-running"]);
  const state = result.stdout.trim();
  return state === "running" || state === "degraded";
}

// ═══════════════════════════════════════════════════════════════════════════
// cron
// ═══════════════════════════════════════════════════════════════════════════

/** One POSIX-shell single-quoted word */
export function shQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

export interface CronOptions {
  argv: string[];
  time: DailyTime;
  log: string;
  xdgConfigHome?: string;
}

/**
 * The marker block. cron starts the line in the home directory through
 * /bin/sh, and turns an unescaped % into a newline, so every % is written \%.
 */
export function buildCronBlock(options: CronOptions): string {
  const words = [`PATH=${shQuote(jobPath(options.argv))}`];
  if (options.xdgConfigHome) words.push(`XDG_CONFIG_HOME=${shQuote(options.xdgConfigHome)}`);
  words.push(...options.argv.map(shQuote), ">>", shQuote(options.log), "2>&1");
  const command = words.join(" ").replace(/%/g, "\\%");
  return [
    CRON_BEGIN,
    `${options.time.minute} ${options.time.hour} * * * ${command}`,
    CRON_END,
  ].join("\n");
}

/**
 * Replace (or with block null, remove) the marker block, leaving every other
 * line exactly as it was. A begin marker without its end is refused rather
 * than guessed at, because guessing could delete the user's own lines.
 */
export function applyCronBlock(current: string, block: string | null): string {
  const lines = current.split("\n");
  if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();

  const kept: string[] = [];
  let inside = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === CRON_BEGIN) {
      if (inside) throw new Error("Your crontab has a broken ccgather block; nothing was changed.");
      inside = true;
    } else if (trimmed === CRON_END) {
      if (!inside)
        throw new Error("Your crontab has a broken ccgather block; nothing was changed.");
      inside = false;
    } else if (!inside) {
      kept.push(line);
    }
  }
  if (inside) throw new Error("Your crontab has a broken ccgather block; nothing was changed.");

  if (block) kept.push(...block.split("\n"));
  return kept.length > 0 ? `${kept.join("\n")}\n` : "";
}

export function hasCronBlock(current: string): boolean {
  return current.split("\n").some((line) => line.trim() === CRON_BEGIN);
}

/** Split words the way /bin/sh does for single quotes and backslashes */
function splitShellWords(text: string): string[] {
  const words: string[] = [];
  let word: string | null = null;
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === "'") quoted = false;
      else word += char;
    } else if (char === "'") {
      quoted = true;
      word = word ?? "";
    } else if (char === "\\" && i + 1 < text.length) {
      word = (word ?? "") + text[++i];
    } else if (/\s/.test(char)) {
      if (word !== null) words.push(word);
      word = null;
    } else {
      word = (word ?? "") + char;
    }
  }
  if (word !== null) words.push(word);
  return words;
}

/** Read back the time and argv from the marker block */
export function parseCronBlock(current: string): { time?: DailyTime; argv?: string[] } {
  const lines = current.split("\n");
  const begin = lines.findIndex((line) => line.trim() === CRON_BEGIN);
  const entry = begin >= 0 ? lines[begin + 1] : undefined;
  const match = entry ? /^(\d+) (\d+) \* \* \* (.*)$/.exec(entry) : null;
  if (!match) return {};

  // Split the shell words, then drop the environment prefix and redirection
  const words = splitShellWords(match[3].replace(/\\%/g, "%"));
  const argv: string[] = [];
  for (const word of words) {
    if (word === ">>") break;
    if (argv.length === 0 && /^[A-Z_]+=/.test(word)) continue;
    argv.push(word);
  }
  return { time: { hour: Number(match[2]), minute: Number(match[1]) }, argv };
}

type CrontabRead = { ok: true; content: string } | { ok: false; missing: boolean; message: string };

// How `crontab -l` says the user has no table yet: Vixie cron and cronie
// ("no crontab for alice"), and BusyBox, as on Alpine ("crontab: can't open
// 'alice': No such file or directory")
const NO_CRONTAB = /no crontab for|can't open '[^']*': No such file or directory/i;

/**
 * Read the current crontab. A missing table is an empty table; any other
 * failure is reported, because writing a table built from a failed read
 * would wipe the user's entries.
 */
export async function readCrontab(): Promise<CrontabRead> {
  const result = await run("crontab", ["-l"]);
  if (result.code === 0) return { ok: true, content: result.stdout };
  if (result.spawnError) return { ok: false, missing: true, message: result.spawnError };
  if (NO_CRONTAB.test(result.stderr)) return { ok: true, content: "" };
  return { ok: false, missing: false, message: describeFailure(result) };
}

const CRON_DAEMONS = new Set(["cron", "crond", "cronie", "fcron", "dcron"]);

/**
 * Whether a cron daemon is running, from /proc/<pid>/comm (and the command
 * line, for `busybox crond`). null when /proc cannot be read, so nothing is
 * claimed either way.
 */
export function cronDaemonRunning(procRoot: string): boolean | null {
  let entries: string[];
  try {
    entries = fs.readdirSync(procRoot);
  } catch {
    return null;
  }
  for (const pid of entries) {
    if (!/^\d+$/.test(pid)) continue;
    try {
      const comm = fs.readFileSync(path.join(procRoot, pid, "comm"), "utf8").trim();
      if (CRON_DAEMONS.has(comm)) return true;
      if (comm === "busybox") {
        const cmdline = fs.readFileSync(path.join(procRoot, pid, "cmdline"), "utf8").split("\0");
        if (cmdline.some((arg) => path.posix.basename(arg) === "crond")) return true;
      }
    } catch {
      // The process exited while we looked
    }
  }
  return false;
}

export async function writeCrontab(content: string, tmpdir: string): Promise<void> {
  const dir = fs.mkdtempSync(path.join(tmpdir, "ccgather-cron-"));
  const file = path.join(dir, "crontab");
  try {
    fs.writeFileSync(file, content, "utf8");
    const result = await run("crontab", [file]);
    if (result.code !== 0) {
      throw new Error(`crontab refused the new table: ${describeFailure(result)}`);
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Backend
// ═══════════════════════════════════════════════════════════════════════════

export interface LinuxBackendOptions {
  home?: string;
  env?: NodeJS.ProcessEnv;
  tmpdir?: string;
  procRoot?: string;
}

function linkExists(file: string): boolean {
  try {
    // lstat: the enable link may dangle once the unit file is gone
    fs.lstatSync(file);
    return true;
  } catch {
    return false;
  }
}

export function createLinuxBackend(options: LinuxBackendOptions = {}): Backend {
  const home = options.home ?? os.homedir();
  const env = options.env ?? process.env;
  const tmpdir = options.tmpdir ?? os.tmpdir();
  const procRoot = options.procRoot ?? "/proc";
  const paths = linuxPaths(home);

  function systemdInstalled(): boolean {
    return (
      fs.existsSync(paths.timer) || fs.existsSync(paths.service) || linkExists(paths.timerWants)
    );
  }

  /**
   * Stop and remove the units. If the user manager cannot be reached (a
   * login without a desktop session, for example), keep the files and say
   * how to finish, because deleting them would orphan a live timer.
   */
  async function removeSystemd(): Promise<boolean> {
    if (!systemdInstalled()) return false;
    const result = await run("systemctl", ["--user", "disable", "--now", TIMER_UNIT]);
    if (result.code !== 0) {
      throw new Error(
        `Could not stop the systemd timer (${describeFailure(result)}). From your desktop session, run \`systemctl --user disable --now ${TIMER_UNIT}\` or \`ccgather autosubmit off\`.`
      );
    }
    fs.rmSync(paths.timer, { force: true });
    fs.rmSync(paths.service, { force: true });
    if (linkExists(paths.timerWants)) fs.rmSync(paths.timerWants, { force: true });
    await run("systemctl", ["--user", "daemon-reload"]);
    return true;
  }

  /** Remove the cron block. A crontab that cannot be read is left untouched. */
  async function removeCron(options: { strict: boolean }): Promise<boolean> {
    const read = await readCrontab();
    if (!read.ok) {
      if (read.missing || !options.strict) return false;
      throw new Error(`Could not read your crontab (${read.message}); nothing was changed.`);
    }
    if (!hasCronBlock(read.content)) return false;
    await writeCrontab(applyCronBlock(read.content, null), tmpdir);
    return true;
  }

  async function enableSystemd(plan: EnablePlan): Promise<EnableResult> {
    const existed = fs.existsSync(paths.timer);
    fs.mkdirSync(path.dirname(paths.timer), { recursive: true });
    fs.writeFileSync(
      paths.service,
      buildServiceUnit({ argv: plan.command.argv, xdgConfigHome: plan.xdgConfigHome })
    );
    fs.writeFileSync(paths.timer, buildTimerUnit(plan.time));

    const steps: string[][] = [
      ["--user", "daemon-reload"],
      ["--user", "enable", "--now", TIMER_UNIT],
    ];
    // An already running timer keeps its old schedule until restarted
    if (existed) steps.push(["--user", "restart", TIMER_UNIT]);
    for (const args of steps) {
      const result = await run("systemctl", args);
      if (result.code !== 0) {
        throw new Error(`systemctl ${args.join(" ")} failed: ${describeFailure(result)}`);
      }
    }

    // A cron entry from an earlier run would submit twice
    await removeCron({ strict: false });

    return {
      scheduler: SYSTEMD_SCHEDULER,
      notes: [
        `It runs while you are signed in, and catches up at your next login. To run it while signed out, run: ${LINGER_HINT}`,
      ],
    };
  }

  async function enableCron(plan: EnablePlan): Promise<EnableResult> {
    const read = await readCrontab();
    if (!read.ok) {
      throw new Error(
        read.missing
          ? "Neither a systemd user session nor crontab is available, so autosubmit cannot be scheduled here."
          : `Could not read your crontab (${read.message}); nothing was changed.`
      );
    }
    // A crontab line would never run without a daemon; leave the crontab alone
    if (cronDaemonRunning(procRoot) === false) {
      throw new AutosubmitError(
        "no cron daemon is running.",
        "On WSL, enable systemd or start cron (sudo service cron start), then run this again."
      );
    }
    // systemd units from an earlier run would submit twice; if they cannot be
    // removed, stop here before cron is written
    await removeSystemd();

    fs.mkdirSync(path.dirname(paths.cronLog), { recursive: true });
    const block = buildCronBlock({
      argv: plan.command.argv,
      time: plan.time,
      log: paths.cronLog,
      xdgConfigHome: plan.xdgConfigHome,
    });
    await writeCrontab(applyCronBlock(read.content, block), tmpdir);

    return {
      scheduler: CRON_SCHEDULER,
      notes: ["cron skips the run when the computer is off or asleep at that time."],
    };
  }

  async function systemdStatus(): Promise<AutosubmitStatus> {
    const status: AutosubmitStatus = {
      registered: false,
      scheduler: SYSTEMD_SCHEDULER,
      log: JOURNAL_HINT,
    };
    try {
      status.time = parseOnCalendar(fs.readFileSync(paths.timer, "utf8"));
      status.argv = parseExecStart(fs.readFileSync(paths.service, "utf8"));
    } catch {
      // A missing unit file shows up as not registered below
    }

    const timer = await run("systemctl", [
      "--user",
      "show",
      TIMER_UNIT,
      "--property=UnitFileState,ActiveState,NextElapseUSecRealtime",
    ]);
    if (timer.code !== 0) {
      status.state = `systemctl failed: ${describeFailure(timer)}`;
      return status;
    }
    const timerInfo = parseSystemctlShow(timer.stdout);
    status.registered = timerInfo.UnitFileState === "enabled" && fs.existsSync(paths.timer);
    status.state = timerInfo.ActiveState;
    status.nextRun = present(timerInfo.NextElapseUSecRealtime);

    const service = await run("systemctl", [
      "--user",
      "show",
      SERVICE_UNIT,
      "--property=Result,ExecMainStatus,ExecMainExitTimestamp",
    ]);
    if (service.code === 0) {
      const serviceInfo = parseSystemctlShow(service.stdout);
      if (
        present(serviceInfo.ExecMainExitTimestamp) &&
        serviceInfo.Result &&
        serviceInfo.Result !== "success"
      ) {
        status.lastFailure = `${serviceInfo.Result} (exit ${serviceInfo.ExecMainStatus})`;
      }
    }
    return status;
  }

  async function cronStatus(): Promise<AutosubmitStatus> {
    const status: AutosubmitStatus = {
      registered: false,
      scheduler: CRON_SCHEDULER,
      log: paths.cronLog,
      lastLogLine: readLastLogLine(paths.cronLog),
    };
    const read = await readCrontab();
    if (!read.ok) {
      if (!read.missing) status.state = `could not read your crontab (${read.message})`;
      return status;
    }
    if (!hasCronBlock(read.content)) return status;
    status.registered = true;
    Object.assign(status, parseCronBlock(read.content));
    if (cronDaemonRunning(procRoot) === false) {
      status.state = "registered, but no cron daemon is running";
    }
    return status;
  }

  return {
    async enable(plan: EnablePlan): Promise<EnableResult> {
      assertSingleLine([...plan.command.argv, plan.xdgConfigHome ?? ""]);
      if (await systemdUserAvailable(env)) return enableSystemd(plan);
      return enableCron(plan);
    },

    async disable(): Promise<boolean> {
      const systemd = await removeSystemd();
      const cron = await removeCron({ strict: true });
      return systemd || cron;
    },

    async status(): Promise<AutosubmitStatus> {
      return systemdInstalled() ? systemdStatus() : cronStatus();
    },
  };
}
