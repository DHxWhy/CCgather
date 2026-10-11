import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import {
  AutosubmitStatus,
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
  stripBom,
  xmlEscape,
} from "./shared.js";

/**
 * Windows: a Task Scheduler task that starts wscript.exe on a small JScript
 * launcher. node.exe is a console program, so an interactive-token task that
 * started it directly would flash a window; wscript.exe is a GUI program and
 * WScript.Shell.Run(command, 0, true) starts the console child hidden.
 */

const MECHANISM = `Task Scheduler task "${JOB_NAME}"`;

// Task Scheduler result codes that are states, not failures
const TASK_HAS_NOT_RUN = 0x41303;
const TASK_RUNNING = 0x41301;
const TASK_TERMINATED = 0x41306;

export interface WindowsPaths {
  launcher: string;
  log: string;
}

export function windowsPaths(localAppData: string): WindowsPaths {
  const dir = path.join(localAppData, "ccgather");
  return {
    launcher: path.join(dir, "autosubmit.js"),
    log: path.join(dir, "autosubmit.log"),
  };
}

function unicodeEscape(char: string): string {
  return `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`;
}

/**
 * A single-quoted JScript string literal in plain ASCII. Windows Script Host
 * reads a script without a BOM in the ANSI code page, so every control or
 * non-ASCII character is written as a \uXXXX escape.
 */
export function jscriptString(value: string): string {
  const escaped = value
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/[^\x20-\x7e]/g, unicodeEscape);
  return `'${escaped}'`;
}

/**
 * Refuse a path the launcher cannot pass on unchanged. WScript.Shell.Run
 * expands %VAR% in its command string before cmd.exe sees it, and cmd.exe
 * expands it again, so a literal % cannot be carried safely. A double quote
 * cannot appear in a Windows path at all.
 */
export function assertLaunchable(values: string[]): void {
  for (const value of values) {
    if (value.includes("%")) {
      throw new Error(
        `Cannot schedule ${value} because it contains "%", which Windows would expand as an environment variable. Move it to a folder without "%" and run \`npx ccgather autosubmit on\` again.`
      );
    }
    if (value.includes('"')) {
      throw new Error(`Cannot schedule ${value} because it contains a double quote.`);
    }
  }
}

/**
 * The command line the launcher hands to WScript.Shell.Run:
 *
 *   cmd /d /v:off /s /c ""<arg0>" "<arg1>" ... >> "<log>" 2>&1"
 *
 * /d skips any AutoRun command in the registry. /v:off turns delayed
 * expansion off even where the registry's DelayedExpansion=1 turns it on by
 * default; with it on, cmd would expand !NAME! and drop ^ inside a path. With
 * /s, cmd removes exactly the first and the last quote after /c and runs what
 * is between them as written. Every argument and the log path are quoted, so
 * spaces, &, ^, parentheses and ! in a path are literal text to cmd. A % is
 * refused before the line is built (see assertLaunchable).
 */
export function buildCmdLine(argv: string[], log: string): string {
  assertLaunchable([...argv, log]);
  const args = argv.map((arg) => `"${arg}"`).join(" ");
  return `cmd /d /v:off /s /c "${args} >> "${log}" 2>&1"`;
}

export function buildLauncher(argv: string[], log: string): string {
  const command = buildCmdLine(argv, log);
  const nodeDir = path.win32.dirname(argv[0]);
  return [
    "// ccgather autosubmit launcher, written by `ccgather autosubmit`.",
    `// The ${JOB_NAME} scheduled task runs it with wscript.exe so the job starts`,
    "// without a console window. Run `npx ccgather autosubmit on` again to rewrite it.",
    `// ccgather-argv: ${JSON.stringify(argv).replace(/[^\x20-\x7e]/g, unicodeEscape)}`,
    "var shell = new ActiveXObject('WScript.Shell');",
    "// Task Scheduler builds PATH from the registry, which fnm and profile-only",
    "// setups never touch, and npm's .cmd shims fall back to a bare `node`. Put",
    "// the node this job runs first on PATH. A value set here is not passed",
    "// through Run's %VAR% expansion.",
    "var env = shell.Environment('Process');",
    `env('PATH') = ${jscriptString(nodeDir)} + ';' + env('PATH');`,
    `var code = shell.Run(${jscriptString(command)}, 0, true);`,
    "WScript.Quit(code);",
    "",
  ].join("\r\n");
}

