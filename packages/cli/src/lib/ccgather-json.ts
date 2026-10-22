import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as crypto from "crypto";
import { readCredentials } from "./credentials.js";
import { getConfig } from "./config.js";
import { claudeConfigDirCandidates, resolveClaudeConfigDirs } from "./claude-dirs.js";
import type { ClaudeDirsConfig } from "./claude-dirs.js";
import { estimateCostRaw } from "./pricing.js";
import { createUsageAccumulator, isUsageLine } from "./usage-accumulator.js";
import type { AccumulatedUsage, ModelSplit, TokenSplit } from "./usage-accumulator.js";

interface ShareTokens {
  inputTokens: number;
  outputTokens: number;
  cacheWriteTokens: number;
  cacheWrite1hTokens?: number; // the part of cacheWriteTokens written to the 1-hour cache
  cacheReadTokens: number;
}

export interface ModelTokenSplit extends ShareTokens {
  fast?: ShareTokens; // the part of this model's tokens sent in fast mode
}

export interface DailyUsage {
  date: string; // YYYY-MM-DD
  tokens: number;
  cost: number;
  inputTokens: number;
  outputTokens: number;
  cacheWriteTokens: number;
  cacheReadTokens: number;
  sessions: number;
  models: Record<string, number>;
  modelTokens?: Record<string, ModelTokenSplit>;
  ccplan?: string; // Plan at submission time (for fair league placement)
}

/**
 * Check if any daily usage contains Opus model usage
 * Opus models are only available on Max plan, so this is definitive proof
 */
export function hasOpusUsageInProject(dailyUsage: DailyUsage[]): {
  detected: boolean;
  opusModels: string[];
  opusDates: string[];
} {
  const opusModels = new Set<string>();
  const opusDates: string[] = [];

  for (const daily of dailyUsage) {
    for (const model of Object.keys(daily.models)) {
      if (model.toLowerCase().includes("opus")) {
        opusModels.add(model);
        opusDates.push(daily.date);
      }
    }
  }

  return {
    detected: opusModels.size > 0,
    opusModels: Array.from(opusModels),
    opusDates,
  };
}

/**
 * Check if project has data older than specified days
 */
export function hasOldData(
  dailyUsage: DailyUsage[],
  days: number = 30
): {
  hasOldData: boolean;
  oldestDate: string | null;
  daysSinceOldest: number;
} {
  if (dailyUsage.length === 0) {
    return { hasOldData: false, oldestDate: null, daysSinceOldest: 0 };
  }

  const sortedDates = dailyUsage.map((d) => d.date).sort((a, b) => a.localeCompare(b));

  const oldestDate = sortedDates[0];
  const oldestDateObj = new Date(oldestDate);
  const now = new Date();
  const diffTime = now.getTime() - oldestDateObj.getTime();
  const daysSinceOldest = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  return {
    hasOldData: daysSinceOldest > days,
    oldestDate,
    daysSinceOldest,
  };
}

export interface SessionFingerprint {
  sessionHashes: string[]; // SHA256 hashes of each session file
  combinedHash: string; // SHA256 of all session hashes combined
  sessionCount: number; // Number of sessions included
}

export interface CCGatherData {
  version: string;
  lastUpdated: string;
  lastScanned: string;
  usage: {
    totalTokens: number;
    totalCost: number;
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheWriteTokens: number;
  };
  stats: {
    daysTracked: number;
    sessionsCount: number;
    firstUsed: string | null;
    lastUsed: string | null;
  };
  models: Record<string, number>;
  projects: Record<
    string,
    {
      tokens: number;
      cost: number;
      sessions: number;
      models: Record<string, number>;
    }
  >;
  dailyUsage: DailyUsage[];
  account?: {
    ccplan: string | null;
    rateLimitTier: string | null;
    authMethod?: string; // "oauth" | "api_key" | "cloud" | "unknown"
    rawSubscriptionType?: string | null; // Original value for discovery
  };
  sessionFingerprint?: SessionFingerprint;
}

const CCGATHER_JSON_VERSION = "1.2.0";

/**
 * Extract project name from file path
 */
function extractProjectName(filePath: string): string {
  // Path format: ~/.claude/projects/{encoded-path}/{session}.jsonl
  const parts = filePath.split(/[/\\]/);
  const projectsIndex = parts.findIndex((p) => p === "projects");

  if (projectsIndex >= 0 && parts[projectsIndex + 1]) {
    // Decode the project path (it's URL encoded)
    try {
      const encoded = parts[projectsIndex + 1];
      const decoded = decodeURIComponent(encoded);
      // Get last part of the path as project name
      const pathParts = decoded.split(/[/\\]/);
      return pathParts[pathParts.length - 1] || decoded;
    } catch {
      return parts[projectsIndex + 1];
    }
  }

  return "unknown";
}

