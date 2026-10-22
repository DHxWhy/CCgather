/**
 * Usage accumulator shared by every scan. It counts a transcript the way `ccusage claude
 * daily` does (ccusage 20.0.37, rust/adapters/claude/src/daily.rs): one response is written
 * as several lines (one per content block) that repeat the usage with a placeholder output
 * count on the early lines, so a response is counted once, at its largest line. Line shapes,
 * dedup keys, /btw replays, the replacement order and advisor entries follow daily.rs.
 *
 * Deliberate differences from ccusage:
 * - Within one chain a response stays on the day and model where its first line was seen; a
 *   larger line only swaps the token values. ccusage moves it to the surviving line's day. The
 *   server never lowers a stored day, so moving a response that spans UTC midnight between
 *   two submits would count it on both days. A main-chain line that takes over from a
 *   sidechain copy does move the response to its own day, as in ccusage.
 * - On equal token totals ccusage prefers the costlier line (fast mode); this prefers the line
 *   that states its speed. Token totals are the same either way.
 * - ccusage drops a line when a null sits under certain field names anywhere in it (a tool
 *   input with "model": null drops a real usage line); this checks those fields only where
 *   they belong. It also does not see raw-text quirks ccusage rejects ("usage": { with a
 *   space, duplicate keys, 5.0 for an integer, a lone surrogate escape).
 * - A "<synthetic>" message keeps that model name (ccusage leaves it unnamed), so a day's
 *   per-model split still adds up to its totals.
 * - A cache_creation array is not a breakdown here (ccusage reads [5m, 1h] from it); the line
 *   is dropped.
 * - What the scans read (ccgather-json.ts): only files inside a project folder (ccusage also
 *   reads a file right under projects/), a file named just ".jsonl" (ccusage skips it), and no
 *   file whose name is not valid UTF-8. Paths are resolved before sorting and before a line's
 *   session is taken from them; ccusage uses the folder strings it is given.
 */

export interface TokenSplit {
  inputTokens: number;
  outputTokens: number;
  cacheWriteTokens: number;
  cacheWrite1hTokens: number; // the part of cacheWriteTokens written to the 1-hour cache
  cacheReadTokens: number;
}

export interface ModelSplit extends TokenSplit {
  fast: TokenSplit; // the part of the above sent in fast mode
}

export interface UsageBucket extends TokenSplit {
  tokens: number; // input + output + cache write + cache read
  models: Record<string, number>;
  modelTokens: Record<string, ModelSplit>;
  sessions: Set<string>; // the scan's session keys that contributed
}

export interface AccumulatedUsage {
  total: UsageBucket;
  daily: Map<string, UsageBucket>; // UTC date
  projects: Map<string, UsageBucket>;
}

export interface UsageContext {
  sessionKey: string; // what the scan counts the file's session as (its sessionId, or a file)
  projectName: string;
  pathSessionId?: string; // ccusage's session for a line without one, from the file's path
}

export interface UsageAccumulator {
  /** True when the line was counted: new usage, or it replaced the line standing for its response. */
  add(event: unknown, ctx: UsageContext): boolean;
  result(): AccumulatedUsage;
}

interface Entry {
  messageId: string | null;
  requestId: string | null;
  sessionId: string;
  instant: number; // epoch ms, for keys that need the exact time
  sidechain: boolean;
  model: string;
  split: TokenSplit;
  fast: boolean;
  hasSpeed: boolean;
}

// One per response, kept for the whole scan: flat fields and shared strings only, since a long
// history holds hundreds of thousands of responses.
interface Counted {
  key: string | null; // the surviving line's exact key (the same string the index uses)
  sessionId: string;
  sidechain: boolean;
  inputTokens: number; // the surviving line's tokens
  outputTokens: number;
  cacheWriteTokens: number;
  cacheWrite1hTokens: number;
  cacheReadTokens: number;
  fast: boolean;
  hasSpeed: boolean;
  model: string; // where the response was first placed
  date: string;
  project: string;
  session: string;
  excluded: boolean; // first seen before the cutoff: the whole response stays out
}

type JsonObject = Record<string, unknown>;

const isObject = (v: unknown): v is JsonObject =>
  v !== null && typeof v === "object" && !Array.isArray(v);

const isCount = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v >= 0;

const splitTotal = (s: TokenSplit): number =>
  s.inputTokens + s.outputTokens + s.cacheWriteTokens + s.cacheReadTokens;

function emptySplit(): TokenSplit {
  return {
    inputTokens: 0,
    outputTokens: 0,
    cacheWriteTokens: 0,
    cacheWrite1hTokens: 0,
    cacheReadTokens: 0,
  };
}

