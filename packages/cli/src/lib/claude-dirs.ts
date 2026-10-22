import * as fs from "fs";
import * as path from "path";

type Env = Record<string, string | undefined>;

export interface ClaudeDirsConfig {
  claudeDirs?: string[]; // other data folders the user chose to count
  declinedClaudeDirs?: string[]; // folders the user chose to leave out
}

const filled = (v: unknown): string | null =>
  typeof v === "string" && v.trim() !== "" ? v.trim() : null;

const splitList = (v: string | null): string[] =>
  v
    ? v
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

function expandHome(p: string, home: string): string {
  if (p === "~") return home;
  return p.startsWith("~/") || p.startsWith("~\\") ? path.join(home, p.slice(2)) : p;
}

// A path ending in "projects" is taken as the projects folder itself.
function configDirOf(entry: string, home: string): string {
  const resolved = path.resolve(expandHome(entry, home));
  return path.basename(resolved) === "projects" ? path.dirname(resolved) : resolved;
}

function hasProjects(dir: string): boolean {
  try {
    return fs.statSync(path.join(dir, "projects")).isDirectory();
  } catch {
    return false;
  }
}

function realPath(dir: string): string {
  try {
    return fs.realpathSync(dir);
  } catch {
    return dir;
  }
}

// Only <dir>/projects is read, so two folders sharing it through a link are one folder.
const projectsKey = (dir: string): string => realPath(path.join(dir, "projects"));

// CLAUDE_CONFIG_DIR set in Claude Code's own settings file applies to its sessions too.
function settingsConfigDir(home: string): string | null {
  try {
    const settings: unknown = JSON.parse(
      fs.readFileSync(path.join(home, ".claude", "settings.json"), "utf-8")
    );
    const env = (settings as { env?: { CLAUDE_CONFIG_DIR?: unknown } } | null)?.env;
    return filled(env?.CLAUDE_CONFIG_DIR);
  } catch {
    return null;
  }
}

/** Every place a Claude Code data folder can be, in search order, before checking it exists. */
export function claudeConfigDirCandidates(
  env: Env,
  home: string,
  config: ClaudeDirsConfig = {},
  platform: string = process.platform
): string[] {
  const xdg = filled(env.XDG_CONFIG_HOME);
  const appData = filled(env.APPDATA);
  return [
    ...splitList(filled(env.CLAUDE_CONFIG_DIR)),
    ...splitList(settingsConfigDir(home)),
    ...(platform === "win32" && appData ? [path.join(appData, "claude")] : []),
    // ~/.config/claude stays a candidate when XDG_CONFIG_HOME points elsewhere
    ...(xdg ? [path.join(xdg, "claude")] : []),
    path.join(home, ".config", "claude"),
    path.join(home, ".claude"),
    ...(config.claudeDirs ?? []),
  ]
    .map((entry) => configDirOf(entry, home))
    .filter((dir, index, all) => all.indexOf(dir) === index); // XDG_CONFIG_HOME may be ~/.config
}

/**
 * The Claude Code data folders to read, each holding a projects/ folder, without the same
 * real path twice. One computer is one person: like ccusage, a comma-separated
 * CLAUDE_CONFIG_DIR is read in full, and so are the defaults and the folders the user
 * confirmed once.
 */
export function resolveClaudeConfigDirs(
  env: Env,
  home: string,
  config: ClaudeDirsConfig = {},
  platform: string = process.platform
): string[] {
  const seen = new Set<string>();
  const dirs: string[] = [];
  for (const dir of claudeConfigDirCandidates(env, home, config, platform)) {
    if (!hasProjects(dir)) continue;
    const real = projectsKey(dir);
    if (seen.has(real)) continue;
    seen.add(real);
    dirs.push(dir);
  }
  return dirs;
}

/**
 * Folders read only because the shell sets CLAUDE_CONFIG_DIR. A scheduled run does not get
 * that variable, so these are saved for it (the variable already says they are Claude Code's
 * data; an earlier "no" for the same folder found on disk gives way to it).
 */
export function shellOnlyClaudeDirs(
  env: Env,
  home: string,
  config: ClaudeDirsConfig = {},
  platform: string = process.platform
): string[] {
  const known = new Set(
    resolveClaudeConfigDirs({ ...env, CLAUDE_CONFIG_DIR: undefined }, home, config, platform).map(
      projectsKey
    )
  );
  return resolveClaudeConfigDirs(env, home, config, platform).filter(
    (dir) => !known.has(projectsKey(dir))
  );
}

function subfoldersWithProjects(dir: string): string[] {
  try {
    return fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory() || e.isSymbolicLink())
      .map((e) => path.join(dir, e.name))
      .filter(hasProjects);
  } catch {
    return [];
  }
}

/**
 * Other Claude Code data folders on this computer (another account's CLAUDE_CONFIG_DIR,
 * say ~/.claude-work) that are not read yet and the user has not been asked about:
 * ~/.claude* and $XDG_CONFIG_HOME/claude* folders with projects/, or one level below them.
 */
export function findCandidateClaudeDirs(
  env: Env,
  home: string,
  config: ClaudeDirsConfig = {},
  platform: string = process.platform
): string[] {
  const skip = new Set(
    [
      ...resolveClaudeConfigDirs(env, home, config, platform),
      ...(config.declinedClaudeDirs ?? []).map((d) => configDirOf(d, home)),
    ].map(projectsKey)
  );
  const xdg = filled(env.XDG_CONFIG_HOME);
  const roots: [string, RegExp][] = [
    [home, /^\.claude/],
    ...(xdg ? [[xdg, /^claude/] as [string, RegExp]] : []),
    [path.join(home, ".config"), /^claude/],
  ];

  const found: string[] = [];
  for (const [root, pattern] of roots) {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(root, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!pattern.test(entry.name) || !(entry.isDirectory() || entry.isSymbolicLink())) continue;
      const dir = path.join(root, entry.name);
      for (const candidate of hasProjects(dir) ? [dir] : subfoldersWithProjects(dir)) {
        const real = projectsKey(candidate);
        if (skip.has(real)) continue;
        skip.add(real);
        found.push(candidate);
      }
    }
  }
  return found.sort();
}