// The other data folders the user answered about once (see claude-dirs.ts).
function savedClaudeDirs(): ClaudeDirsConfig {
  try {
    const config = getConfig();
    return {
      claudeDirs: config.get("claudeDirs"),
      declinedClaudeDirs: config.get("declinedClaudeDirs"),
    };
  } catch {
    return {};
  }
}

/**
 * Get all Claude Code projects directories: every CLAUDE_CONFIG_DIR entry, the XDG path
 * (~/.config/claude, Claude Code v1.0.30+), the legacy ~/.claude, and confirmed folders.
 */
function getClaudeProjectsDirs(): string[] {
  return resolveClaudeConfigDirs(process.env, os.homedir(), savedClaudeDirs()).map((dir) =>
    path.join(dir, "projects")
  );
}

/**
 * Get Claude Code projects directory (legacy function for compatibility)
 * @deprecated Use getClaudeProjectsDirs() instead
 */
function _getClaudeProjectsDir(): string {
  const dirs = getClaudeProjectsDirs();
  // Return first existing dir, or fallback to legacy path
  return dirs[0] || path.join(os.homedir(), ".claude", "projects");
}

/**
 * Encode a path the same way Claude Code does
 * Based on reverse-engineering from actual folder names:
 * - / (slash) → - (hyphen)
 * - _ (underscore) → - (hyphen)
 * - Special chars and non-ASCII → - (hyphen)
 * - Case is preserved (kakaoBot stays kakaoBot)
 */
function encodePathLikeClaude(inputPath: string): string {
  return inputPath
    .split("")
    .map((char) => {
      const code = char.charCodeAt(0);
      // Keep ASCII alphanumeric and dots only
      if (
        (code >= 48 && code <= 57) || // 0-9
        (code >= 65 && code <= 90) || // A-Z
        (code >= 97 && code <= 122) || // a-z
        char === "."
      ) {
        return char;
      }
      // Replace everything else (including underscore) with '-'
      return "-";
    })
    .join("");
}

/**
 * Get the current project's session directory
 * Claude Code encodes project paths and stores them in various locations:
 * - CLAUDE_CONFIG_DIR/projects/{encoded-path}/
 * - ~/.config/claude/projects/{encoded-path}/ (v1.0.30+)
 * - ~/.claude/projects/{encoded-path}/ (legacy)
 *
 * Uses multiple matching strategies:
 * 1. Exact encoded path match
 * 2. Project name contained in folder name (encoding-agnostic)
 * 3. Case-insensitive matching
 */
function getCurrentProjectDir(): string | null {
  const projectsDirs = getClaudeProjectsDirs();

  if (projectsDirs.length === 0) {
    return null;
  }

  const cwd = process.cwd();
  const projectName = path.basename(cwd);
  const encodedCwd = encodePathLikeClaude(cwd);

  // Search through all possible project directories
  for (const projectsDir of projectsDirs) {
    try {
      const entries = fs.readdirSync(projectsDir, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        const folderName = entry.name;
        const folderNameLower = folderName.toLowerCase();
        const projectNameLower = projectName.toLowerCase();
        const encodedCwdLower = encodedCwd.toLowerCase();

        // Strategy 1: Exact encoded path match
        if (folderName === encodedCwd || folderNameLower === encodedCwdLower) {
          return path.join(projectsDir, entry.name);
        }

        // Strategy 2: Project name contained in folder name
        // This handles different encoding schemes
        if (folderNameLower.includes(projectNameLower)) {
          return path.join(projectsDir, entry.name);
        }

        // Strategy 2b: Project name with underscores converted to hyphens
        // Claude Code converts underscores to hyphens in folder names
        const projectNameHyphenated = projectNameLower.replace(/_/g, "-");
        if (folderNameLower.includes(projectNameHyphenated)) {
          return path.join(projectsDir, entry.name);
        }

        // Strategy 3: Folder name ends with project name pattern
        // e.g., "-orchestratoion_skill_generator" or "_orchestratoion_skill_generator"
        const projectNamePattern = projectNameLower.replace(/[^a-z0-9]/g, "");
        const folderNamePattern = folderNameLower.replace(/[^a-z0-9]/g, "");
        if (folderNamePattern.endsWith(projectNamePattern) && projectNamePattern.length > 3) {
          return path.join(projectsDir, entry.name);
        }
      }
    } catch {
      continue;
    }
  }

  return null;
}

// ccusage reads files in path order, by bytes, each path's key made once (sort_by_cached_key):
// a session's transcript (s1.jsonl) comes before its subagents/ folder (s1/). Data folders are
// compared as resolved paths (ccusage sorts the strings it is given), which differs only for
// spellings such as a/../b or a relative CLAUDE_CONFIG_DIR.
function sortByPath<T>(items: T[], pathOf: (item: T) => string): T[] {
  return items
    .map((item) => ({ item, key: Buffer.from(pathOf(item)) }))
    .sort((a, b) => Buffer.compare(a.key, b.key))
    .map(({ item }) => item);
}

