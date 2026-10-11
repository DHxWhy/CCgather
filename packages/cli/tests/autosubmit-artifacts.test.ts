/**
 * `ccgather autosubmit` — the exact files and command lines each scheduler gets
 *
 * Pure builders only: nothing here registers anything with a scheduler. The
 * one test that runs a real program starts cmd.exe on a throwaway script in a
 * temp directory, to prove the quoting holds for awkward paths.
 */

import { describe, it, expect } from "vitest";
import { spawnSync } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import {
  buildCmdLine,
  buildLauncher,
  buildTaskXml,
  encodeTaskXml,
  jscriptString,
  parseLauncherArgv,
  parsePowerShellStatus,
  parseTaskResultCsv,
  parseTaskXmlTime,
  describeTaskResult,
} from "../src/lib/autosubmit/windows";
import { buildPlist, parsePlist, parseLaunchctlPrint } from "../src/lib/autosubmit/macos";
import {
  applyCronBlock,
  buildCronBlock,
  buildServiceUnit,
  buildTimerUnit,
  parseCronBlock,
  parseExecStart,
  parseOnCalendar,
  parseSystemctlShow,
  CRON_BEGIN,
  CRON_END,
} from "../src/lib/autosubmit/linux";
import { decodeOutput, defaultDailyTime, parseDailyTime } from "../src/lib/autosubmit/shared";

// Built from char codes so no editor or tool rewrites the escapes in this file
const E_ACUTE = String.fromCharCode(0xe9);
const ESCAPED_E_ACUTE = "\\" + "u00e9";

const WIN_NODE = String.raw`C:\Program Files\nodejs\node.exe`;
const WIN_NPX = String.raw`C:\Program Files\nodejs\node_modules\npm\bin\npx-cli.js`;
const WIN_LOG = String.raw`C:\Users\alice\AppData\Local\ccgather\autosubmit.log`;
const WIN_LAUNCHER = String.raw`C:\Users\alice\AppData\Local\ccgather\autosubmit.js`;
const WIN_ARGV = [WIN_NODE, WIN_NPX, "--yes", "ccgather@2.1.1", "submit", "--scheduled"];

/** Evaluate a JScript string literal with the same escape rules in JavaScript */
function evalStringLiteral(literal: string): string {
  return new Function(`return ${literal};`)() as string;
}

describe("Windows task XML", () => {
  const xml = buildTaskXml({
    time: { hour: 14, minute: 7 },
    today: new Date(2026, 9, 7, 23, 59),
    userId: String.raw`desktop-1\alice`,
    launcher: WIN_LAUNCHER,
    home: String.raw`C:\Users\alice`,
  });

  it("is exactly the verified task definition", () => {
    expect(xml).toBe(
      [
        '<?xml version="1.0" encoding="UTF-16"?>',
        '<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">',
        "  <RegistrationInfo>",
        "    <Description>Submits your Claude Code usage to CCgather once a day. Created by ccgather autosubmit; remove it with: npx ccgather autosubmit off</Description>",
        "  </RegistrationInfo>",
        "  <Triggers>",
        "    <CalendarTrigger>",
        "      <StartBoundary>2026-10-07T14:07:00</StartBoundary>",
        "      <Enabled>true</Enabled>",
        "      <ScheduleByDay>",
        "        <DaysInterval>1</DaysInterval>",
        "      </ScheduleByDay>",
        "    </CalendarTrigger>",
        "    <LogonTrigger>",
        "      <Enabled>true</Enabled>",
        String.raw`      <UserId>desktop-1\alice</UserId>`,
        "    </LogonTrigger>",
        "  </Triggers>",
        "  <Principals>",
        '    <Principal id="Author">',
        String.raw`      <UserId>desktop-1\alice</UserId>`,
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
        String.raw`      <Arguments>//B //Nologo //E:jscript &quot;C:\Users\alice\AppData\Local\ccgather\autosubmit.js&quot;</Arguments>`,
        String.raw`      <WorkingDirectory>C:\Users\alice</WorkingDirectory>`,
        "    </Exec>",
        "  </Actions>",
        "</Task>",
        "",
      ].join("\r\n")
    );
  });

  it("is written as UTF-16 LE with a byte order mark", () => {
    const bytes = encodeTaskXml(xml);
    expect([...bytes.subarray(0, 4)]).toEqual([0xff, 0xfe, 0x3c, 0x00]);
    expect(bytes.subarray(2).toString("utf16le")).toBe(xml);
    expect(decodeOutput(bytes)).toBe(xml);
  });

  it("escapes every value", () => {
    const escaped = buildTaskXml({
      time: { hour: 9, minute: 0 },
      today: new Date(2026, 0, 2),
      userId: "a&b<c>",
      launcher: String.raw`C:\R&D <x>\it's\autosubmit.js`,
      home: String.raw`C:\Users\R&D`,
    });
    expect(escaped).toContain("<UserId>a&amp;b&lt;c&gt;</UserId>");
    expect(escaped).toContain(
      String.raw`<Arguments>//B //Nologo //E:jscript &quot;C:\R&amp;D &lt;x&gt;\it&apos;s\autosubmit.js&quot;</Arguments>`
    );
    expect(escaped).toContain(String.raw`<WorkingDirectory>C:\Users\R&amp;D</WorkingDirectory>`);
    expect(escaped).toContain("<StartBoundary>2026-01-02T09:00:00</StartBoundary>");
  });

  it("reads the daily time back from schtasks /XML output", () => {
    expect(parseTaskXmlTime(xml)).toEqual({ hour: 14, minute: 7 });
    expect(parseTaskXmlTime(decodeOutput(encodeTaskXml(xml)))).toEqual({ hour: 14, minute: 7 });
  });
});

