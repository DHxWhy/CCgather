/**
 * Usage accumulator shared by every scan. It counts a transcript the way `ccusage claude
 * daily` does (ccusage 20.0.37, rust/adapters/claude/src/daily.rs): one response is written
 * as several lines (one per content block) that repeat the usage with a placeholder output
 * count on the early lines, so a response is counted once, at its largest line. Line shapes,
 * dedup keys, /btw replays, the replacement order and advisor entries follow daily.rs.
 *
 * Deliberate differences from ccusage:
 * - A response stays on the day and model where its first line was seen; a larger line only
 *   swaps the token values. ccusage moves it to the surviving line's day. The server never
 *   lowers a stored day, so moving a response that spans UTC midnight between two submits
 *   would count it on both days.
 * - On equal token totals ccusage prefers the costlier line (fast mode); this prefers the line
 *   that states its speed. Token totals are the same either way.
 * - ccusage drops a line when a null sits under certain field names anywhere in it (a tool
 *   input with "model": null drops a real usage line); this checks those fields only where
 *   they belong. It also does not see raw-text quirks ccusage rejects ("usage": { with a
 *   space, duplicate keys).
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
  sessions: Set<string>; // transcript files that contributed
}

export interface AccumulatedUsage {
  total: UsageBucket;
  daily: Map<string, UsageBucket>; // UTC date
  projects: Map<string, UsageBucket>;
  firstTimestamp: string | null;
  lastTimestamp: string | null;
}

export interface UsageContext {
  sessionKey: string; // the transcript file, or its session when the scan knows it
  projectName: string;
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
  timestamp: string;
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

function emptyBucket(): UsageBucket {
  return { ...emptySplit(), tokens: 0, models: {}, modelTokens: {}, sessions: new Set() };
}

// Token counts must be non-negative integers; input and output must be there. Cache writes
// come from the 5-minute + 1-hour breakdown whenever it is present, as in ccusage.
function readSplit(usage: JsonObject): TokenSplit | null {
  const optional = (v: unknown) => (v === undefined ? 0 : isCount(v) ? v : null);
  const input = usage.input_tokens;
  const output = usage.output_tokens;
  const flatWrite = optional(usage.cache_creation_input_tokens);
  const cacheRead = optional(usage.cache_read_input_tokens);
  if (!isCount(input) || !isCount(output) || flatWrite === null || cacheRead === null) return null;

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

// RFC 3339 with a zone, as ccusage parses it; anything else is not a usable timestamp.
const ZONED = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/i;

function readInstant(v: unknown): number | null {
  if (typeof v !== "string" || !ZONED.test(v)) return null;
  const ms = Date.parse(v);
  return Number.isFinite(ms) ? ms : null;
}

// Gateways reuse one placeholder id for every response; real Anthropic ids (and OpenAI
// Responses ids) are unique per response.
const isAnthropicMessageId = (id: string): boolean =>
  id.startsWith("msg_") || id.startsWith("resp_");

// ccusage drops a line whose ids or model are empty, null or not strings, whose version is
// not semver, or whose known fields are null.
function isValidLine(
  event: JsonObject,
  line: JsonObject,
  message: JsonObject,
  usage: JsonObject
): boolean {
  const optionalText = (v: unknown, nonEmpty: boolean) =>
    v === undefined || (typeof v === "string" && (!nonEmpty || v !== ""));
  if (event.version !== undefined) {
    if (typeof event.version !== "string" || !/^\d+\.\d+\.\d+/.test(event.version)) return false;
  }
  if (!optionalText(event.sessionId, true)) return false;
  if (!optionalText(line.requestId, true)) return false;
  if (!optionalText(message.id, true)) return false;
  if (!optionalText(message.model, true)) return false;
  if (usage.speed !== undefined && usage.speed !== "standard" && usage.speed !== "fast") {
    return false;
  }
  if (line.isSidechain !== undefined && typeof line.isSidechain !== "boolean") return false;
  return [event.cwd, event.isApiErrorMessage, line.costUSD].every((v) => v !== null);
}

// A direct line carries message.usage; an agent-progress record nests the subagent's message
// in data.message, with its own timestamp, request id and sidechain flag.
function locate(event: JsonObject): { line: JsonObject; message: JsonObject } | null {
  if (isObject(event.message) && isObject(event.message.usage)) {
    return { line: event, message: event.message };
  }
  const progress = isObject(event.data) ? event.data.message : undefined;
  if (isObject(progress) && isObject(progress.message) && isObject(progress.message.usage)) {
    return { line: progress, message: progress.message };
  }
  return null;
}

function readEntries(event: JsonObject, ctx: UsageContext): Entry[] {
  const found = locate(event);
  if (!found) return [];
  const { line, message } = found;
  const usage = message.usage as JsonObject;
  if (!isValidLine(event, line, message, usage)) return [];
  const instant = readInstant(line.timestamp);
  if (instant === null) return [];
  const split = readSplit(usage);
  if (!split) return [];

  const shared = {
    requestId: typeof line.requestId === "string" ? line.requestId : null,
    sessionId: typeof event.sessionId === "string" ? event.sessionId : ctx.sessionKey,
    timestamp: line.timestamp as string,
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
  // usage. ccusage keeps none of a line's advisors if any iteration is malformed.
  const iterations = Array.isArray(usage.iterations) ? usage.iterations : [];
  const wellFormed = iterations.every(
    (it) =>
      isObject(it) &&
      typeof it.type === "string" &&
      isCount(it.input_tokens) &&
      isCount(it.output_tokens)
  );
  if (!wellFormed) return entries;
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
      hasSpeed: it.speed === "fast" || it.speed === "standard",
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
  const daily = new Map<string, UsageBucket>();
  const projects = new Map<string, UsageBucket>();
  let firstTimestamp: string | null = null;
  let lastTimestamp: string | null = null;

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
  // response, or a list when several share it (gateways reusing a message id).
  type Slot = Counted | Counted[];
  const byKey = new Map<string, Slot>();
  const replayAny = new Map<string, Slot>();
  const replaySidechain = new Map<string, Slot>();

  const slotList = (slot: Slot | undefined): Counted[] =>
    slot === undefined ? [] : Array.isArray(slot) ? slot : [slot];

  const push = (index: Map<string, Slot>, key: string, c: Counted): void => {
    const slot = index.get(key);
    if (slot === undefined) index.set(key, c);
    else if (Array.isArray(slot)) {
      if (!slot.includes(c)) slot.push(c);
    } else if (slot !== c) index.set(key, [slot, c]);
  };

  const indexRoutes = (c: Counted, messageId: string, sessionId: string): void => {
    const route = `${messageId}\u0000${sessionId}`;
    push(replayAny, route, c);
    if (c.sidechain) push(replaySidechain, route, c);
  };

  const bucket = (map: Map<string, UsageBucket>, key: string): UsageBucket => {
    let b = map.get(key);
    if (!b) {
      b = emptyBucket();
      map.set(key, b);
    }
    return b;
  };

  const place = (c: Counted, split: TokenSplit, fast: boolean, sign: 1 | -1): void => {
    const tokens = splitTotal(split);
    for (const b of [total, bucket(projects, c.project), bucket(daily, c.date)]) {
      addSplit(b, split, sign);
      b.tokens += sign * tokens;
      b.models[c.model] = (b.models[c.model] ?? 0) + sign * tokens;
      const m = (b.modelTokens[c.model] ??= { ...emptySplit(), fast: emptySplit() });
      addSplit(m, split, sign);
      if (fast) addSplit(m.fast, split, sign);
      if (sign > 0) b.sessions.add(c.session);
    }
  };

  const find = (e: Entry, key: string | null): Counted | undefined => {
    if (e.messageId === null) return undefined;
    // The stored key is the surviving line's, so a match also re-checks that line (daily.rs).
    const exact = key ? slotList(byKey.get(key)).find((c) => c.key === key) : undefined;
    if (exact) return exact;
    const routes = e.sidechain ? replayAny : replaySidechain;
    return slotList(routes.get(`${e.messageId}\u0000${e.sessionId}`)).find(
      (c) => e.sidechain || c.sidechain
    );
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
          push(replayAny, route, existing);
          push(replaySidechain, route, existing);
        }
      }
      if (existing.excluded || !shouldReplace(e, existing)) return false;
      place(existing, existing, existing.fast, -1);
      take(existing, e, key);
      place(existing, e.split, e.fast, 1);
      if (key) push(byKey, key, existing);
      if (e.messageId !== null) indexRoutes(existing, e.messageId, existing.sessionId);
      return true;
    }

    const c = {
      model: shared(e.model),
      date: shared(new Date(e.instant).toISOString().slice(0, 10)),
      project: shared(ctx.projectName),
      session: shared(ctx.sessionKey),
      excluded: Boolean(cutoff && e.timestamp < cutoff),
    } as Counted;
    take(c, e, key);
    if (e.messageId !== null) {
      if (key) push(byKey, key, c);
      indexRoutes(c, e.messageId, c.sessionId);
    }
    if (c.excluded) return false;

    place(c, e.split, e.fast, 1);
    if (!firstTimestamp || e.timestamp < firstTimestamp) firstTimestamp = e.timestamp;
    if (!lastTimestamp || e.timestamp > lastTimestamp) lastTimestamp = e.timestamp;
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
      return { total, daily, projects, firstTimestamp, lastTimestamp };
    },
  };
}