/**
 * Recursively find all .jsonl files. Links are not followed, as in ccusage: a linked file can
 * be a second path to a transcript that is read anyway.
 */
function findJsonlFiles(dir: string): string[] {
  const files: string[] = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...findJsonlFiles(fullPath));
      } else if (entry.isFile() && entry.name.endsWith(".jsonl")) {
        files.push(fullPath);
      }
    }
  } catch {
    // Ignore permission errors
  }
  return files;
}

/**
 * The session ccusage gives a line without a sessionId, from the file's path below projects/
 * (its extract_session_parts): project/<name>.jsonl is <name>, <session>/subagents/<file> is
 * <session>, anything else is the folder the file sits in.
 */
function pathSessionId(filePath: string): string {
  // Only Windows reads a backslash as a separator, as Rust's Path does
  const parts = filePath.split(process.platform === "win32" ? /[/\\]/ : "/");
  const index = parts.indexOf("projects");
  const relative = index >= 0 ? parts.slice(index + 1) : parts;
  const name = relative[relative.length - 1] ?? "";
  const stem = name.endsWith(".jsonl") ? name.slice(0, -".jsonl".length) : "";
  if (relative.length === 2 && stem) return stem;
  if (relative.length >= 4 && relative[relative.length - 2] === "subagents") {
    return relative[relative.length - 3] ?? "unknown";
  }
  return relative[Math.max(relative.length - 2, 0)] ?? "unknown";
}

/** Longest first line read when identifying a transcript. */
const MAX_FIRST_LINE_BYTES = 1024 * 1024;

/**
 * Read the first line of a file without reading the rest of it.
 * Subagent transcripts open with the full task prompt, so the first line is
 * often longer than any fixed-size buffer; read until the first newline.
 * Returns null for unreadable files and first lines over MAX_FIRST_LINE_BYTES.
 */
function readFirstLine(filePath: string): string | null {
  let fd: number | null = null;
  try {
    fd = fs.openSync(filePath, "r");
    const chunk = Buffer.allocUnsafe(64 * 1024);
    const parts: Buffer[] = [];
    let offset = 0;

    while (offset < MAX_FIRST_LINE_BYTES) {
      const length = Math.min(chunk.length, MAX_FIRST_LINE_BYTES - offset);
      const bytesRead = fs.readSync(fd, chunk, 0, length, offset);
      if (bytesRead === 0) break; // EOF: the whole file is one line

      const read = chunk.subarray(0, bytesRead);
      const newline = read.indexOf(0x0a);
      if (newline !== -1) {
        parts.push(Buffer.from(read.subarray(0, newline)));
        return Buffer.concat(parts).toString("utf-8");
      }
      parts.push(Buffer.from(read));
      offset += bytesRead;
    }

    return offset < MAX_FIRST_LINE_BYTES ? Buffer.concat(parts).toString("utf-8") : null;
  } catch {
    return null;
  } finally {
    if (fd !== null) fs.closeSync(fd);
  }
}

interface TranscriptIdentity {
  /** Identifies one transcript; copies of the same transcript share it. */
  key: string;
  /** The Claude Code session the transcript belongs to, when recorded. */
  sessionId: string | null;
}

/**
 * Identify the transcript a jsonl file holds, from its first line.
 *
 * A main transcript is identified by its sessionId. Subagent transcripts,
 * stored under <session>/subagents/, carry their parent session's sessionId,
 * and their agentId can repeat within a session (a workflow's subagents may
 * reuse one), so they are identified by a hash of their opening line, which
 * copies share and distinct transcripts do not. Files without a sessionId are
 * identified the same way.
 * A forked subagent's transcript opens with a fork-context-ref line that
 * names its session as parentSessionId, so that is read as the sessionId.
 * Returns null for empty/unreadable files (won't be deduplicated).
 */
function identifyTranscript(filePath: string): TranscriptIdentity | null {
  const firstLine = readFirstLine(filePath);
  if (!firstLine?.trim()) return null;

  try {
    const event = JSON.parse(firstLine);
    const sessionId: string | null = event.sessionId || event.parentSessionId || null;
    const isSubagent = Boolean(event.agentId || event.isSidechain);

    if (sessionId && !isSubagent) return { key: sessionId, sessionId };

    return { key: crypto.createHash("sha256").update(firstLine).digest("hex"), sessionId };
  } catch {
    return null;
  }
}

interface TranscriptFile {
  filePath: string;
  sessionId: string | null;
  owner: string; // the copy that stands for this transcript (the file itself when it does)
}

/**
 * Every transcript file, in the order given, marking the one copy that stands for each
 * transcript: the same session found under two paths (a Windows WSL /mnt/c/... path and
 * /home/..., say) or copied between folders, possibly renamed (abc.de.jsonl → abc-de.jsonl).
 */