// A bucket also counts the responses standing in it, overall, per model and per session, so a
// day, model or session a response moved away from disappears instead of staying at zero.
type Bucket = UsageBucket & {
  standing: number;
  standingByModel: Record<string, number>;
  standingBySession: Map<string, number>;
};

function emptyBucket(): Bucket {
  return {
    ...emptySplit(),
    tokens: 0,
    models: {},
    modelTokens: {},
    sessions: new Set(),
    standing: 0,
    standingByModel: {},
    standingBySession: new Map(),
  };
}

// Token counts must be non-negative integers; input and output must be there. Cache writes
// come from the 5-minute + 1-hour breakdown whenever it is present, as in ccusage; a
// breakdown that is not an object rejects the line.
function readSplit(usage: JsonObject): TokenSplit | null {
  const optional = (v: unknown) => (v === undefined ? 0 : isCount(v) ? v : null);
  const input = usage.input_tokens;
  const output = usage.output_tokens;
  const flatWrite = optional(usage.cache_creation_input_tokens);
  const cacheRead = optional(usage.cache_read_input_tokens);
  if (!isCount(input) || !isCount(output) || flatWrite === null || cacheRead === null) return null;
  const breakdown = usage.cache_creation;
  if (breakdown !== undefined && breakdown !== null && !isObject(breakdown)) return null;

  let cacheWrite = flatWrite;
  let oneHour = 0;
  if (isObject(usage.cache_creation)) {
    const fiveMinute = optional(usage.cache_creation.ephemeral_5m_input_tokens);
    const hour = optional(usage.cache_creation.ephemeral_1h_input_tokens);
    if (fiveMinute === null || hour === null) return null;
    cacheWrite = fiveMinute + hour;
    oneHour = hour;
  }
  return {
    inputTokens: input,
    outputTokens: output,
    cacheWriteTokens: cacheWrite,
    cacheWrite1hTokens: oneHour,
    cacheReadTokens: cacheRead,
  };
}

function addSplit(target: TokenSplit, s: TokenSplit, sign: number): void {
  target.inputTokens += sign * s.inputTokens;
  target.outputTokens += sign * s.outputTokens;
  target.cacheWriteTokens += sign * s.cacheWriteTokens;
  target.cacheWrite1hTokens += sign * s.cacheWrite1hTokens;
  target.cacheReadTokens += sign * s.cacheReadTokens;
}

// What ccusage parses: whole seconds or exactly milliseconds, then Z or an offset with a colon.
const ZONED = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?(Z|[+-]\d{2}:\d{2})$/;

const utcDay = (instant: number): string => new Date(instant).toISOString().slice(0, 10);

// Date.parse rolls 24:00 and Feb 30 over to the next day; ccusage rejects them.
function readInstant(v: unknown): number | null {
  if (typeof v !== "string" || !ZONED.test(v)) return null;
  const [year, month, day, hour, minute, second] = v.slice(0, 19).split(/\D/).map(Number);
  if (month < 1 || month > 12) return null;
  // Gregorian leap years, year 0 included (Date.UTC would read 0-99 as 1900-1999)
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1] ?? 0;
  if (day < 1 || day > daysInMonth) return null;
  if (hour > 23 || minute > 59 || second > 59) return null;
  const ms = Date.parse(v);
  return Number.isFinite(ms) ? ms : null;
}

// Gateways reuse one placeholder id for every response; real Anthropic ids (and OpenAI
// Responses ids) are unique per response.
const isAnthropicMessageId = (id: string): boolean =>
  id.startsWith("msg_") || id.startsWith("resp_");

const isSpeed = (v: unknown): boolean => v === "standard" || v === "fast";

// ccusage drops a line whose ids or model are empty, null or not strings, whose version is
// not semver (direct lines only: an agent-progress record's version is not read), whose cost
// is not a number, or whose known fields are null. isSidechain may be null (not a sidechain).
function isValidLine(
  event: JsonObject,
  line: JsonObject,
  message: JsonObject,
  usage: JsonObject,
  direct: boolean
): boolean {
  const optionalText = (v: unknown, nonEmpty: boolean) =>
    v === undefined || (typeof v === "string" && (!nonEmpty || v !== ""));
  if (direct && event.version !== undefined) {
    if (typeof event.version !== "string" || !/^\d+\.\d+\.\d+/.test(event.version)) return false;
  }
  if (!optionalText(event.sessionId, true)) return false;
  if (!optionalText(line.requestId, true)) return false;
  if (!optionalText(message.id, true)) return false;
  if (!optionalText(message.model, true)) return false;
  if (usage.speed !== undefined && !isSpeed(usage.speed)) return false;
  const sidechain = line.isSidechain;
  if (sidechain !== undefined && sidechain !== null && typeof sidechain !== "boolean") return false;
  if (line.costUSD !== undefined && typeof line.costUSD !== "number") return false;
  return [event.cwd, event.isApiErrorMessage].every((v) => v !== null);
}

