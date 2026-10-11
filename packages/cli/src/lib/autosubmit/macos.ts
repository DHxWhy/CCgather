import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import {
  AutosubmitStatus,
  Backend,
  DailyTime,
  EnablePlan,
  EnableResult,
  assertSingleLine,
  describeFailure,
  readLastLogLine,
  run,
  xmlEscape,
  xmlUnescape,
} from "./shared.js";

/**
 * macOS: a per-user LaunchAgent. launchd runs it at the chosen time and at
 * load (login, or right after enabling), which catches up a day the Mac was
 * off; the 20-hour guard in `submit --scheduled` skips the second run.
 */

export const LAUNCH_AGENT_LABEL = "com.ccgather.autosubmit";

const SCHEDULER = "launchd";

export interface MacosPaths {
  plist: string;
  log: string;
}

export function macosPaths(home: string): MacosPaths {
  return {
    plist: path.join(home, "Library", "LaunchAgents", `${LAUNCH_AGENT_LABEL}.plist`),
    log: path.join(home, "Library", "Logs", "ccgather", "autosubmit.log"),
  };
}

export interface PlistOptions {
  argv: string[];
  time: DailyTime;
  home: string;
  log: string;
}

export function buildPlist(options: PlistOptions): string {
  const nodeDir = path.posix.dirname(options.argv[0]);
  const string = (value: string): string => `<string>${xmlEscape(value)}</string>`;
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
    '<plist version="1.0">',
    "<dict>",
    "  <key>Label</key>",
    `  ${string(LAUNCH_AGENT_LABEL)}`,
    "  <key>ProgramArguments</key>",
    "  <array>",
    ...options.argv.map((arg) => `    ${string(arg)}`),
    "  </array>",
    "  <key>StartCalendarInterval</key>",
    "  <dict>",
    "    <key>Hour</key>",
    `    <integer>${options.time.hour}</integer>`,
    "    <key>Minute</key>",
    `    <integer>${options.time.minute}</integer>`,
    "  </dict>",
    "  <key>RunAtLoad</key>",
    "  <true/>",
    "  <key>WorkingDirectory</key>",
    `  ${string(options.home)}`,
    "  <key>EnvironmentVariables</key>",
    "  <dict>",
    "    <key>PATH</key>",
    `    ${string(`${nodeDir}:/usr/bin:/bin:/usr/sbin:/sbin`)}`,
    "  </dict>",
    "  <key>StandardOutPath</key>",
    `  ${string(options.log)}`,
    "  <key>StandardErrorPath</key>",
    `  ${string(options.log)}`,
    "</dict>",
    "</plist>",
    "",
  ].join("\n");
}

/** Read back the argv and time from a plist this module wrote */
export function parsePlist(source: string): { argv?: string[]; time?: DailyTime } {
  const result: { argv?: string[]; time?: DailyTime } = {};
  const args = /<key>ProgramArguments<\/key>\s*<array>([\s\S]*?)<\/array>/.exec(source);
  if (args) {
    result.argv = [...args[1].matchAll(/<string>([\s\S]*?)<\/string>/g)].map((match) =>
      xmlUnescape(match[1])
    );
  }
  const hour = /<key>Hour<\/key>\s*<integer>(\d+)<\/integer>/.exec(source);
  const minute = /<key>Minute<\/key>\s*<integer>(\d+)<\/integer>/.exec(source);
  if (hour && minute) {
    result.time = { hour: Number(hour[1]), minute: Number(minute[1]) };
  }
  return result;
}

/** The job's state from `launchctl print gui/<uid>/<label>` */
export function parseLaunchctlPrint(text: string): {
  state?: string;
  lastFailure?: string;
} {
  const state = /^\s*state = (.+)$/m.exec(text);
  const exit = /^\s*last exit code = (.+)$/m.exec(text);
  const info: { state?: string; lastFailure?: string } = {};
  if (state) info.state = state[1].trim();
  // Anything but a number ("(never exited)") is not a failure
  if (exit && /^-?\d+$/.test(exit[1].trim()) && Number(exit[1].trim()) !== 0) {
    info.lastFailure = `exit code ${exit[1].trim()}`;
  }
  return info;
}

export interface MacosBackendOptions {
  home?: string;
  uid?: number;
  sleep?: (ms: number) => Promise<void>;
}

// launchctl bootstrap's "Input/output error"
const BOOTSTRAP_IO_ERROR = 5;

export function createMacosBackend(options: MacosBackendOptions = {}): Backend {
  const home = options.home ?? os.homedir();
  const uid = options.uid ?? process.getuid?.() ?? 0;
  const sleep =
    options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const paths = macosPaths(home);
  const domain = `gui/${uid}`;
  const service = `${domain}/${LAUNCH_AGENT_LABEL}`;

  function writePlist(content: string | Buffer): void {
    fs.writeFileSync(paths.plist, content, { mode: 0o644 });
    // mode only applies to a new file; an existing one keeps its old mode
    fs.chmodSync(paths.plist, 0o644);
  }

  return {
    async enable(plan: EnablePlan): Promise<EnableResult> {
      assertSingleLine(plan.command.argv);
      fs.mkdirSync(path.dirname(paths.plist), { recursive: true });
      // launchd does not create the log directory
      fs.mkdirSync(path.dirname(paths.log), { recursive: true });

      const plist = buildPlist({
        argv: plan.command.argv,
        time: plan.time,
        home: plan.home,
        log: paths.log,
      });
      const previous = fs.existsSync(paths.plist) ? fs.readFileSync(paths.plist) : null;
      writePlist(plist);

      // Unload any earlier copy so the new schedule takes effect
      await run("launchctl", ["bootout", service]);
      let result = await run("launchctl", ["bootstrap", domain, paths.plist]);
      if (result.code === BOOTSTRAP_IO_ERROR) {
        // bootout can still be finishing; launchctl then answers 5 (EIO) once
        await sleep(1000);
        result = await run("launchctl", ["bootstrap", domain, paths.plist]);
      }
      if (result.code !== 0) {
        // Leave nothing behind that launchd would load at the next login
        if (previous) {
          writePlist(previous);
          await run("launchctl", ["bootstrap", domain, paths.plist]);
        } else {
          fs.rmSync(paths.plist, { force: true });
        }
        throw new Error(`launchctl could not load the LaunchAgent: ${describeFailure(result)}`);
      }

      return {
        scheduler: SCHEDULER,
        notes: [
          "launchd also runs it now and at each login, which catches up a missed day; a second run within 20 hours is skipped.",
          'macOS may show a "Background Items Added" notification once.',
        ],
      };
    },

    async disable(): Promise<boolean> {
      const result = await run("launchctl", ["bootout", service]);
      let removed = result.code === 0;
      if (fs.existsSync(paths.plist)) {
        fs.rmSync(paths.plist, { force: true });
        removed = true;
      }
      return removed;
    },

    async status(): Promise<AutosubmitStatus> {
      const status: AutosubmitStatus = {
        registered: false,
        scheduler: SCHEDULER,
        log: paths.log,
        lastLogLine: readLastLogLine(paths.log),
      };

      let source: string;
      try {
        source = fs.readFileSync(paths.plist, "utf8");
      } catch {
        return status;
      }
      Object.assign(status, parsePlist(source));

      const printed = await run("launchctl", ["print", service]);
      if (printed.code !== 0) {
        status.state = "installed but not loaded";
        return status;
      }
      status.registered = true;
      const info = parseLaunchctlPrint(printed.stdout);
      status.state = info.state;
      status.lastFailure = info.lastFailure;
      return status;
    },
  };
}