function markTranscriptCopies(files: string[]): TranscriptFile[] {
  // Transcripts only grow, so the largest copy is the most complete (a backup folder can hold
  // a newer but partial copy); then the newest; then the first. CLI 2.3.2 kept the newest, so a
  // session whose newest copy is partial now hashes into the fingerprint differently.
  const standing = new Map<string, { filePath: string; size: number; mtimeMs: number }>();
  const keys = new Map<TranscriptFile, string>();
  const marked = files.map((filePath) => {
    const identity = identifyTranscript(filePath);
    const file: TranscriptFile = {
      filePath,
      sessionId: identity?.sessionId ?? null,
      owner: filePath,
    };
    if (!identity) return file;
    keys.set(file, identity.key);

    let size = 0;
    let mtimeMs = 0;
    try {
      ({ size, mtimeMs } = fs.statSync(filePath));
    } catch {
      // If stat fails, treat as empty and oldest
    }

    const existing = standing.get(identity.key);
    if (
      !existing ||
      size > existing.size ||
      (size === existing.size && mtimeMs > existing.mtimeMs)
    ) {
      standing.set(identity.key, { filePath, size, mtimeMs });
    }
    return file;
  });
  for (const [file, key] of keys) file.owner = standing.get(key)?.filePath ?? file.filePath;
  return marked;
}

/** Raw lines at the top of a transcript that make its session hash. */
const SESSION_HASH_LINES = 50;

/** Bytes read per step when streaming a transcript. */
const TRANSCRIPT_CHUNK_BYTES = 4 * 1024 * 1024;

/** A line without this key cannot be a usage event, so it is never decoded. */
const USAGE_KEY = Buffer.from('"usage"');

// The read buffer is reused from one transcript to the next. A fresh buffer per read (plus
// a copy of the carried partial line) is memory outside the JS heap, and its churn made V8
// run a full garbage collection every few reads: about 300 per scan of a long history.
let spareReadBuffer: Buffer | null = null;

function takeReadBuffer(size: number): Buffer {
  const buf =
    spareReadBuffer !== null && spareReadBuffer.length === size
      ? spareReadBuffer
      : Buffer.allocUnsafe(size);
  spareReadBuffer = null; // a nested read gets its own
  return buf;
}

export interface ReadTranscriptOptions {
  /** How many leading raw lines to return, split as content.split("\n") splits them. */
  headLines?: number;
  /**
   * Receives each non-blank line that can hold usage, decoded. Without it the
   * read stops as soon as the head is complete.
   */
  onLine?: (line: string) => void;
  /** Bytes per read. The default suits transcripts; tests shrink it to cross boundaries. */
  chunkBytes?: number;
}

/**
 * Read a transcript line by line without loading it whole.
 *
 * Node cannot build a string over buffer.constants.MAX_STRING_LENGTH
 * (~512 MiB): readFileSync threw inside the per-file catch and the largest
 * sessions were silently left out of every submit. Lines are split on the
 * newline byte and only two kinds are decoded — the first `headLines` lines
 * (the session hash input) and lines holding the "usage" key. The rest of a
 * transcript, most of its bytes, is never turned into a string.
 *
 * Returns the head lines. Throws on I/O errors as readFileSync did, so callers
 * keep skipping unreadable files.
 */
export function readTranscriptLines(
  filePath: string,
  options: ReadTranscriptOptions = {}
): string[] {
  const { headLines = 0, onLine, chunkBytes = TRANSCRIPT_CHUNK_BYTES } = options;
  const head: string[] = [];

  const handleLine = (buf: Buffer, start: number, end: number): void => {
    const forHead = head.length < headLines;
    const mayHoldUsage = onLine !== undefined && buf.subarray(start, end).includes(USAGE_KEY);
    if (!forHead && !mayHoldUsage) return;
    const line = buf.toString("utf-8", start, end);
    if (forHead) head.push(line);
    if (mayHoldUsage && line.trim()) onLine(line);
  };

  // The buffer is taken before the file opens and always handed back, so a failed open or
  // allocation leaks neither.
  const initial = takeReadBuffer(chunkBytes);
  try {
    const fd = fs.openSync(filePath, "r");
    try {
      let buf = initial;
      let kept = 0; // bytes of a partial line moved to the front of buf
      for (;;) {
        if (kept > buf.length / 2) {
          // A line longer than half the buffer: grow it for this transcript only
          const bigger = Buffer.allocUnsafe(buf.length * 2);
          buf.copy(bigger, 0, 0, kept);
          buf = bigger;
        }
        const bytesRead = fs.readSync(fd, buf, kept, buf.length - kept, null);
        if (bytesRead === 0) break;
        const filled = buf.subarray(0, kept + bytesRead);
        let start = 0;
        // The kept bytes hold no newline, so the search starts after them
        for (
          let newline = filled.indexOf(0x0a, kept);
          newline !== -1;
          newline = filled.indexOf(0x0a, start)
        ) {
          handleLine(filled, start, newline);
          start = newline + 1;
          if (onLine === undefined && head.length >= headLines) return head;
        }
        kept = filled.length - start;
        filled.copyWithin(0, start);
      }
      // What follows the last newline is a line to split("\n"), even when empty
      handleLine(buf, 0, kept);
    } finally {
      fs.closeSync(fd);
    }
  } finally {
    spareReadBuffer = initial;
  }
  return head;
}