/** Recover the argv a launcher runs, or null when it is not one of ours */
export function parseLauncherArgv(source: string): string[] | null {
  const match = /^\/\/ ccgather-argv: (.*?)\r?$/m.exec(source);
  if (!match) return null;
  try {
    const argv = JSON.parse(match[1]) as unknown;
    return Array.isArray(argv) && argv.every((item) => typeof item === "string") ? argv : null;
  } catch {
    return null;
  }
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export interface TaskXmlOptions {
  time: DailyTime;
  // Local date the daily trigger starts from
  today: Date;
  userId: string;
  launcher: string;
  home: string;
}

export function buildTaskXml(options: TaskXmlOptions): string {
  const { time, today } = options;
  const startBoundary = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}T${formatDailyTime(time)}:00`;
  const userId = xmlEscape(options.userId);
  return [
    '<?xml version="1.0" encoding="UTF-16"?>',
    '<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">',
    "  <RegistrationInfo>",
    `    <Description>Submits your Claude Code usage to CCgather once a day. Created by ccgather autosubmit; remove it with: npx ccgather autosubmit off</Description>`,
    "  </RegistrationInfo>",
    "  <Triggers>",
    "    <CalendarTrigger>",
    `      <StartBoundary>${startBoundary}</StartBoundary>`,
    "      <Enabled>true</Enabled>",
    "      <ScheduleByDay>",
    "        <DaysInterval>1</DaysInterval>",
    "      </ScheduleByDay>",
    "    </CalendarTrigger>",
    "    <LogonTrigger>",
    "      <Enabled>true</Enabled>",
    `      <UserId>${userId}</UserId>`,
    "    </LogonTrigger>",
    "  </Triggers>",
    "  <Principals>",
    '    <Principal id="Author">',
    `      <UserId>${userId}</UserId>`,
    "      <LogonType>InteractiveToken</LogonType>",
    "      <RunLevel>LeastPrivilege</RunLevel>",
    "    </Principal>",
    "  </Principals>",
    "  <Settings>",
    "    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>",
    "    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>",
    "    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>",
    "    <StartWhenAvailable>true</StartWhenAvailable>",
    "    <RunOnlyIfNetworkAvailable>false</RunOnlyIfNetworkAvailable>",
    "    <Enabled>true</Enabled>",
    "    <ExecutionTimeLimit>PT10M</ExecutionTimeLimit>",
    "  </Settings>",
    '  <Actions Context="Author">',
    "    <Exec>",
    "      <Command>wscript.exe</Command>",
    `      <Arguments>${xmlEscape(`//B //Nologo //E:jscript "${options.launcher}"`)}</Arguments>`,
    `      <WorkingDirectory>${xmlEscape(options.home)}</WorkingDirectory>`,
    "    </Exec>",
    "  </Actions>",
    "</Task>",
    "",
  ].join("\r\n");
}

/** schtasks reads /XML files as UTF-16 LE with a byte order mark */
export function encodeTaskXml(xml: string): Buffer {
  return Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(xml, "utf16le")]);
}

/** The daily time in a task's XML (from `schtasks /Query /XML`) */
export function parseTaskXmlTime(xml: string): DailyTime | undefined {
  const match = /<CalendarTrigger>[\s\S]*?<StartBoundary>\d{4}-\d{2}-\d{2}T(\d{2}):(\d{2})/.exec(
    xml
  );
  return match ? { hour: Number(match[1]), minute: Number(match[2]) } : undefined;
}

/** Parse CSV as schtasks writes it: every field quoted, "" inside a field */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  row.push(field);
  if (row.some((value) => value.length > 0)) rows.push(row);
  return rows;
}

/**
 * The numeric Last Result from `schtasks /Query /V /FO CSV`, the fallback
 * when PowerShell is unavailable. schtasks writes in the console's OEM code
 * page and localises its column names, dates and states, so only this number
 * (column 6, after the header row) is relied on.
 */
export function parseTaskResultCsv(text: string): number | undefined {
  const [, first] = parseCsv(text);
  const code = Number.parseInt(first?.[6] ?? "", 10);
  return Number.isFinite(code) ? code : undefined;
}

export function describeTaskResult(code: number): string {
  const unsigned = code >>> 0;
  const hex = `0x${unsigned.toString(16).toUpperCase()}`;
  if (unsigned === TASK_HAS_NOT_RUN) return "has not run yet";
  if (unsigned === TASK_RUNNING) return "running now";
  if (unsigned === TASK_TERMINATED) return "stopped (time limit reached or ended manually)";
  if (unsigned === 0) return "0 (success)";
  const win32Error = unsigned >= 0x80070000 && unsigned <= 0x8007ffff;
  const schedulerError = unsigned >= 0x80041300 && unsigned <= 0x800413ff;
  if (win32Error || schedulerError) {
    return `${hex} (failed to start; if Windows Script Host is disabled by policy, wscript.exe cannot run the launcher)`;
  }
  return `the job exited with code ${code} (${hex}); see the log`;
}

/**
 * Status through PowerShell's ScheduledTasks module, with output forced to
 * UTF-8 so localised states and dates arrive intact. Single quotes only: the
 * script is one argv element.
 */
export const POWERSHELL_STATUS_SCRIPT = [
  "$ErrorActionPreference='Stop'",
  "[Console]::OutputEncoding=[Text.Encoding]::UTF8",
  `$t=Get-ScheduledTask -TaskName '${JOB_NAME}' -TaskPath '\\'`,
  "$i=$t|Get-ScheduledTaskInfo",
  "[pscustomobject]@{State=[string]$t.State;" +
    "LastRunTime=$(if($i.LastRunTime){$i.LastRunTime.ToString('o')}else{$null});" +
    "NextRunTime=$(if($i.NextRunTime){$i.NextRunTime.ToString('o')}else{$null});" +
    "LastTaskResult=$i.LastTaskResult;" +
    "StartBoundaries=@($t.Triggers|ForEach-Object{[string]$_.StartBoundary})}|ConvertTo-Json -Compress",
].join(";");

export interface TaskInfo {
  state?: string;
  lastRun?: string;
  nextRun?: string;
  lastResult?: string;
  time?: DailyTime;
}

/** Parse the JSON POWERSHELL_STATUS_SCRIPT prints; null when it is not that */
export function parsePowerShellStatus(text: string): TaskInfo | null {
  let data: {
    State?: unknown;
    LastRunTime?: unknown;
    NextRunTime?: unknown;
    LastTaskResult?: unknown;
    StartBoundaries?: unknown;
  };
  try {
    data = JSON.parse(stripBom(text).trim()) as typeof data;
  } catch {
    return null;
  }
  if (!data || typeof data !== "object") return null;

  const info: TaskInfo = {};
  if (typeof data.State === "string" && data.State) info.state = data.State;
  if (typeof data.NextRunTime === "string" && data.NextRunTime) info.nextRun = data.NextRunTime;
  const code = typeof data.LastTaskResult === "number" ? data.LastTaskResult : undefined;
  if (code !== undefined) {
    info.lastResult = describeTaskResult(code);
    if (code >>> 0 !== TASK_HAS_NOT_RUN && typeof data.LastRunTime === "string") {
      info.lastRun = data.LastRunTime;
    }
  }
  const boundaries = Array.isArray(data.StartBoundaries)
    ? data.StartBoundaries
    : [data.StartBoundaries];
  for (const boundary of boundaries) {
    const match = typeof boundary === "string" ? /T(\d{2}):(\d{2})/.exec(boundary) : null;
    if (match) {
      info.time = { hour: Number(match[1]), minute: Number(match[2]) };
      break;
    }
  }
  return info;
}

export interface WindowsBackendOptions {
  home?: string;
  localAppData?: string;
  tmpdir?: string;
  now?: () => Date;
}

/**
 * The task's user as `whoami` prints it (DOMAIN\user). whoami answers in the
 * console code page, so a name that does not come back as plain ASCII is
 * taken from the environment instead, which Node reads as Unicode.
 */
async function currentUserId(): Promise<string> {
  const result = await run("whoami", []);
  const name = result.stdout.trim();
  if (result.code === 0 && /^[\x21-\x7e][\x20-\x7e]*\\[\x20-\x7e]+$/.test(name)) return name;

  const user = process.env.USERNAME;
  if (!user) throw new Error("Could not determine the current Windows user.");
  return process.env.USERDOMAIN ? `${process.env.USERDOMAIN}\\${user}` : user;
}

export function createWindowsBackend(options: WindowsBackendOptions = {}): Backend {
  const home = options.home ?? os.homedir();
  const localAppData =
    options.localAppData ?? process.env.LOCALAPPDATA ?? path.join(home, "AppData", "Local");
  const tmpdir = options.tmpdir ?? os.tmpdir();
  const now = options.now ?? (() => new Date());
  const paths = windowsPaths(localAppData);

  async function isRegistered(): Promise<boolean> {
    const result = await run("schtasks", ["/Query", "/TN", JOB_NAME]);
    return result.code === 0;
  }

  return {
    async enable(plan: EnablePlan): Promise<EnableResult> {
      const { argv } = plan.command;
      assertSingleLine(argv);
      // Builds the command line first, so a refused path changes nothing
      const launcher = buildLauncher(argv, paths.log);

      fs.mkdirSync(path.dirname(paths.launcher), { recursive: true });
      fs.writeFileSync(paths.launcher, launcher, "utf8");

      const xml = buildTaskXml({
        time: plan.time,
        today: now(),
        userId: await currentUserId(),
        launcher: paths.launcher,
        home: plan.home,
      });

      const dir = fs.mkdtempSync(path.join(tmpdir, "ccgather-task-"));
      const xmlFile = path.join(dir, "task.xml");
      try {
        fs.writeFileSync(xmlFile, encodeTaskXml(xml));
        const result = await run("schtasks", ["/Create", "/TN", JOB_NAME, "/XML", xmlFile, "/F"]);
        if (result.code !== 0) {
          throw new Error(`Task Scheduler refused the task: ${describeFailure(result)}`);
        }
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }

      return {
        log: paths.log,
        notes: [
          "If the computer is off or asleep at that time, it runs when it can, and at each sign-in; a second run within 20 hours is skipped.",
        ],
      };
    },

    async disable(): Promise<boolean> {
      let removed = false;
      if (await isRegistered()) {
        const result = await run("schtasks", ["/Delete", "/TN", JOB_NAME, "/F"]);
        if (result.code !== 0) {
          throw new Error(`Could not remove the scheduled task: ${describeFailure(result)}`);
        }
        removed = true;
      }
      if (fs.existsSync(paths.launcher)) {
        fs.rmSync(paths.launcher, { force: true });
        removed = true;
      }
      return removed;
    },

    async status(): Promise<AutosubmitStatus> {
      const status: AutosubmitStatus = {
        registered: false,
        mechanism: MECHANISM,
        log: paths.log,
        lastLogLine: readLastLogLine(paths.log),
      };

      const powershell = await run("powershell.exe", [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        POWERSHELL_STATUS_SCRIPT,
      ]);
      const info = powershell.code === 0 ? parsePowerShellStatus(powershell.stdout) : null;
      if (info) {
        status.registered = true;
        Object.assign(status, info);
      } else {
        // PowerShell failed (task missing, or PowerShell blocked): ask schtasks
        const query = await run("schtasks", ["/Query", "/TN", JOB_NAME, "/V", "/FO", "CSV"]);
        if (query.code !== 0) return status;
        status.registered = true;
        const code = parseTaskResultCsv(query.stdout);
        if (code !== undefined) status.lastResult = describeTaskResult(code);

        const xml = await run("schtasks", ["/Query", "/TN", JOB_NAME, "/XML"]);
        if (xml.code === 0) status.time = parseTaskXmlTime(xml.stdout);
      }

      try {
        status.argv = parseLauncherArgv(fs.readFileSync(paths.launcher, "utf8")) ?? undefined;
      } catch {
        // A missing launcher is reported by the caller as a missing path
        status.argv = undefined;
      }
      return status;
    },
  };
}