// A direct line carries message.usage; an agent-progress record nests the subagent's message
// in data.message, with its own timestamp, request id and sidechain flag.
function locate(
  event: JsonObject
): { line: JsonObject; message: JsonObject; direct: boolean } | null {
  if (isObject(event.message) && isObject(event.message.usage)) {
    return { line: event, message: event.message, direct: true };
  }
  const progress = isObject(event.data) ? event.data.message : undefined;
  if (isObject(progress) && isObject(progress.message) && isObject(progress.message.usage)) {
    return { line: progress, message: progress.message, direct: false };
  }
  return null;
}

/** True for a line that carries usage, counted or not (the scan uses it to count sessions). */
export const isUsageLine = (event: unknown): boolean => isObject(event) && locate(event) !== null;

// An iteration ccusage can read: a type, input and output counts, and optional cache counts,
// cache breakdown and speed of the right kinds. One unreadable iteration voids every advisor
// of the line.
const optionalCount = (v: unknown): boolean => v === undefined || v === null || isCount(v);
function isReadableIteration(it: unknown): boolean {
  if (!isObject(it) || typeof it.type !== "string") return false;
  if (it.model !== undefined && it.model !== null && typeof it.model !== "string") return false;
  if (!isCount(it.input_tokens) || !isCount(it.output_tokens)) return false;
  if (
    !optionalCount(it.cache_creation_input_tokens) ||
    !optionalCount(it.cache_read_input_tokens)
  ) {
    return false;
  }
  const breakdown = it.cache_creation;
  if (breakdown !== undefined && breakdown !== null) {
    if (!isObject(breakdown)) return false;
    if (!optionalCount(breakdown.ephemeral_5m_input_tokens)) return false;
    if (!optionalCount(breakdown.ephemeral_1h_input_tokens)) return false;
  }
  return it.speed === undefined || it.speed === null || isSpeed(it.speed);
}

// ccusage drops the whole line when an iteration holds a null cache count or speed.
const hasNullIterationField = (it: unknown): boolean =>
  isObject(it) &&
  (it.cache_creation_input_tokens === null ||
    it.cache_read_input_tokens === null ||
    it.speed === null);

function readEntries(event: JsonObject, ctx: UsageContext): Entry[] {
  const found = locate(event);
  if (!found) return [];
  const { line, message, direct } = found;
  const usage = message.usage as JsonObject;
  if (!isValidLine(event, line, message, usage, direct)) return [];
  const iterations = Array.isArray(usage.iterations) ? usage.iterations : [];
  if (iterations.some(hasNullIterationField)) return [];
  const instant = readInstant(line.timestamp);
  if (instant === null) return [];
  const split = readSplit(usage);
  if (!split) return [];

  const shared = {
    requestId: typeof line.requestId === "string" ? line.requestId : null,
    sessionId:
      typeof event.sessionId === "string" ? event.sessionId : (ctx.pathSessionId ?? ctx.sessionKey),
    instant,
    sidechain: line.isSidechain === true,
  };
  const messageId = typeof message.id === "string" ? message.id : null;
  const entries: Entry[] = [
    {
      ...shared,
      messageId,
      model: typeof message.model === "string" ? message.model : "unknown",
      split,
      fast: usage.speed === "fast",
      hasSpeed: usage.speed !== undefined,
    },
  ];

  // An advisor consultation is billed to the advisor model and is not in the top-level
  // usage. ccusage reads advisors from direct lines only, and keeps none of a line's
  // advisors if any iteration is unreadable.
  if (!direct || !iterations.every(isReadableIteration)) return entries;
  const advisors = iterations.filter(
    (it): it is JsonObject =>
      isObject(it) &&
      it.type === "advisor_message" &&
      typeof it.model === "string" &&
      it.model !== ""
  );
  advisors.forEach((it, index) => {
    const advisorSplit = readSplit(it);
    if (!advisorSplit) return;
    entries.push({
      ...shared,
      messageId: messageId === null ? null : `${messageId}:advisor:${index}`,
      model: it.model as string,
      split: advisorSplit,
      fast: it.speed === "fast",
      hasSpeed: isSpeed(it.speed),
    });
  });
  return entries;
}