/**
 * Generate SHA256 hash of file content
 * Uses first N lines to create a unique fingerprint
 */
function generateSessionHash(
  filePath: string,
  maxLines: number = SESSION_HASH_LINES
): string | null {
  try {
    return hashSessionLines(
      filePath,
      readTranscriptLines(filePath, { headLines: maxLines }),
      maxLines
    );
  } catch {
    return null;
  }
}

/**
 * Hash a session from its raw (unfiltered) lines.
 * The server stores these hashes for duplicate prevention — the input must
 * stay byte-identical across CLI versions.
 */
function hashSessionLines(
  filePath: string,
  rawLines: string[],
  maxLines: number = SESSION_HASH_LINES
): string {
  const lines = rawLines.slice(0, maxLines).join("\n");

  // Create hash from file content + filename (for uniqueness)
  const fileName = path.basename(filePath);
  const hashInput = `${fileName}:${lines}`;

  return crypto.createHash("sha256").update(hashInput).digest("hex");
}

/**
 * Generate combined fingerprint from all session files
 */
function generateSessionFingerprint(sessionFiles: string[]): SessionFingerprint {
  const sessionHashes: string[] = [];

  for (const file of sessionFiles) {
    const hash = generateSessionHash(file);
    if (hash) {
      sessionHashes.push(hash);
    }
  }

  return buildSessionFingerprint(sessionHashes);
}

/**
 * Combine per-session hashes into a fingerprint
 */
function buildSessionFingerprint(sessionHashes: string[]): SessionFingerprint {
  // Sort hashes for consistent combined hash
  sessionHashes.sort();

  // Create combined hash from all session hashes
  const combinedHash = crypto.createHash("sha256").update(sessionHashes.join(":")).digest("hex");

  return {
    sessionHashes,
    combinedHash,
    sessionCount: sessionHashes.length,
  };
}

export interface ScanOptions {
  days?: number; // Number of days to include (default: 30, 0 = all)
  onProgress?: (current: number, total: number) => void; // Progress callback
  readAccount?: boolean; // false: leave out the sign-in (scheduled runs do not send it)
}

function cutoffFor(days: number): string | null {
  if (days <= 0) return null;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  cutoff.setHours(0, 0, 0, 0);
  return cutoff.toISOString();
}

const cents = (usd: number): number => Math.round(usd * 100) / 100;

// Unrounded per model, rounded once by the caller.
function costOf(modelTokens: Record<string, ModelSplit>): number {
  let cost = 0;
  for (const [model, split] of Object.entries(modelTokens)) {
    cost += estimateCostRaw(model, split);
  }
  return cost;
}

function shareOf(t: TokenSplit): ShareTokens {
  return {
    inputTokens: t.inputTokens,
    outputTokens: t.outputTokens,
    cacheWriteTokens: t.cacheWriteTokens,
    ...(t.cacheWrite1hTokens > 0 ? { cacheWrite1hTokens: t.cacheWrite1hTokens } : {}),
    cacheReadTokens: t.cacheReadTokens,
  };
}

// The 1h and fast parts are sent only when present, so a day without them looks
// exactly like an older CLI's.
function toWireSplit(split: ModelSplit): ModelTokenSplit {
  const fast = split.fast;
  const hasFast =
    fast.inputTokens + fast.outputTokens + fast.cacheWriteTokens + fast.cacheReadTokens > 0;
  return hasFast ? { ...shareOf(split), fast: shareOf(fast) } : shareOf(split);
}

interface ScanSummary {
  usage: CCGatherData["usage"];
  daysTracked: number;
  firstUsed: string | null;
  lastUsed: string | null;
  models: Record<string, number>;
  projects: CCGatherData["projects"];
  dailyUsage: DailyUsage[];
}