describe("Windows launcher and cmd line", () => {
  it("builds the cmd /d /v:off /s /c line", () => {
    expect(buildCmdLine(WIN_ARGV, WIN_LOG)).toBe(
      String.raw`cmd /d /v:off /s /c ""C:\Program Files\nodejs\node.exe" "C:\Program Files\nodejs\node_modules\npm\bin\npx-cli.js" "--yes" "ccgather@2.1.1" "submit" "--scheduled" >> "C:\Users\alice\AppData\Local\ccgather\autosubmit.log" 2>&1"`
    );
  });

  it("writes the JScript launcher, putting node's folder first on PATH", () => {
    expect(buildLauncher(WIN_ARGV, WIN_LOG)).toBe(
      [
        "// ccgather autosubmit launcher, written by `ccgather autosubmit`.",
        "// The ccgather-autosubmit scheduled task runs it with wscript.exe so the job starts",
        "// without a console window. Run `npx ccgather autosubmit on` again to rewrite it.",
        String.raw`// ccgather-argv: ["C:\\Program Files\\nodejs\\node.exe","C:\\Program Files\\nodejs\\node_modules\\npm\\bin\\npx-cli.js","--yes","ccgather@2.1.1","submit","--scheduled"]`,
        "var shell = new ActiveXObject('WScript.Shell');",
        "// Task Scheduler builds PATH from the registry, which fnm and profile-only",
        "// setups never touch, and npm's .cmd shims fall back to a bare `node`. Put",
        "// the node this job runs first on PATH. A value set here is not passed",
        "// through Run's %VAR% expansion.",
        "var env = shell.Environment('Process');",
        String.raw`env('PATH') = 'C:\\Program Files\\nodejs' + ';' + env('PATH');`,
        String.raw`var code = shell.Run('cmd /d /v:off /s /c ""C:\\Program Files\\nodejs\\node.exe" "C:\\Program Files\\nodejs\\node_modules\\npm\\bin\\npx-cli.js" "--yes" "ccgather@2.1.1" "submit" "--scheduled" >> "C:\\Users\\alice\\AppData\\Local\\ccgather\\autosubmit.log" 2>&1"', 0, true);`,
        "WScript.Quit(code);",
        "",
      ].join("\r\n")
    );
  });

  it.each([
    String.raw`C:\Users\Jos` + E_ACUTE + String.raw`\R&D ^1 (x86) !it's`,
    String.raw`C:\x!PATH!y`,
    String.raw`C:\caret ^1 one !bang`,
  ])("keeps awkward paths intact, in plain ASCII: %s", (dir) => {
    const argv = [
      dir + String.raw`\node.exe`,
      dir + String.raw`\dist\index.js`,
      "submit",
      "--scheduled",
    ];
    const log = dir + String.raw`\autosubmit.log`;

    const command = buildCmdLine(argv, log);
    expect(command).toBe(
      `cmd /d /v:off /s /c ""${argv[0]}" "${argv[1]}" "submit" "--scheduled" >> "${log}" 2>&1"`
    );

    const launcher = buildLauncher(argv, log);
    expect(/^[\x20-\x7e\r\n]*$/.test(launcher)).toBe(true);

    // The literals the launcher hands to WScript decode to the exact values
    const runLine = /^var code = shell\.Run\((.*), 0, true\);\r?$/m.exec(launcher);
    expect(runLine).not.toBeNull();
    expect(evalStringLiteral(runLine![1])).toBe(command);
    const pathLine = /^env\('PATH'\) = (.*) \+ ';' \+ env\('PATH'\);\r?$/m.exec(launcher);
    expect(pathLine).not.toBeNull();
    expect(evalStringLiteral(pathLine![1])).toBe(dir);

    // status reads the argv back
    expect(parseLauncherArgv(launcher)).toEqual(argv);
  });

  it("writes non-ASCII as escapes and quotes as \\'", () => {
    const dir = String.raw`C:\Users\Jos` + E_ACUTE + String.raw`\it's`;
    const launcher = buildLauncher([dir + String.raw`\node.exe`, "x.js"], WIN_LOG);
    expect(launcher).toContain(ESCAPED_E_ACUTE);
    expect(launcher).toContain(String.raw`\it\'s`);
  });

  it("escapes backslashes, single quotes and control characters in the JScript literal", () => {
    expect(jscriptString(String.raw`a\b'c`)).toBe(String.raw`'a\\b\'c'`);
    expect(jscriptString("tab\there")).toBe("'tab" + "\\" + "u0009here'");
    expect(evalStringLiteral(jscriptString("x" + E_ACUTE + "'\\"))).toBe("x" + E_ACUTE + "'\\");
  });

  it.each([String.raw`C:\Users\a%PATH%b\node.exe`, String.raw`C:\100%\node.exe`])(
    "refuses a path containing %% (WScript.Shell.Run would expand it): %s",
    (node) => {
      expect(() => buildCmdLine([node, "x.js"], WIN_LOG)).toThrow(/contains "%"/);
      expect(() => buildLauncher([node, "x.js"], WIN_LOG)).toThrow(/contains "%"/);
    }
  );

  it("refuses a % in the log path too", () => {
    expect(() => buildCmdLine(WIN_ARGV, String.raw`C:\Users\50%\autosubmit.log`)).toThrow(
      /contains "%"/
    );
  });

  // cmd.exe itself, not a scheduler: a throwaway script in a temp directory
  // whose name holds every awkward character the quoting has to survive. cmd
  // is started with /v:on first, as the registry's DelayedExpansion=1 would,
  // so this passes only if the built line turns delayed expansion off itself.
  it
    .runIf(process.platform === "win32")
    .each([`R&D ^1 (x86) !bang! Jos${E_ACUTE}`, "x!PATH!y", "caret ^1 one !bang"])(
    "survives a real cmd.exe run with delayed expansion on by default: %s",
    (name) => {
      const base = fs.mkdtempSync(path.join(os.tmpdir(), "ccgather-cmd-"));
      const dir = path.join(base, name);
      fs.mkdirSync(dir, { recursive: true });
      try {
        const script = path.join(dir, "echo argv.js");
        fs.writeFileSync(
          script,
          "console.log(JSON.stringify({ argv: process.argv.slice(1) }));\n" +
            "process.exitCode = Number(process.env.CCGATHER_TEST_EXIT || 0);\n"
        );
        const log = path.join(dir, "auto submit.log");
        const argv = [process.execPath, script, "submit", "--scheduled"];
        const command = buildCmdLine(argv, log);
        const tail = `/v:on ${command.slice("cmd ".length)}`;

        const first = spawnSync("cmd", [tail], {
          windowsVerbatimArguments: true,
          windowsHide: true,
          encoding: "utf8",
        });
        expect(first.status).toBe(0);
        const second = spawnSync("cmd", [tail], {
          windowsVerbatimArguments: true,
          windowsHide: true,
          encoding: "utf8",
          env: { ...process.env, CCGATHER_TEST_EXIT: "3" },
        });
        // The child's exit code reaches the caller (Task Scheduler's Last Result)
        expect(second.status).toBe(3);

        const lines = fs.readFileSync(log, "utf8").trim().split(/\r?\n/);
        expect(lines).toHaveLength(2);
        for (const line of lines) {
          const parsed = JSON.parse(line) as { argv: string[] };
          expect(parsed.argv).toEqual([script, "submit", "--scheduled"]);
        }
      } finally {
        fs.rmSync(base, { recursive: true, force: true });
      }
    }
  );
});