// ccusage's should_replace_deduped_daily_entry: a main-chain line beats a sidechain copy,
// then the larger token total wins, then a line that states its speed.
function shouldReplace(candidate: Entry, existing: Counted): boolean {
  if (candidate.sidechain !== existing.sidechain) return existing.sidechain;
  const a = splitTotal(candidate.split);
  const b = splitTotal(existing);
  if (a !== b) return a > b;
  return candidate.hasSpeed && !existing.hasSpeed;
}

function exactKey(e: Entry): string | null {
  if (e.messageId === null) return null;
  if (e.requestId !== null) return `r\u0000${e.messageId}\u0000${e.requestId}`;
  const inSession = `s\u0000${e.messageId}\u0000${e.sessionId}`;
  return isAnthropicMessageId(e.messageId) ? inSession : `${inSession}\u0000${e.instant}`;
}

export function createUsageAccumulator(options: { cutoff?: string | null } = {}): UsageAccumulator {
  const cutoff = options.cutoff ?? null;
  const total = emptyBucket();
  const daily = new Map<string, Bucket>();
  const projects = new Map<string, Bucket>();
  const cutoffInstant = cutoff === null ? null : Date.parse(cutoff);
  const beforeCutoff = (instant: number): boolean =>
    cutoffInstant !== null && instant < cutoffInstant;

  // Strings repeated across responses (sessions, models, days, projects) are kept once.
  const pool = new Map<string, string>();
  const shared = (v: string): string => {
    const kept = pool.get(v);
    if (kept !== undefined) return kept;
    pool.set(v, v);
    return v;
  };

  // Lookups by exact key, then by (message, session): /btw sidechains replay parent messages
  // under new request ids and times. Every response is indexed for sidechain candidates and
  // sidechain responses once more for parent candidates, as in daily.rs. A slot holds one
  // entry, or a list when several share it (gateways reusing a message id). A route entry is
  // the response itself, which matches only while it is still in that session (daily.rs
  // re-checks the survivor's current session), or an alias a cross-session copy added.
  type Alias = { alias: Counted };
  type Slot<T> = T | T[];
  const byKey = new Map<string, Slot<Counted>>();
  const replayAny = new Map<string, Slot<Counted | Alias>>();
  const replaySidechain = new Map<string, Slot<Counted | Alias>>();
  const aliases = new WeakMap<Counted, Alias>();
  const aliasOf = (c: Counted): Alias => {
    let a = aliases.get(c);
    if (!a) {
      a = { alias: c };
      aliases.set(c, a);
    }
    return a;
  };

  const slotList = <T>(slot: Slot<T> | undefined): T[] =>
    slot === undefined ? [] : Array.isArray(slot) ? slot : [slot];

  const push = <T>(index: Map<string, Slot<T>>, key: string, item: T): void => {
    const slot = index.get(key);
    if (slot === undefined) index.set(key, item);
    else if (Array.isArray(slot)) {
      if (!slot.includes(item)) slot.push(item);
    } else if (slot !== item) index.set(key, [slot, item]);
  };

  const indexRoutes = (c: Counted, messageId: string, sessionId: string): void => {
    const route = `${messageId}\u0000${sessionId}`;
    push(replayAny, route, c);
    if (c.sidechain) push(replaySidechain, route, c);
  };

  const bucket = (map: Map<string, Bucket>, key: string): Bucket => {
    let b = map.get(key);
    if (!b) {
      b = emptyBucket();
      map.set(key, b);
    }
    return b;
  };

  // Returns how many responses stand in the bucket afterwards.
  const placeIn = (
    b: Bucket,
    c: Counted,
    split: TokenSplit,
    tokens: number,
    fast: boolean,
    sign: 1 | -1
  ): number => {
    addSplit(b, split, sign);
    b.tokens += sign * tokens;
    const left = (b.standingByModel[c.model] ?? 0) + sign;
    if (left > 0) {
      b.standingByModel[c.model] = left;
      b.models[c.model] = (b.models[c.model] ?? 0) + sign * tokens;
      const m = (b.modelTokens[c.model] ??= { ...emptySplit(), fast: emptySplit() });
      addSplit(m, split, sign);
      if (fast) addSplit(m.fast, split, sign);
    } else {
      delete b.standingByModel[c.model];
      delete b.models[c.model];
      delete b.modelTokens[c.model];
    }
    const inSession = (b.standingBySession.get(c.session) ?? 0) + sign;
    if (inSession > 0) {
      b.standingBySession.set(c.session, inSession);
      b.sessions.add(c.session);
    } else {
      b.standingBySession.delete(c.session);
      b.sessions.delete(c.session);
    }
    b.standing += sign;
    return b.standing;
  };

  const place = (c: Counted, split: TokenSplit, fast: boolean, sign: 1 | -1): void => {
    const tokens = splitTotal(split);
    placeIn(total, c, split, tokens, fast, sign);
    if (placeIn(bucket(projects, c.project), c, split, tokens, fast, sign) === 0) {
      projects.delete(c.project);
    }
    if (placeIn(bucket(daily, c.date), c, split, tokens, fast, sign) === 0) daily.delete(c.date);
  };

  const find = (e: Entry, key: string | null): Counted | undefined => {
    if (e.messageId === null) return undefined;
    // The stored key is the surviving line's, so a match also re-checks that line (daily.rs).
    const exact = key ? slotList(byKey.get(key)).find((c) => c.key === key) : undefined;
    if (exact) return exact;
    const routes = e.sidechain ? replayAny : replaySidechain;
    for (const entry of slotList(routes.get(`${e.messageId}\u0000${e.sessionId}`))) {
      const isAlias = "alias" in entry;
      const c = isAlias ? entry.alias : entry;
      if ((isAlias || c.sessionId === e.sessionId) && (e.sidechain || c.sidechain)) return c;
    }
    return undefined;
  };

  const take = (c: Counted, e: Entry, key: string | null): void => {
    c.key = key;
    c.sessionId = shared(e.sessionId);
    c.sidechain = e.sidechain;
    c.inputTokens = e.split.inputTokens;
    c.outputTokens = e.split.outputTokens;
    c.cacheWriteTokens = e.split.cacheWriteTokens;
    c.cacheWrite1hTokens = e.split.cacheWrite1hTokens;
    c.cacheReadTokens = e.split.cacheReadTokens;
    c.fast = e.fast;
    c.hasSpeed = e.hasSpeed;
  };

  const consider = (e: Entry, ctx: UsageContext): boolean => {
    const key = exactKey(e);
    const existing = find(e, key);

    if (existing) {
      const previousSession = existing.sessionId;
      if (e.messageId !== null && previousSession !== e.sessionId) {
        // A cross-session copy can become the survivor: keep both sessions' replay routes.
        for (const sessionId of [e.sessionId, previousSession]) {
          const route = `${e.messageId}\u0000${sessionId}`;
          push(replayAny, route, aliasOf(existing));
          push(replaySidechain, route, aliasOf(existing));
        }
      }
      if (existing.excluded || !shouldReplace(e, existing)) return false;
      place(existing, existing, existing.fast, -1);
      // A /btw replay can be read before the line it copies when its file sorts first (the
      // copy sits in another session's or project's transcript) and carries the replay's
      // time; when the parent's own line takes over, the response goes back to the parent's
      // day, model, project and session.
      const moves = existing.sidechain && !e.sidechain;
      if (moves) {
        existing.model = shared(e.model);
        existing.date = shared(utcDay(e.instant));
        existing.project = shared(ctx.projectName);
        existing.session = shared(ctx.sessionKey);
        existing.excluded = beforeCutoff(e.instant);
      }
      take(existing, e, key);
      if (key) push(byKey, key, existing);
      if (e.messageId !== null) indexRoutes(existing, e.messageId, existing.sessionId);
      if (existing.excluded) return false;
      place(existing, e.split, e.fast, 1);
      return true;
    }

    const c: Counted = {
      key,
      sessionId: shared(e.sessionId),
      sidechain: e.sidechain,
      inputTokens: e.split.inputTokens,
      outputTokens: e.split.outputTokens,
      cacheWriteTokens: e.split.cacheWriteTokens,
      cacheWrite1hTokens: e.split.cacheWrite1hTokens,
      cacheReadTokens: e.split.cacheReadTokens,
      fast: e.fast,
      hasSpeed: e.hasSpeed,
      model: shared(e.model),
      date: shared(utcDay(e.instant)),
      project: shared(ctx.projectName),
      session: shared(ctx.sessionKey),
      excluded: beforeCutoff(e.instant),
    };
    if (e.messageId !== null) {
      if (key) push(byKey, key, c);
      indexRoutes(c, e.messageId, c.sessionId);
    }
    if (c.excluded) return false;

    place(c, e.split, e.fast, 1);
    return true;
  };

  return {
    add(event, ctx) {
      if (!isObject(event)) return false;
      let counted = false;
      for (const e of readEntries(event, ctx)) {
        if (consider(e, ctx)) counted = true;
      }
      return counted;
    },
    result() {
      return { total, daily, projects };
    },
  };
}