function summarizeScan(
  acc: AccumulatedUsage,
  projectSessions: Record<string, number>
): ScanSummary | null {
  const { total } = acc;
  // Total tokens includes cache tokens (matches ccusage calculation)
  if (total.tokens === 0) return null;

  const projects: CCGatherData["projects"] = {};
  for (const [name, sessions] of Object.entries(projectSessions)) {
    const b = acc.projects.get(name);
    projects[name] = {
      tokens: b?.tokens ?? 0,
      cost: b ? cents(costOf(b.modelTokens)) : 0,
      sessions,
      models: b?.models ?? {},
    };
  }

  const dailyUsage: DailyUsage[] = [...acc.daily.entries()]
    .map(([date, b]) => ({
      date,
      tokens: b.tokens,
      cost: cents(costOf(b.modelTokens)),
      inputTokens: b.inputTokens,
      outputTokens: b.outputTokens,
      cacheWriteTokens: b.cacheWriteTokens,
      cacheReadTokens: b.cacheReadTokens,
      sessions: b.sessions.size,
      models: b.models,
      modelTokens: Object.fromEntries(
        Object.entries(b.modelTokens).map(([model, split]) => [model, toWireSplit(split)])
      ),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // From the days that hold a response, so a response that moved days leaves no trace
  const days = [...acc.daily.keys()].sort();
  return {
    usage: {
      totalTokens: total.tokens,
      totalCost: cents(costOf(total.modelTokens)),
      inputTokens: total.inputTokens,
      outputTokens: total.outputTokens,
      cacheReadTokens: total.cacheReadTokens,
      cacheWriteTokens: total.cacheWriteTokens,
    },
    daysTracked: acc.daily.size,
    firstUsed: days[0] ?? null,
    lastUsed: days[days.length - 1] ?? null,
    models: total.models,
    projects,
    dailyUsage,
  };
}

function accountInfo(): CCGatherData["account"] {
  const credentials = readCredentials();
  return {
    ccplan: credentials.ccplan,
    rateLimitTier: credentials.rateLimitTier,
    authMethod: credentials.authMethod,
    rawSubscriptionType: credentials.rawSubscriptionType,
  };
}

/**
 * Scan one project folder's transcripts (default: last 30 days, 0 = all).
 * Sessions are counted per file.
 */
function scanProjectFolder(projectDir: string, options: ScanOptions): CCGatherData | null {
  const acc = createUsageAccumulator({ cutoff: cutoffFor(options.days ?? 30) });
  const jsonlFiles = sortByPath(findJsonlFiles(projectDir), (file) => file);
  const projectSessions: Record<string, number> = {};
  const { onProgress } = options;

  for (let i = 0; i < jsonlFiles.length; i++) {
    const filePath = jsonlFiles[i];
    if (onProgress) {
      onProgress(i + 1, jsonlFiles.length);
    }
    const projectName = extractProjectName(filePath);
    projectSessions[projectName] = (projectSessions[projectName] ?? 0) + 1;

    try {
      readTranscriptLines(filePath, {
        onLine: (line) => {
          try {
            acc.add(JSON.parse(line), {
              sessionKey: filePath,
              projectName,
              pathSessionId: pathSessionId(filePath),
            });
          } catch {
            // Skip invalid JSON lines
          }
        },
      });
    } catch {
      // Skip unreadable files
    }
  }

  const summary = summarizeScan(acc.result(), projectSessions);
  if (!summary) return null;

  return {
    version: CCGATHER_JSON_VERSION,
    lastUpdated: new Date().toISOString(),
    lastScanned: new Date().toISOString(),
    usage: summary.usage,
    stats: {
      daysTracked: summary.daysTracked,
      sessionsCount: jsonlFiles.length,
      firstUsed: summary.firstUsed,
      lastUsed: summary.lastUsed,
    },
    models: summary.models,
    projects: summary.projects,
    dailyUsage: summary.dailyUsage,
    account: accountInfo(),
    // Generate session fingerprint for duplicate prevention
    sessionFingerprint: generateSessionFingerprint(jsonlFiles),
  };
}

/**
 * Scan JSONL files and generate ccgather.json data
 * Only scans the current project directory (based on cwd)
 * @param options.days - Number of days to include (default: 30, 0 or undefined with all flag = all time)
 */
export function scanUsageData(options: ScanOptions = {}): CCGatherData | null {
  // Get current project directory only
  const currentProjectDir = getCurrentProjectDir();

  if (!currentProjectDir) {
    return null;
  }
  return scanProjectFolder(currentProjectDir, options);
}

/**
 * Get total number of session files for current project (for progress calculation)
 */
export function getSessionFileCount(): number {
  const currentProjectDir = getCurrentProjectDir();
  if (!currentProjectDir) {
    return 0;
  }
  return findJsonlFiles(currentProjectDir).length;
}

/**
 * Check if current directory has Claude Code sessions
 */
export function hasProjectSessions(): boolean {
  return getCurrentProjectDir() !== null;
}

/**
 * Get current project path (full path to Claude project folder)
 * Returns null if no matching project found
 */
export function getProjectPath(): string | null {
  return getCurrentProjectDir();
}

/**
 * Get current project name from cwd
 */
export function getCurrentProjectName(): string {
  const cwd = process.cwd();
  return path.basename(cwd);
}

/**
 * Get all available project folders from Claude Code
 * Returns list of { folderName, displayName } for user selection
 */
export function getAllProjectFolders(): Array<{
  folderName: string;
  fullPath: string;
  displayName: string;
}> {
  const projectsDirs = getClaudeProjectsDirs();
  const projects: Array<{ folderName: string; fullPath: string; displayName: string }> = [];

  for (const projectsDir of projectsDirs) {
    try {
      const entries = fs.readdirSync(projectsDir, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (entry.name.startsWith(".")) continue; // Skip hidden folders

        const fullPath = path.join(projectsDir, entry.name);

        // Check if folder has .jsonl files (actual sessions)
        const hasJsonl = findJsonlFiles(fullPath).length > 0;
        if (!hasJsonl) continue;

        // Extract display name from folder name
        // -Users-name-Documents-dev-myProject → myProject
        const parts = entry.name.split("-").filter((p) => p.length > 0);
        const displayName = parts.length > 0 ? parts[parts.length - 1] : entry.name;

        projects.push({
          folderName: entry.name,
          fullPath,
          displayName,
        });
      }
    } catch {
      continue;
    }
  }

  return projects;
}

/**
 * Scan usage data from a specific project folder path
 */
export function scanUsageDataFromPath(
  projectPath: string,
  options: ScanOptions = {}
): CCGatherData | null {
  return scanProjectFolder(projectPath, options);
}

/**
 * Get debug info about session paths
 * Used when no sessions are found to help users troubleshoot
 */
export function getSessionPathDebugInfo(): {
  cwd: string;
  encodedCwd: string;
  searchedPaths: Array<{ path: string; exists: boolean; matchingDirs?: string[] }>;
  platform: string;
  home: string;
} {
  const home = os.homedir();
  const cwd = process.cwd();
  const encodedCwd = encodePathLikeClaude(cwd);

  const pathsToCheck = claudeConfigDirCandidates(process.env, home, savedClaudeDirs()).map((dir) =>
    path.join(dir, "projects")
  );

  const searchedPaths = pathsToCheck.map((p) => {
    const exists = fs.existsSync(p);
    let matchingDirs: string[] | undefined;

    if (exists) {
      try {
        const entries = fs.readdirSync(p, { withFileTypes: true });
        // Find directories that might match (partial match for debugging)
        matchingDirs = entries
          .filter((e) => e.isDirectory())
          .map((e) => e.name)
          .filter((name) => {
            // Check if this could be the project we're looking for
            const lowerName = name.toLowerCase();
            const lowerEncoded = encodedCwd.toLowerCase();
            return (
              lowerName.includes(path.basename(cwd).toLowerCase()) ||
              lowerEncoded.includes(lowerName) ||
              lowerName.includes(lowerEncoded.slice(-20))
            );
          })
          .slice(0, 5); // Limit to 5 matches
      } catch {
        matchingDirs = undefined;
      }
    }

    return { path: p, exists, matchingDirs };
  });

  return {
    cwd,
    encodedCwd,
    searchedPaths,
    platform: process.platform,
    home,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// .ccgather Project Link - Persistent project folder mapping
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Structure of .ccgather file for project linking
 */
export interface ProjectLink {
  claudeProjectPath: string; // Full path to Claude project folder
  folderName: string; // Encoded folder name (for display)
  linkedAt: string; // ISO timestamp when link was created
}

const CCGATHER_FILE = ".ccgather";

/**
 * Get .ccgather file path for current working directory
 */
function getCcgatherFilePath(): string {
  return path.join(process.cwd(), CCGATHER_FILE);
}

/**
 * Check if project link exists in current directory
 */
export function hasProjectLink(): boolean {
  try {
    return fs.existsSync(getCcgatherFilePath());
  } catch {
    return false;
  }
}

/**
 * Load project link from .ccgather file
 */
export function loadProjectLink(): ProjectLink | null {
  try {
    const filePath = getCcgatherFilePath();
    if (!fs.existsSync(filePath)) {
      return null;
    }

    const content = fs.readFileSync(filePath, "utf-8");
    const data = JSON.parse(content) as ProjectLink;

    // Validate required fields
    if (!data.claudeProjectPath || !data.folderName) {
      return null;
    }

    // Verify the linked path still exists
    if (!fs.existsSync(data.claudeProjectPath)) {
      return null;
    }

    return data;
  } catch {
    return null;
  }
}

/**
 * Save project link to .ccgather file
 */
export function saveProjectLink(claudeProjectPath: string, folderName: string): boolean {
  try {
    const filePath = getCcgatherFilePath();
    const data: ProjectLink = {
      claudeProjectPath,
      folderName,
      linkedAt: new Date().toISOString(),
    };

    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
    return true;
  } catch {
    return false;
  }
}

/**
 * Remove project link (.ccgather file)
 * @deprecated Project linking is deprecated in v2.0. Use scanAllProjects() instead.
 */
export function removeProjectLink(): boolean {
  try {
    const filePath = getCcgatherFilePath();
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    return true;
  } catch {
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SCAN ALL PROJECTS - Level-based league system (v2.0)
// Simplifies submission by scanning ALL projects instead of per-project
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Scan ALL Claude Code projects and aggregate usage data
 * This replaces the per-project scan for simpler, fairer ranking
 *
 * Key differences from scanUsageData():
 * - Scans ALL projects, not just current directory
 * - No project linking/matching required
 * - Returns aggregated data across all projects
 *
 * @param options.days - Number of days to include (default: 0 = all time)
 */
export function scanAllProjects(options: ScanOptions = {}): CCGatherData | null {
  const projectsDirs = getClaudeProjectsDirs();

  if (projectsDirs.length === 0) {
    return null;
  }

  // Default: 0 = no limit for all-time data
  const acc = createUsageAccumulator({ cutoff: cutoffFor(options.days ?? 0) });

  // Every transcript file under each project folder. Copies of one transcript (a project
  // reached through two OS paths, Windows WSL /mnt/c/... and /home/..., or files copied
  // between folders) are all read; markTranscriptCopies picks the one that stands for it.
  const rawJsonlFiles: string[] = [];
  for (const projectsDir of projectsDirs) {
    try {
      const entries = fs.readdirSync(projectsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (entry.name.startsWith(".")) continue; // Skip hidden folders

        const projectPath = path.join(projectsDir, entry.name);
        const jsonlFiles = findJsonlFiles(projectPath);
        rawJsonlFiles.push(...jsonlFiles);
      }
    } catch {
      continue;
    }
  }
  // Every copy is read in path order, as ccusage reads them, and the accumulator drops a line
  // it has seen. The copy that stands for a transcript gives its session and fingerprint.
  const allJsonlFiles = markTranscriptCopies(sortByPath(rawJsonlFiles, (file) => file));
  const sessionHashes: string[] = [];

  if (allJsonlFiles.length === 0) {
    return null;
  }

  // A session's main transcript and its subagent transcripts are separate files,
  // so sessions are counted by sessionId rather than by file. A file that names
  // no session (a workflow journal, say) counts only if it holds usage.
  // Copies of a transcript share the key of the copy that stands for it.
  const sessionKeyOf = (file: TranscriptFile): string => file.sessionId ?? file.owner;
  const countedSessions = new Set<string>();
  const projectSessions: Record<string, Set<string>> = {};
  const { onProgress } = options;

  for (let i = 0; i < allJsonlFiles.length; i++) {
    const file = allJsonlFiles[i];
    const { filePath } = file;
    const stands = file.owner === filePath;
    const sessionKey = sessionKeyOf(file);
    const lineSession = pathSessionId(filePath);
    // A copy's usage goes to the project of the copy that stands for it
    const projectName = extractProjectName(file.owner);
    projectSessions[projectName] ??= new Set();
    let hasUsage = false;

    try {
      // One pass per file: the first lines feed the session hash (re-reading
      // every session after the progress bar hit 100% left the CLI silent for
      // a long time) and the usage lines feed the totals.
      const rawHead = readTranscriptLines(filePath, {
        headLines: SESSION_HASH_LINES,
        onLine: (line) => {
          try {
            const event = JSON.parse(line);
            if (isUsageLine(event)) hasUsage = true;
            acc.add(event, { sessionKey, projectName, pathSessionId: lineSession });
          } catch {
            // Skip invalid JSON lines
          }
        },
      });
      if (stands) sessionHashes.push(hashSessionLines(filePath, rawHead));
    } catch {
      // Skip unreadable files
    }

    if (stands && (file.sessionId || hasUsage)) {
      countedSessions.add(sessionKey);
      projectSessions[projectName].add(sessionKey);
    }

    // Progress callback after file processing (not before)
    if (onProgress) {
      onProgress(i + 1, allJsonlFiles.length);
    }
  }

  const summary = summarizeScan(
    acc.result(),
    Object.fromEntries(Object.entries(projectSessions).map(([name, set]) => [name, set.size]))
  );
  if (!summary) return null;

  return {
    version: CCGATHER_JSON_VERSION,
    lastUpdated: new Date().toISOString(),
    lastScanned: new Date().toISOString(),
    usage: summary.usage,
    stats: {
      daysTracked: summary.daysTracked,
      sessionsCount: countedSessions.size,
      firstUsed: summary.firstUsed,
      lastUsed: summary.lastUsed,
    },
    models: summary.models,
    projects: summary.projects,
    dailyUsage: summary.dailyUsage,
    account: options.readAccount === false ? undefined : accountInfo(),
    sessionFingerprint: buildSessionFingerprint(sessionHashes),
  };
}

/**
 * Get total count of all session files across all projects
 */
export function getAllSessionsCount(): number {
  const projectsDirs = getClaudeProjectsDirs();
  let count = 0;

  for (const projectsDir of projectsDirs) {
    try {
      const entries = fs.readdirSync(projectsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (entry.name.startsWith(".")) continue;

        const projectPath = path.join(projectsDir, entry.name);
        count += findJsonlFiles(projectPath).length;
      }
    } catch {
      continue;
    }
  }

  return count;
}

/**
 * Check if any Claude Code sessions exist
 */
export function hasAnySessions(): boolean {
  return getAllSessionsCount() > 0;
}
