/**
 * `ccgather autosubmit` — what each backend asks the OS scheduler to do
 *
 * Every scheduler program (schtasks, whoami, launchctl, systemctl, crontab) is
 * a mocked execFile: no test registers, runs or deletes a real scheduled job.
 * Files are written only into a temp directory per test.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

interface Reply {
  code?: number;
  stdout?: string | Buffer;
  stderr?: string;
  spawnError?: string;
}

interface Call {
  file: string;
  args: string[];
}

const mocked = vi.hoisted(() => ({
  calls: [] as Call[],
  handler: (_call: Call): Reply => ({}),
}));

vi.mock("child_process", async (importOriginal) => {
  const actual = await importOriginal<typeof import("child_process")>();
  return {
    ...actual,
    execFile: vi.fn(
      (
        file: string,
        args: string[],
        _options: unknown,
        callback: (error: Error | null, stdout: Buffer, stderr: Buffer) => void
      ) => {
        const call = { file, args: [...args] };
        mocked.calls.push(call);
        const reply = mocked.handler(call);
        const stdout = Buffer.isBuffer(reply.stdout)
          ? reply.stdout
          : Buffer.from(reply.stdout ?? "", "utf8");
        const stderr = Buffer.from(reply.stderr ?? "", "utf8");
        if (reply.spawnError) {
          callback(Object.assign(new Error(reply.spawnError), { code: "ENOENT" }), stdout, stderr);
        } else if (reply.code) {
          callback(
            Object.assign(new Error("Command failed"), { code: reply.code }),
            stdout,
            stderr
          );
        } else {
          callback(null, stdout, stderr);
        }
      }
    ),
  };
});

import { createWindowsBackend, POWERSHELL_STATUS_SCRIPT } from "../src/lib/autosubmit/windows";
import { createMacosBackend } from "../src/lib/autosubmit/macos";
import {
  createLinuxBackend,
  buildCronBlock,
  CRON_BEGIN,
  systemdUserAvailable,
} from "../src/lib/autosubmit/linux";
import { EnablePlan } from "../src/lib/autosubmit/shared";

let temp: string;

function plan(argv: string[], home: string, extra: Partial<EnablePlan> = {}): EnablePlan {
  return {
    command: { argv, kind: "npx", spec: "ccgather@2.1.1" },
    time: { hour: 14, minute: 7 },
    home,
    ...extra,
  };
}

function argvOf(file: string): string[][] {
  return mocked.calls.filter((call) => call.file === file).map((call) => call.args);
}

beforeEach(() => {
  temp = fs.mkdtempSync(path.join(os.tmpdir(), "ccgather-backend-"));
  mocked.calls.length = 0;
  mocked.handler = () => ({});
});

afterEach(() => {
  fs.rmSync(temp, { recursive: true, force: true });
});

// ═══════════════════════════════════════════════════════════════════════════
// Windows
// ═══════════════════════════════════════════════════════════════════════════

describe("Windows backend", () => {
  const argv = [
    String.raw`C:\Program Files\nodejs\node.exe`,
    String.raw`C:\Program Files\nodejs\node_modules\npm\bin\npx-cli.js`,
    "--yes",
    "ccgather@2.1.1",
    "submit",
    "--scheduled",
  ];

  function backend() {
    return createWindowsBackend({
      home: String.raw`C:\Users\alice`,
      localAppData: path.join(temp, "Local"),
      tmpdir: path.join(temp, "tmp"),
      now: () => new Date(2026, 9, 7),
    });
  }

  beforeEach(() => fs.mkdirSync(path.join(temp, "tmp")));

  it("writes the launcher and registers the task from a UTF-16 XML file", async () => {
    let xmlBytes: Buffer | null = null;
    mocked.handler = (call) => {
      if (call.file === "whoami") return { stdout: "desktop-1\\alice\r\n" };
      if (call.args[0] === "/Create") xmlBytes = fs.readFileSync(call.args[4]);
      return {};
    };

    const result = await backend().enable(plan(argv, String.raw`C:\Users\alice`));

    const launcher = path.join(temp, "Local", "ccgather", "autosubmit.js");
    const xmlFile = mocked.calls[1].args[4];
    expect(mocked.calls).toEqual([
      { file: "whoami", args: [] },
      {
        file: "schtasks",
        args: ["/Create", "/TN", "ccgather-autosubmit", "/XML", xmlFile, "/F"],
      },
    ]);
    expect(path.dirname(path.dirname(xmlFile))).toBe(path.join(temp, "tmp"));
    // The temp XML is gone afterwards
    expect(fs.existsSync(xmlFile)).toBe(false);
    expect(fs.readdirSync(path.join(temp, "tmp"))).toEqual([]);

    expect([...xmlBytes!.subarray(0, 2)]).toEqual([0xff, 0xfe]);
    const xml = xmlBytes!.subarray(2).toString("utf16le");
    expect(xml).toContain('encoding="UTF-16"');
    expect(xml).toContain(String.raw`<UserId>desktop-1\alice</UserId>`);
    expect(xml).toContain(`//E:jscript &quot;${launcher}&quot;`);
    expect(xml).toContain("<DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>");

    expect(fs.readFileSync(launcher, "utf8")).toContain("WScript.Quit(code);");
    expect(result.scheduler).toBe("Task Scheduler");
  });

  it("takes DOMAIN\\user from the environment when whoami fails", async () => {
    vi.stubEnv("USERDOMAIN", "DESKTOP-1");
    vi.stubEnv("USERNAME", "alice");
    try {
      let xml = "";
      mocked.handler = (call) => {
        if (call.file === "whoami") return { code: 1 };
        if (call.args[0] === "/Create") xml = fs.readFileSync(call.args[4]).toString("utf16le");
        return {};
      };
      await backend().enable(plan(argv, String.raw`C:\Users\alice`));
      expect(xml).toContain(String.raw`<UserId>DESKTOP-1\alice</UserId>`);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("does not trust a non-ASCII whoami name printed in the OEM code page", async () => {
    const jose = "Jos" + String.fromCharCode(0xe9);
    vi.stubEnv("USERDOMAIN", "DESKTOP-1");
    vi.stubEnv("USERNAME", jose);
    try {
      let xml = "";
      mocked.handler = (call) => {
        // cp437/cp850 writes the e-acute as 0x82, which is not valid UTF-8
        if (call.file === "whoami") {
          return {
            stdout: Buffer.concat([
              Buffer.from("desktop-1\\Jos", "ascii"),
              Buffer.from([0x82, 0x0d, 0x0a]),
            ]),
          };
        }
        if (call.args[0] === "/Create") xml = fs.readFileSync(call.args[4]).toString("utf16le");
        return {};
      };
      await backend().enable(plan(argv, String.raw`C:\Users\alice`));
      expect(xml).toContain(`<UserId>DESKTOP-1\\${jose}</UserId>`);
      expect(xml.includes(String.fromCharCode(0xfffd))).toBe(false);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("reports a refused registration and still removes the temp XML", async () => {
    mocked.handler = (call) =>
      call.file === "whoami"
        ? { stdout: "desktop-1\\alice" }
        : { code: 1, stderr: "ERROR: Access is denied.\r\n" };
    await expect(backend().enable(plan(argv, String.raw`C:\Users\alice`))).rejects.toThrow(
      "Task Scheduler refused the task: ERROR: Access is denied."
    );
    expect(fs.readdirSync(path.join(temp, "tmp"))).toEqual([]);
  });

  it("refuses a path with % before touching anything", async () => {
    const bad = [String.raw`C:\100%\node.exe`, ...argv.slice(1)];
    await expect(backend().enable(plan(bad, String.raw`C:\Users\alice`))).rejects.toThrow(
      /contains "%"/
    );
    expect(mocked.calls).toEqual([]);
    expect(fs.existsSync(path.join(temp, "Local"))).toBe(false);
  });

  it("off deletes the task and the launcher", async () => {
    const launcher = path.join(temp, "Local", "ccgather", "autosubmit.js");
    fs.mkdirSync(path.dirname(launcher), { recursive: true });
    fs.writeFileSync(launcher, "x");

    expect(await backend().disable()).toBe(true);
    expect(argvOf("schtasks")).toEqual([
      ["/Query", "/TN", "ccgather-autosubmit"],
      ["/Delete", "/TN", "ccgather-autosubmit", "/F"],
    ]);
    expect(fs.existsSync(launcher)).toBe(false);
  });

  it("off succeeds quietly when nothing is registered", async () => {
    mocked.handler = () => ({
      code: 1,
      stderr: "ERROR: The system cannot find the file specified.",
    });
    expect(await backend().disable()).toBe(false);
    expect(argvOf("schtasks")).toEqual([["/Query", "/TN", "ccgather-autosubmit"]]);
  });

  async function enableAndWriteLog(b: ReturnType<typeof backend>): Promise<string> {
    const saved = mocked.handler;
    mocked.handler = (call) => (call.file === "whoami" ? { stdout: "desktop-1\\alice" } : {});
    await b.enable(plan(argv, String.raw`C:\Users\alice`));
    mocked.handler = saved;
    const log = path.join(temp, "Local", "ccgather", "autosubmit.log");
    fs.writeFileSync(log, "[2026-10-07T18:07:01.000Z] ccgather: Failed to submit: boom.\r\n");
    mocked.calls.length = 0;
    return log;
  }

  it("status reads the task through PowerShell as UTF-8 JSON", async () => {
    const b = backend();
    const log = await enableAndWriteLog(b);
    const json = JSON.stringify({
      State: "Bereit",
      LastRunTime: "2026-10-07T14:07:01.0000000+02:00",
      NextRunTime: "2026-10-08T14:07:00.0000000+02:00",
      LastTaskResult: 1,
      StartBoundaries: ["2026-10-07T14:07:00", ""],
    });
    mocked.handler = () => ({ stdout: Buffer.from(json, "utf8") });

    const status = await b.status();

    expect(mocked.calls).toEqual([
      {
        file: "powershell.exe",
        args: ["-NoProfile", "-NonInteractive", "-Command", POWERSHELL_STATUS_SCRIPT],
      },
    ]);
    expect(POWERSHELL_STATUS_SCRIPT).toContain("[Console]::OutputEncoding=[Text.Encoding]::UTF8");
    expect(POWERSHELL_STATUS_SCRIPT).toContain(
      "Get-ScheduledTask -TaskName 'ccgather-autosubmit' -TaskPath '\\'"
    );
    expect(POWERSHELL_STATUS_SCRIPT).not.toContain('"');
    expect(status).toEqual({
      registered: true,
      scheduler: "Task Scheduler",
      time: { hour: 14, minute: 7 },
      argv,
      state: "Bereit",
      nextRun: "2026-10-08T14:07:00.0000000+02:00",
      lastRun: "2026-10-07T14:07:01.0000000+02:00",
      lastResult: "the job exited with code 1 (0x1); see the log",
      log,
      lastLogLine: "[2026-10-07T18:07:01.000Z] ccgather: Failed to submit: boom.",
    });
  });

  it("status falls back to schtasks' numeric Last Result and XML time without PowerShell", async () => {
    const b = backend();
    const log = await enableAndWriteLog(b);
    mocked.handler = (call) => {
      if (call.file === "powershell.exe") return { spawnError: "spawn powershell.exe ENOENT" };
      if (call.args.includes("CSV")) {
        return {
          stdout:
            '"HostName","TaskName","Next Run Time","Status","Logon Mode","Last Run Time","Last Result"\r\n' +
            '"PC","\\ccgather-autosubmit","garbled","garbled","garbled","garbled","2147942402"\r\n',
        };
      }
      if (call.args.includes("/XML") && call.args[0] === "/Query") {
        const xml =
          '<?xml version="1.0" encoding="UTF-16"?>\r\n<Task><Triggers><CalendarTrigger><StartBoundary>2026-10-07T14:07:00</StartBoundary></CalendarTrigger></Triggers></Task>';
        return { stdout: Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(xml, "utf16le")]) };
      }
      return {};
    };

    const status = await b.status();

    expect(argvOf("schtasks")).toEqual([
      ["/Query", "/TN", "ccgather-autosubmit", "/V", "/FO", "CSV"],
      ["/Query", "/TN", "ccgather-autosubmit", "/XML"],
    ]);
    expect(status).toEqual({
      registered: true,
      scheduler: "Task Scheduler",
      time: { hour: 14, minute: 7 },
      argv,
      lastResult:
        "0x80070002 (failed to start; if Windows Script Host is disabled by policy, wscript.exe cannot run the launcher)",
      log,
      lastLogLine: "[2026-10-07T18:07:01.000Z] ccgather: Failed to submit: boom.",
    });
  });

  it("status reports not registered when neither PowerShell nor schtasks finds it", async () => {
    mocked.handler = () => ({ code: 1 });
    const status = await backend().status();
    expect(status.registered).toBe(false);
    expect(argvOf("powershell.exe")).toHaveLength(1);
    expect(argvOf("schtasks")).toEqual([
      ["/Query", "/TN", "ccgather-autosubmit", "/V", "/FO", "CSV"],
    ]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// macOS
// ═══════════════════════════════════════════════════════════════════════════

describe("macOS backend", () => {
  const argv = [
    "/opt/homebrew/bin/node",
    "/opt/homebrew/lib/node_modules/npm/bin/npx-cli.js",
    "--yes",
    "ccgather@2.1.1",
    "submit",
    "--scheduled",
  ];
  const service = "gui/501/com.ccgather.autosubmit";

  function backend() {
    return createMacosBackend({ home: temp, uid: 501 });
  }

  const plistPath = () =>
    path.join(temp, "Library", "LaunchAgents", "com.ccgather.autosubmit.plist");
  const logDir = () => path.join(temp, "Library", "Logs", "ccgather");

  it("writes the plist, creates the log directory, and reloads the agent", async () => {
    // A first enable: bootout fails because nothing is loaded, which is fine
    mocked.handler = (call) =>
      call.args[0] === "bootout" ? { code: 3, stderr: "Boot-out failed: 3: No such process" } : {};

    const result = await backend().enable(plan(argv, temp));

    expect(argvOf("launchctl")).toEqual([
      ["bootout", service],
      ["bootstrap", "gui/501", plistPath()],
    ]);
    expect(fs.statSync(logDir()).isDirectory()).toBe(true);
    expect(fs.readFileSync(plistPath(), "utf8")).toContain("<key>RunAtLoad</key>");
    if (process.platform !== "win32") {
      expect(fs.statSync(plistPath()).mode & 0o777).toBe(0o644);
    }
    expect(result.scheduler).toBe("launchd");
    expect(result.notes.join("\n")).toContain('"Background Items Added"');
  });

  it("retries bootstrap once, after about a second, when it answers 5", async () => {
    let bootstraps = 0;
    mocked.handler = (call) =>
      call.args[0] === "bootstrap" && ++bootstraps === 1
        ? { code: 5, stderr: "Bootstrap failed: 5: Input/output error" }
        : {};
    const sleep = vi.fn(async () => undefined);

    await createMacosBackend({ home: temp, uid: 501, sleep }).enable(plan(argv, temp));

    expect(sleep).toHaveBeenCalledWith(1000);
    expect(argvOf("launchctl")).toEqual([
      ["bootout", service],
      ["bootstrap", "gui/501", plistPath()],
      ["bootstrap", "gui/501", plistPath()],
    ]);
    expect(fs.existsSync(plistPath())).toBe(true);
  });

  it("deletes the new plist when bootstrap fails and there was none before", async () => {
    mocked.handler = (call) =>
      call.args[0] === "bootstrap"
        ? { code: 5, stderr: "Bootstrap failed: 5: Input/output error" }
        : {};
    const sleep = vi.fn(async () => undefined);

    await expect(
      createMacosBackend({ home: temp, uid: 501, sleep }).enable(plan(argv, temp))
    ).rejects.toThrow(
      "launchctl could not load the LaunchAgent: Bootstrap failed: 5: Input/output error"
    );
    expect(sleep).toHaveBeenCalledTimes(1);
    // Nothing is left for launchd to load at the next login
    expect(fs.existsSync(plistPath())).toBe(false);
    expect(argvOf("launchctl")).toEqual([
      ["bootout", service],
      ["bootstrap", "gui/501", plistPath()],
      ["bootstrap", "gui/501", plistPath()],
    ]);
  });

  it("restores and reloads the previous plist when bootstrap fails", async () => {
    await backend().enable(plan(argv, temp));
    const previous = fs.readFileSync(plistPath(), "utf8");
    mocked.calls.length = 0;
    let bootstraps = 0;
    mocked.handler = (call) =>
      call.args[0] === "bootstrap" && ++bootstraps === 1
        ? { code: 1, stderr: "Bootstrap failed: 1: Operation not permitted" }
        : {};
    const sleep = vi.fn(async () => undefined);

    await expect(
      createMacosBackend({ home: temp, uid: 501, sleep }).enable(
        plan(argv, temp, { time: { hour: 20, minute: 0 } })
      )
    ).rejects.toThrow("Bootstrap failed: 1: Operation not permitted");

    // Code 1 is not retried; the old plist is back and loaded again
    expect(sleep).not.toHaveBeenCalled();
    expect(fs.readFileSync(plistPath(), "utf8")).toBe(previous);
    expect(previous).toContain("<integer>14</integer>");
    expect(argvOf("launchctl")).toEqual([
      ["bootout", service],
      ["bootstrap", "gui/501", plistPath()],
      ["bootstrap", "gui/501", plistPath()],
    ]);
  });

  it("off boots the agent out and deletes the plist", async () => {
    await backend().enable(plan(argv, temp));
    mocked.calls.length = 0;
    expect(await backend().disable()).toBe(true);
    expect(argvOf("launchctl")).toEqual([["bootout", service]]);
    expect(fs.existsSync(plistPath())).toBe(false);
  });

  it("off succeeds quietly when nothing is registered", async () => {
    mocked.handler = () => ({ code: 3 });
    expect(await backend().disable()).toBe(false);
  });

  it("status reads the plist and launchctl print", async () => {
    await backend().enable(plan(argv, temp));
    mocked.calls.length = 0;
    mocked.handler = () => ({
      stdout: `${service} = {\n\tstate = not running\n\truns = 1\n\tlast exit code = 0\n}\n`,
    });

    const status = await backend().status();

    expect(argvOf("launchctl")).toEqual([["print", service]]);
    expect(status).toMatchObject({
      registered: true,
      time: { hour: 14, minute: 7 },
      argv,
      state: "not running",
      lastResult: "0 (success)",
      lastRun: "1 run(s) since it was loaded",
    });
  });

  it("status says installed but not loaded when launchctl does not know it", async () => {
    await backend().enable(plan(argv, temp));
    mocked.handler = () => ({ code: 113, stderr: "Could not find service" });
    const status = await backend().status();
    expect(status.registered).toBe(false);
    expect(status.state).toBe("installed but not loaded");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Linux
// ═══════════════════════════════════════════════════════════════════════════

describe("Linux backend", () => {
  const argv = [
    "/usr/bin/node",
    "/usr/lib/node_modules/npm/bin/npx-cli.js",
    "--yes",
    "ccgather@2.1.1",
    "submit",
    "--scheduled",
  ];
  const foreign = "MAILTO=me@example.com\n0 3 * * * /usr/bin/backup\n";
  let crontab: string | null;
  let written: string[];
  let systemdState: Reply;
  let crontabRead: Reply | null;
  let noCrontab: string;
  let systemctlDisable: Reply;
  let procRoot: string;

  // A fake /proc with the given processes (comm, and cmdline for busybox)
  function makeProc(processes: { comm: string; cmdline?: string[] }[]): string {
    const root = path.join(temp, `proc-${Math.random().toString(36).slice(2)}`);
    fs.mkdirSync(root);
    fs.mkdirSync(path.join(root, "self"));
    processes.forEach((proc, index) => {
      const dir = path.join(root, String(100 + index));
      fs.mkdirSync(dir);
      fs.writeFileSync(path.join(dir, "comm"), `${proc.comm}\n`);
      fs.writeFileSync(path.join(dir, "cmdline"), (proc.cmdline ?? [proc.comm]).join("\0") + "\0");
    });
    return root;
  }

  function backend(env: NodeJS.ProcessEnv = { XDG_RUNTIME_DIR: "/run/user/1000" }) {
    return createLinuxBackend({ home: temp, env, tmpdir: path.join(temp, "tmp"), procRoot });
  }

  const unitDir = () => path.join(temp, ".config", "systemd", "user");
  const wantsLink = () => path.join(unitDir(), "timers.target.wants", "ccgather-autosubmit.timer");
  const cronLog = () => path.join(temp, ".local", "state", "ccgather", "autosubmit.log");

  beforeEach(() => {
    fs.mkdirSync(path.join(temp, "tmp"));
    crontab = null;
    written = [];
    systemdState = { stdout: "running\n" };
    crontabRead = null;
    noCrontab = "no crontab for alice\n";
    systemctlDisable = {};
    procRoot = makeProc([{ comm: "systemd" }, { comm: "cron" }, { comm: "bash" }]);
    mocked.handler = (call) => {
      if (call.file === "systemctl" && call.args[1] === "is-system-running") return systemdState;
      if (call.file === "systemctl" && call.args[1] === "disable") return systemctlDisable;
      if (call.file === "crontab" && call.args[0] === "-l") {
        if (crontabRead) return crontabRead;
        return crontab === null ? { code: 1, stderr: noCrontab } : { stdout: crontab };
      }
      if (call.file === "crontab") {
        crontab = fs.readFileSync(call.args[0], "utf8");
        written.push(crontab);
        return {};
      }
      return {};
    };
  });

  describe("systemd probe", () => {
    it.each([
      ["running", 0, true],
      ["degraded", 1, true],
      ["starting", 1, false],
      ["offline", 1, false],
    ])("is-system-running %s (exit %i) -> %s", async (state, code, usable) => {
      systemdState = { stdout: `${state}\n`, code };
      expect(await systemdUserAvailable({ XDG_RUNTIME_DIR: "/run/user/1000" })).toBe(usable);
      expect(argvOf("systemctl")).toEqual([["--user", "is-system-running"]]);
    });

    it("needs XDG_RUNTIME_DIR and does not ask systemctl without it", async () => {
      expect(await systemdUserAvailable({})).toBe(false);
      expect(mocked.calls).toEqual([]);
    });

    it("treats a missing systemctl as unavailable", async () => {
      systemdState = { spawnError: "spawn systemctl ENOENT" };
      expect(await systemdUserAvailable({ XDG_RUNTIME_DIR: "/run/user/1000" })).toBe(false);
    });
  });

  it("writes and enables the systemd units when the user manager runs", async () => {
    const result = await backend().enable(plan(argv, temp, { xdgConfigHome: "/home/alice/.cfg" }));

    expect(argvOf("systemctl")).toEqual([
      ["--user", "is-system-running"],
      ["--user", "daemon-reload"],
      ["--user", "enable", "--now", "ccgather-autosubmit.timer"],
    ]);
    // Looks for an old cron entry to remove; there is none, so nothing is written
    expect(argvOf("crontab")).toEqual([["-l"]]);
    const service = fs.readFileSync(path.join(unitDir(), "ccgather-autosubmit.service"), "utf8");
    expect(service).toContain('Environment="XDG_CONFIG_HOME=/home/alice/.cfg"');
    expect(fs.readFileSync(path.join(unitDir(), "ccgather-autosubmit.timer"), "utf8")).toContain(
      "OnCalendar=*-*-* 14:07:00"
    );
    expect(result.scheduler).toBe("systemd user timer");
    expect(result.notes.join("\n")).toContain("loginctl enable-linger $USER");
  });

  it("restarts the timer when re-enabled so the new time applies", async () => {
    await backend().enable(plan(argv, temp));
    mocked.calls.length = 0;
    await backend().enable(plan(argv, temp, { time: { hour: 20, minute: 0 } }));
    expect(argvOf("systemctl")).toEqual([
      ["--user", "is-system-running"],
      ["--user", "daemon-reload"],
      ["--user", "enable", "--now", "ccgather-autosubmit.timer"],
      ["--user", "restart", "ccgather-autosubmit.timer"],
    ]);
  });

  it("falls through to cron when systemd is not usable, keeping foreign lines", async () => {
    systemdState = { stdout: "offline\n", code: 1 };
    crontab = foreign;

    const result = await backend().enable(plan(argv, temp));

    expect(argvOf("systemctl")).toEqual([["--user", "is-system-running"]]);
    const writes = argvOf("crontab");
    expect(writes[0]).toEqual(["-l"]);
    expect(writes[1]).toHaveLength(1);
    expect(path.dirname(path.dirname(writes[1][0]))).toBe(path.join(temp, "tmp"));
    expect(fs.readdirSync(path.join(temp, "tmp"))).toEqual([]);

    const block = buildCronBlock({ argv, time: { hour: 14, minute: 7 }, log: cronLog() });
    expect(crontab).toBe(`${foreign}${block}\n`);
    expect(fs.statSync(path.dirname(cronLog())).isDirectory()).toBe(true);
    expect(result.scheduler).toBe("cron");
  });

  it("re-enabling cron replaces the block instead of adding a second one", async () => {
    systemdState = { stdout: "offline\n", code: 1 };
    crontab = foreign;
    await backend().enable(plan(argv, temp));
    await backend().enable(plan(argv, temp, { time: { hour: 9, minute: 30 } }));

    expect(crontab!.split(CRON_BEGIN)).toHaveLength(2);
    expect(crontab).toContain("30 9 * * * ");
    expect(crontab!.startsWith(foreign)).toBe(true);
  });

  it("refuses and writes nothing when crontab -l fails for another reason", async () => {
    systemdState = { stdout: "offline\n", code: 1 };
    crontabRead = { code: 1, stderr: "crontab: cannot open /var/spool/cron: Permission denied\n" };

    await expect(backend().enable(plan(argv, temp))).rejects.toThrow(
      "Could not read your crontab (crontab: cannot open /var/spool/cron: Permission denied); nothing was changed."
    );
    expect(argvOf("crontab")).toEqual([["-l"]]);
    expect(written).toEqual([]);
  });

  it("explains when neither systemd nor crontab exists", async () => {
    systemdState = { spawnError: "spawn systemctl ENOENT" };
    crontabRead = { spawnError: "spawn crontab ENOENT" };
    await expect(backend().enable(plan(argv, temp))).rejects.toThrow(
      /Neither a systemd user session nor crontab/
    );
  });

  it("off removes the cron block and keeps foreign lines", async () => {
    systemdState = { stdout: "offline\n", code: 1 };
    crontab = foreign;
    await backend().enable(plan(argv, temp));
    mocked.calls.length = 0;

    expect(await backend().disable()).toBe(true);
    expect(crontab).toBe(foreign);
    // No unit files exist, so systemctl is not asked
    expect(argvOf("systemctl")).toEqual([]);
  });

  it("off removes the systemd units", async () => {
    await backend().enable(plan(argv, temp));
    mocked.calls.length = 0;

    expect(await backend().disable()).toBe(true);
    expect(argvOf("systemctl")).toEqual([
      ["--user", "disable", "--now", "ccgather-autosubmit.timer"],
      ["--user", "daemon-reload"],
    ]);
    expect(fs.existsSync(path.join(unitDir(), "ccgather-autosubmit.timer"))).toBe(false);
    expect(fs.existsSync(path.join(unitDir(), "ccgather-autosubmit.service"))).toBe(false);
  });

  it("off succeeds quietly when nothing is registered", async () => {
    expect(await backend().disable()).toBe(false);
    expect(written).toEqual([]);
  });

  it("off refuses to rewrite a crontab it could not read", async () => {
    crontabRead = { code: 1, stderr: "crontab: permission denied" };
    await expect(backend().disable()).rejects.toThrow(/Could not read your crontab/);
    expect(written).toEqual([]);
  });

  it("status reads systemctl show for the timer and the service", async () => {
    await backend().enable(plan(argv, temp));
    mocked.calls.length = 0;
    mocked.handler = (call) => {
      if (call.args[2] === "ccgather-autosubmit.timer") {
        return {
          stdout:
            "UnitFileState=enabled\nActiveState=active\nNextElapseUSecRealtime=Thu 2026-10-08 14:07:00 EDT\nLastTriggerUSec=Wed 2026-10-07 14:09:12 EDT\n",
        };
      }
      return {
        stdout:
          "Result=exit-code\nExecMainStatus=1\nExecMainExitTimestamp=Wed 2026-10-07 14:09:20 EDT\n",
      };
    };

    const status = await backend().status();

    expect(argvOf("systemctl")).toEqual([
      [
        "--user",
        "show",
        "ccgather-autosubmit.timer",
        "--property=UnitFileState,ActiveState,NextElapseUSecRealtime,LastTriggerUSec",
      ],
      [
        "--user",
        "show",
        "ccgather-autosubmit.service",
        "--property=Result,ExecMainStatus,ExecMainExitTimestamp",
      ],
    ]);
    expect(status).toEqual({
      registered: true,
      scheduler: "systemd user timer",
      time: { hour: 14, minute: 7 },
      argv,
      state: "active",
      nextRun: "Thu 2026-10-08 14:07:00 EDT",
      lastRun: "Wed 2026-10-07 14:09:12 EDT",
      lastResult: "exit-code (exit 1)",
      log: "journalctl --user -u ccgather-autosubmit",
    });
  });

  it("status reads the cron block", async () => {
    systemdState = { stdout: "offline\n", code: 1 };
    crontab = foreign;
    await backend().enable(plan(argv, temp));
    fs.writeFileSync(cronLog(), "[2026-10-07T18:07:01.000Z] ccgather: Submitted 1.00K tokens.\n");

    const status = await backend().status();

    expect(status).toEqual({
      registered: true,
      scheduler: "cron",
      time: { hour: 14, minute: 7 },
      argv,
      log: cronLog(),
      lastLogLine: "[2026-10-07T18:07:01.000Z] ccgather: Submitted 1.00K tokens.",
    });
  });

  describe("BusyBox crontab (Alpine)", () => {
    const BUSYBOX_NO_CRONTAB = "crontab: can't open 'alice': No such file or directory\n";

    beforeEach(() => {
      systemdState = { spawnError: "spawn systemctl ENOENT" };
      noCrontab = BUSYBOX_NO_CRONTAB;
    });

    it("treats its missing-table message as an empty table on enable", async () => {
      await backend().enable(plan(argv, temp));
      const block = buildCronBlock({ argv, time: { hour: 14, minute: 7 }, log: cronLog() });
      expect(crontab).toBe(`${block}\n`);
    });

    it("succeeds quietly on off with no table", async () => {
      expect(await backend().disable()).toBe(false);
      expect(written).toEqual([]);
    });

    it("reports not registered on status with no table", async () => {
      const status = await backend().status();
      expect(status.registered).toBe(false);
      expect(status.state).toBeUndefined();
    });

    // Control: a different failure is still refused
    it("still refuses Permission denied on enable, off and status", async () => {
      crontabRead = { code: 1, stderr: "crontab: can't open 'alice': Permission denied\n" };
      await expect(backend().enable(plan(argv, temp))).rejects.toThrow(
        /Could not read your crontab .*Permission denied/
      );
      await expect(backend().disable()).rejects.toThrow(/Could not read your crontab/);
      expect((await backend().status()).state).toMatch(/could not read your crontab/);
      expect(written).toEqual([]);
    });
  });

  describe("systemd removal when the user manager cannot be reached", () => {
    const UNREACHABLE: Reply = {
      code: 1,
      stderr: "Failed to connect to bus: No medium found\n",
    };

    it("off keeps the unit files and says how to finish", async () => {
      await backend().enable(plan(argv, temp));
      systemctlDisable = UNREACHABLE;

      await expect(backend().disable()).rejects.toThrow(
        "Could not stop the systemd timer (Failed to connect to bus: No medium found). From your desktop session, run `systemctl --user disable --now ccgather-autosubmit.timer` or `ccgather autosubmit off`."
      );
      expect(fs.existsSync(path.join(unitDir(), "ccgather-autosubmit.timer"))).toBe(true);
      expect(fs.existsSync(path.join(unitDir(), "ccgather-autosubmit.service"))).toBe(true);
    });

    it("switching to cron aborts before writing cron when the old units cannot be stopped", async () => {
      await backend().enable(plan(argv, temp));
      systemdState = { stdout: "offline\n", code: 1 };
      systemctlDisable = UNREACHABLE;
      crontab = foreign;

      await expect(backend().enable(plan(argv, temp))).rejects.toThrow(
        /Could not stop the systemd timer/
      );
      expect(written).toEqual([]);
      expect(crontab).toBe(foreign);
      expect(fs.existsSync(path.join(unitDir(), "ccgather-autosubmit.timer"))).toBe(true);
    });

    it("switching to cron removes the old units first when they can be stopped", async () => {
      await backend().enable(plan(argv, temp));
      systemdState = { stdout: "offline\n", code: 1 };
      mocked.calls.length = 0;

      await backend().enable(plan(argv, temp));

      const order = mocked.calls
        .filter((call) => call.file === "crontab" || call.args[1] === "disable")
        .map((call) => `${call.file} ${call.args.join(" ")}`);
      expect(order[0]).toBe("crontab -l");
      expect(order[1]).toBe("systemctl --user disable --now ccgather-autosubmit.timer");
      expect(order[2]).toMatch(/^crontab .*crontab$/);
      expect(fs.existsSync(path.join(unitDir(), "ccgather-autosubmit.timer"))).toBe(false);
    });

    it("counts a leftover timers.target.wants link as installed, and removes it", async () => {
      fs.mkdirSync(path.dirname(wantsLink()), { recursive: true });
      fs.writeFileSync(wantsLink(), "");

      expect(await backend().disable()).toBe(true);
      expect(argvOf("systemctl")).toEqual([
        ["--user", "disable", "--now", "ccgather-autosubmit.timer"],
        ["--user", "daemon-reload"],
      ]);
      expect(fs.existsSync(wantsLink())).toBe(false);
    });

    it("sees a dangling enable link through lstat", async (context) => {
      fs.mkdirSync(path.dirname(wantsLink()), { recursive: true });
      try {
        fs.symlinkSync(path.join(unitDir(), "gone.timer"), wantsLink());
      } catch {
        // Creating symlinks needs Developer Mode or elevation on Windows
        context.skip();
      }
      expect(fs.existsSync(wantsLink())).toBe(false);

      expect(await backend().disable()).toBe(true);
      expect(argvOf("systemctl")[0]).toEqual([
        "--user",
        "disable",
        "--now",
        "ccgather-autosubmit.timer",
      ]);
    });
  });

  describe("no cron daemon running", () => {
    beforeEach(() => {
      systemdState = { stdout: "offline\n", code: 1 };
    });

    it("refuses to write the crontab line, and says what to do", async () => {
      procRoot = makeProc([{ comm: "bash" }, { comm: "node" }]);
      crontab = foreign;

      await expect(backend().enable(plan(argv, temp))).rejects.toMatchObject({
        cause: "no cron daemon is running.",
        action:
          "On WSL, enable systemd or start cron (sudo service cron start), then run this again.",
      });
      expect(written).toEqual([]);
      expect(crontab).toBe(foreign);
    });

    it("says in status that a registered line has no daemon to run it", async () => {
      await backend().enable(plan(argv, temp));
      expect(written).toHaveLength(1);
      procRoot = makeProc([{ comm: "bash" }, { comm: "node" }]);
      expect((await backend().status()).state).toBe("registered, but no cron daemon is running");
    });

    it.each([
      [[{ comm: "cron" }]],
      [[{ comm: "crond" }]],
      [[{ comm: "cronie" }]],
      [[{ comm: "fcron" }]],
      [[{ comm: "dcron" }]],
      [[{ comm: "busybox", cmdline: ["/bin/busybox", "crond", "-f"] }]],
    ])("finds a running daemon: %j", async (processes) => {
      procRoot = makeProc(processes);
      const result = await backend().enable(plan(argv, temp));
      expect(result.scheduler).toBe("cron");
      expect(written).toHaveLength(1);
      expect((await backend().status()).state).toBeUndefined();
    });

    it("does not count a busybox that is not crond", async () => {
      procRoot = makeProc([{ comm: "busybox", cmdline: ["/bin/busybox", "sh"] }]);
      await expect(backend().enable(plan(argv, temp))).rejects.toMatchObject({
        cause: "no cron daemon is running.",
      });
      expect(written).toEqual([]);
    });

    it("registers anyway when /proc cannot be read, because it cannot tell", async () => {
      procRoot = path.join(temp, "no-proc-here");
      const result = await backend().enable(plan(argv, temp));
      expect(result.scheduler).toBe("cron");
      expect(written).toHaveLength(1);
      expect((await backend().status()).state).toBeUndefined();
    });
  });
});