describe("Windows status parsing", () => {
  it("reads PowerShell's JSON, including localised states and a UTF-8 BOM", () => {
    const json = JSON.stringify({
      State: "Bereit",
      LastRunTime: "2026-10-07T14:07:01.0000000+02:00",
      NextRunTime: "2026-10-08T14:07:00.0000000+02:00",
      LastTaskResult: 0,
      StartBoundaries: ["2026-10-07T14:07:00", ""],
    });
    expect(parsePowerShellStatus(String.fromCharCode(0xfeff) + json + "\r\n")).toEqual({
      state: "Bereit",
      lastRun: "2026-10-07T14:07:01.0000000+02:00",
      nextRun: "2026-10-08T14:07:00.0000000+02:00",
      lastResult: "0 (success)",
      time: { hour: 14, minute: 7 },
    });
  });

  it("drops the placeholder last run time of a task that has not run", () => {
    const json = JSON.stringify({
      State: "Ready",
      LastRunTime: "1999-11-30T00:00:00.0000000",
      NextRunTime: null,
      LastTaskResult: 0x41303,
      StartBoundaries: "2026-10-07T09:05:00",
    });
    expect(parsePowerShellStatus(json)).toEqual({
      state: "Ready",
      lastResult: "has not run yet",
      time: { hour: 9, minute: 5 },
    });
  });

  it("returns null for anything that is not the status JSON", () => {
    expect(parsePowerShellStatus("")).toBeNull();
    expect(
      parsePowerShellStatus("Get-ScheduledTask : No MSFT_ScheduledTask objects found")
    ).toBeNull();
  });

  it("reads only the numeric Last Result from schtasks CSV, whatever the language", () => {
    const csv = [
      '"Hostname","Aufgabenname","N' +
        String.fromCharCode(0x84) +
        'chste Laufzeit","Status","Anmeldemodus","Letzte Laufzeit","Letztes Ergebnis"',
      '"PC","\\ccgather-autosubmit","Nicht zutreffend","Bereit","Nur interaktiv","30.11.1999 00:00:00","267011"',
    ].join("\r\n");
    expect(parseTaskResultCsv(csv)).toBe(0x41303);
    expect(parseTaskResultCsv('"HostName"\r\n')).toBeUndefined();
  });

  it("names Task Scheduler states and separates start failures from job exit codes", () => {
    expect(describeTaskResult(0)).toBe("0 (success)");
    expect(describeTaskResult(0x41303)).toBe("has not run yet");
    expect(describeTaskResult(0x41301)).toBe("running now");
    expect(describeTaskResult(0x41306)).toBe("stopped (time limit reached or ended manually)");
    expect(describeTaskResult(1)).toBe("the job exited with code 1 (0x1); see the log");
    expect(describeTaskResult(3)).toBe("the job exited with code 3 (0x3); see the log");
    // Win32 HRESULT (file not found) and SCHED_E_* are failures to start
    expect(describeTaskResult(-2147024894)).toMatch(
      /^0x80070002 \(failed to start; .*Windows Script Host/
    );
    expect(describeTaskResult(0x8004131f - 0x100000000)).toMatch(/^0x8004131F \(failed to start/);
    // A large exit code outside those ranges is still the job's own
    expect(describeTaskResult(-1073741510)).toBe(
      "the job exited with code -1073741510 (0xC000013A); see the log"
    );
  });
});

describe("macOS LaunchAgent plist", () => {
  const argv = [
    "/opt/homebrew/bin/node",
    "/opt/homebrew/lib/node_modules/npm/bin/npx-cli.js",
    "--yes",
    "ccgather@2.1.1",
    "submit",
    "--scheduled",
  ];
  const log = "/Users/alice/Library/Logs/ccgather/autosubmit.log";

  it("is exactly the LaunchAgent definition", () => {
    expect(buildPlist({ argv, time: { hour: 14, minute: 7 }, home: "/Users/alice", log })).toBe(
      [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
        '<plist version="1.0">',
        "<dict>",
        "  <key>Label</key>",
        "  <string>com.ccgather.autosubmit</string>",
        "  <key>ProgramArguments</key>",
        "  <array>",
        "    <string>/opt/homebrew/bin/node</string>",
        "    <string>/opt/homebrew/lib/node_modules/npm/bin/npx-cli.js</string>",
        "    <string>--yes</string>",
        "    <string>ccgather@2.1.1</string>",
        "    <string>submit</string>",
        "    <string>--scheduled</string>",
        "  </array>",
        "  <key>StartCalendarInterval</key>",
        "  <dict>",
        "    <key>Hour</key>",
        "    <integer>14</integer>",
        "    <key>Minute</key>",
        "    <integer>7</integer>",
        "  </dict>",
        "  <key>RunAtLoad</key>",
        "  <true/>",
        "  <key>WorkingDirectory</key>",
        "  <string>/Users/alice</string>",
        "  <key>EnvironmentVariables</key>",
        "  <dict>",
        "    <key>PATH</key>",
        "    <string>/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>",
        "  </dict>",
        "  <key>StandardOutPath</key>",
        "  <string>/Users/alice/Library/Logs/ccgather/autosubmit.log</string>",
        "  <key>StandardErrorPath</key>",
        "  <string>/Users/alice/Library/Logs/ccgather/autosubmit.log</string>",
        "</dict>",
        "</plist>",
        "",
      ].join("\n")
    );
  });

  it("escapes every string and reads it back", () => {
    const odd = `/Users/R&D <x> "q" it's ${E_ACUTE}/node`;
    const plist = buildPlist({
      argv: [odd, "/a b/index.js", "submit", "--scheduled"],
      time: { hour: 9, minute: 30 },
      home: "/Users/R&D",
      log,
    });
    expect(plist).toContain(
      `<string>/Users/R&amp;D &lt;x&gt; &quot;q&quot; it&apos;s ${E_ACUTE}/node</string>`
    );
    expect(plist).toContain("<string>/Users/R&amp;D</string>");
    expect(parsePlist(plist)).toEqual({
      argv: [odd, "/a b/index.js", "submit", "--scheduled"],
      time: { hour: 9, minute: 30 },
    });
  });

  it("reads state and last exit code from launchctl print", () => {
    const printed = [
      "gui/501/com.ccgather.autosubmit = {",
      "\tactive count = 0",
      "\tpath = /Users/alice/Library/LaunchAgents/com.ccgather.autosubmit.plist",
      "\ttype = LaunchAgent",
      "\tstate = not running",
      "",
      "\tprogram = /opt/homebrew/bin/node",
      "\truns = 2",
      "\tlast exit code = 1",
      "}",
    ].join("\n");
    expect(parseLaunchctlPrint(printed)).toEqual({
      state: "not running",
      lastResult: "1 (failed; see the log)",
      runs: 2,
    });
    expect(parseLaunchctlPrint("\tstate = running\n\tlast exit code = (never exited)\n")).toEqual({
      state: "running",
      lastResult: "(never exited)",
    });
  });
});

describe("systemd user units", () => {
  const argv = [
    "/usr/bin/node",
    "/usr/lib/node_modules/npm/bin/npx-cli.js",
    "--yes",
    "ccgather@2.1.1",
    "submit",
    "--scheduled",
  ];

  it("writes exactly this service", () => {
    expect(buildServiceUnit({ argv })).toBe(
      [
        "[Unit]",
        "Description=Submit Claude Code usage to CCgather (ccgather autosubmit)",
        "",
        "[Service]",
        "Type=oneshot",
        "WorkingDirectory=%h",
        'Environment="PATH=/usr/bin:/usr/local/bin:/bin"',
        'ExecStart="/usr/bin/node" "/usr/lib/node_modules/npm/bin/npx-cli.js" "--yes" "ccgather@2.1.1" "submit" "--scheduled"',
        "",
      ].join("\n")
    );
  });

  it("adds XDG_CONFIG_HOME only when it was set", () => {
    const unit = buildServiceUnit({ argv, xdgConfigHome: "/home/alice/.cfg 100%" });
    expect(unit).toContain('Environment="XDG_CONFIG_HOME=/home/alice/.cfg 100%%"');
    expect(buildServiceUnit({ argv })).not.toContain("XDG_CONFIG_HOME");
  });

  it("writes exactly this timer", () => {
    expect(buildTimerUnit({ hour: 9, minute: 5 })).toBe(
      [
        "[Unit]",
        "Description=Run ccgather autosubmit every day at 09:05",
        "",
        "[Timer]",
        "OnCalendar=*-*-* 09:05:00",
        "Persistent=true",
        "RandomizedDelaySec=10m",
        "",
        "[Install]",
        "WantedBy=timers.target",
        "",
      ].join("\n")
    );
    expect(parseOnCalendar(buildTimerUnit({ hour: 9, minute: 5 }))).toEqual({
      hour: 9,
      minute: 5,
    });
  });

  it("escapes %, $, quotes and backslashes in ExecStart and reads them back", () => {
    const odd = `/home/a b/100%/$HOME/"q"\\x/${E_ACUTE}/node`;
    const unit = buildServiceUnit({ argv: [odd, "/opt/it's & (x)/index.js", "submit"] });
    expect(unit).toContain(
      `ExecStart="/home/a b/100%%/$$HOME/\\"q\\"\\\\x/${E_ACUTE}/node" "/opt/it's & (x)/index.js" "submit"`
    );
    // Environment= gets %% but no $$ (systemd does not expand $ there)
    expect(unit).toContain(`Environment="PATH=/home/a b/100%%/$HOME/\\"q\\"\\\\x/${E_ACUTE}:`);
    expect(parseExecStart(unit)).toEqual([odd, "/opt/it's & (x)/index.js", "submit"]);
  });

  it("reads systemctl show output", () => {
    expect(
      parseSystemctlShow(
        "UnitFileState=enabled\nActiveState=active\nNextElapseUSecRealtime=Thu 2026-10-08 14:07:00 EDT\nLastTriggerUSec=n/a\n"
      )
    ).toEqual({
      UnitFileState: "enabled",
      ActiveState: "active",
      NextElapseUSecRealtime: "Thu 2026-10-08 14:07:00 EDT",
      LastTriggerUSec: "n/a",
    });
  });
});

describe("cron block", () => {
  const argv = [
    "/home/alice/.nvm/versions/node/v22.0.0/bin/node",
    "/home/alice/.nvm/versions/node/v22.0.0/lib/node_modules/npm/bin/npx-cli.js",
    "--yes",
    "ccgather@2.1.1",
    "submit",
    "--scheduled",
  ];
  const log = "/home/alice/.local/state/ccgather/autosubmit.log";

  it("is exactly one marked line", () => {
    expect(buildCronBlock({ argv, time: { hour: 14, minute: 7 }, log })).toBe(
      [
        CRON_BEGIN,
        "7 14 * * * PATH='/home/alice/.nvm/versions/node/v22.0.0/bin:/usr/local/bin:/usr/bin:/bin' '/home/alice/.nvm/versions/node/v22.0.0/bin/node' '/home/alice/.nvm/versions/node/v22.0.0/lib/node_modules/npm/bin/npx-cli.js' '--yes' 'ccgather@2.1.1' 'submit' '--scheduled' >> '/home/alice/.local/state/ccgather/autosubmit.log' 2>&1",
        CRON_END,
      ].join("\n")
    );
  });

  it("escapes %, single quotes and $, adds XDG_CONFIG_HOME, and reads back", () => {
    const odd = `/home/it's/100%/$HOME (x) & ${E_ACUTE}/node`;
    const block = buildCronBlock({
      argv: [odd, "/opt/index.js", "submit", "--scheduled"],
      time: { hour: 9, minute: 0 },
      log,
      xdgConfigHome: "/home/alice/.cfg",
    });
    expect(block.split("\n")[1]).toBe(
      `0 9 * * * PATH='/home/it'\\''s/100\\%/$HOME (x) & ${E_ACUTE}:/usr/local/bin:/usr/bin:/bin' XDG_CONFIG_HOME='/home/alice/.cfg' '/home/it'\\''s/100\\%/$HOME (x) & ${E_ACUTE}/node' '/opt/index.js' 'submit' '--scheduled' >> '/home/alice/.local/state/ccgather/autosubmit.log' 2>&1`
    );
    // Every % reaching cron is escaped, or cron would cut the line there
    expect(/(^|[^\\])%/.test(block)).toBe(false);
    expect(parseCronBlock(block)).toEqual({
      time: { hour: 9, minute: 0 },
      argv: [odd, "/opt/index.js", "submit", "--scheduled"],
    });
  });

  const block = buildCronBlock({ argv, time: { hour: 14, minute: 7 }, log });
  const foreign = "MAILTO=me@example.com\n# my backup\n0 3 * * * /usr/bin/backup --all\n";

  it("appends to an existing table and keeps every foreign line", () => {
    const next = applyCronBlock(foreign, block);
    expect(next).toBe(`${foreign}${block}\n`);
  });

  it("is idempotent: re-applying replaces the block in place of duplicating it", () => {
    const once = applyCronBlock(foreign, block);
    const moved = buildCronBlock({ argv, time: { hour: 20, minute: 59 }, log });
    const twice = applyCronBlock(applyCronBlock(once, block), moved);
    expect(twice).toBe(`${foreign}${moved}\n`);
    expect(twice.split(CRON_BEGIN)).toHaveLength(2);
  });

  it("removes only the block", () => {
    const withBlockInMiddle = `${foreign}${block}\n15 4 * * * /usr/bin/other\n`;
    expect(applyCronBlock(withBlockInMiddle, null)).toBe(`${foreign}15 4 * * * /usr/bin/other\n`);
    expect(applyCronBlock(`${block}\n`, null)).toBe("");
    expect(applyCronBlock("", block)).toBe(`${block}\n`);
  });

  it("refuses a broken block instead of guessing which lines to delete", () => {
    expect(() => applyCronBlock(`${CRON_BEGIN}\n0 1 * * * x\n${foreign}`, null)).toThrow(
      /broken ccgather block/
    );
    expect(() => applyCronBlock(`${foreign}${CRON_END}\n`, block)).toThrow(/broken ccgather block/);
  });
});

describe("daily time", () => {
  it("parses HH:MM and refuses anything else", () => {
    expect(parseDailyTime("21:30")).toEqual({ hour: 21, minute: 30 });
    expect(parseDailyTime("9:05")).toEqual({ hour: 9, minute: 5 });
    expect(parseDailyTime("00:00")).toEqual({ hour: 0, minute: 0 });
    for (const bad of ["24:00", "12:60", "12", "12:5", "noon", "-1:00"]) {
      expect(parseDailyTime(bad)).toBeNull();
    }
  });

  it("defaults to the local time five minutes from now, rounded to the minute", () => {
    expect(defaultDailyTime(new Date(2026, 9, 11, 14, 17, 42))).toEqual({ hour: 14, minute: 23 });
    expect(defaultDailyTime(new Date(2026, 9, 11, 14, 17, 20))).toEqual({ hour: 14, minute: 22 });
    expect(defaultDailyTime(new Date(2026, 9, 11, 23, 57, 40))).toEqual({ hour: 0, minute: 3 });
  });
});
