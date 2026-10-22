/**
 * Usage accumulator shared by every scan. It counts a transcript the way ccusage does:
 * one response is written as several lines (one per content block) that repeat the
 * usage with a placeholder output count on the early lines, so a response is counted
 * once, at its largest line. Dedup keys, the replacement order and the advisor entries
 * follow ccusage 20.0.37 (rust/adapters/claude/src/lib.rs).
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
  daily: Map<string, UsageBucket>; // UTC date; a line without a timestamp counts on no day
  projects: Map<string, UsageBucket>;
  firstTimestamp: string | null;
  lastTimestamp: string | null;
}

export interface UsageContext {
  sessionKey: string; // the transcript file
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
  timestamp: string | null;
  instant: string; // the timestamp as epoch ms, for keys that need the exact time
  sidechain: boolean;
  model: string;
  split: TokenSplit;
  fast: boolean;
  hasSpeed: boolean;
}

interface Counted {
  entry: Entry; // the line that currently stands for the response
  model: string; // where the response was first placed
  date: string | null;
  project: string;
  session: string;
  excluded: boolean; // first seen before the cutoff: the whole response stays out
}

type JsonObject = Record<string, unknown>;

const isObject = (v: unknown): v is JsonObject =>
  v !== null && typeof v === "object" && !Array.isArray(v);

const count = (v: unknown): number =>
  typeof v === "number" && Number.isFinite(v) && v > 0 ? v : 0;

const optionalString = (v: unknown): string | null => (typeof v === "string" ? v : null);

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

function readSplit(usage: JsonObject): TokenSplit {
  const cacheWrite = count(usage.cache_creation_input_tokens);
  const breakdown = isObject(usage.cache_creation) ? usage.cache_creation : {};
  return {
    inputTokens: count(usage.input_tokens),
    outputTokens: count(usage.output_tokens),
    cacheWriteTokens: cacheWrite,
    // The server rejects a 1h share above the cache writes it belongs to.
    cacheWrite1hTokens: Math.min(count(breakdown.ephemeral_1h_input_tokens), cacheWrite),
    cacheReadTokens: count(usage.cache_read_input_tokens),
  };
}

function addSplit(target: TokenSplit, s: TokenSplit, sign: number): void {
  target.inputTokens += sign * s.inputTokens;
  target.outputTokens += sign * s.outputTokens;
  target.cacheWriteTokens += sign * s.cacheWriteTokens;
  target.cacheWrite1hTokens += sign * s.cacheWrite1hTokens;
  target.cacheReadTokens += sign * s.cacheReadTokens;
}

function utcDate(timestamp: string | null): string | null {
  if (!timestamp) return null;
  const ms = Date.parse(timestamp);
  return Number.isFinite(ms) ? new Date(ms).toISOString().slice(0, 10) : null;
}

// Gateways reuse one placeholder id for every response; real Anthropic ids (and OpenAI
// Responses ids) are unique per response.
const isAnthropicMessageId = (id: string): boolean =>
  id.startsWith("msg_") || id.startsWith("resp_");

// ccusage drops a line whose ids, model or session are empty, or whose version is not semver.
function isValidLine(event: JsonObject, message: JsonObject): boolean {
  if (typeof event.version === "string" && !/^\d+\.\d+\.\d+/.test(event.version)) return false;
  if (message.model === null) return false;
  return [event.sessionId, event.requestId, message.id, message.model].every((v) => v !== "");
}

function readEntries(event: JsonObject, ctx: UsageContext): Entry[] {
  if (event.type !== "assistant" || !isObject(event.message)) return [];
  const message = event.message;
  if (!isObject(message.usage) || !isValidLine(event, message)) return [];
  const usage = message.usage;

  const timestamp = optionalString(event.timestamp);
  const ms = timestamp ? Date.parse(timestamp) : Number.NaN;
  const shared = {
    requestId: optionalString(event.requestId),
    sessionId: optionalString(event.sessionId) ?? ctx.sessionKey,
    timestamp,
    instant: Number.isFinite(ms) ? String(ms) : (timestamp ?? ""),
    sidechain: event.isSidechain === true,
  };
  const messageId = optionalString(message.id);
  const entries: Entry[] = [
    {
      ...shared,
      messageId,
      model: optionalString(message.model) || "unknown",
      split: readSplit(usage),
      fast: usage.speed === "fast",
      hasSpeed: usage.speed === "fast" || usage.speed === "standard",
    },
  ];

  // An advisor consultation is billed to the advisor model and is not in the top-level usage.
  const advisors = (Array.isArray(usage.iterations) ? usage.iterations : []).filter(
    (it): it is JsonObject =>
      isObject(it) &&
      it.type === "advisor_message" &&
      typeof it.model === "string" &&
      it.model !== ""
  );
  advisors.forEach((it, index) => {
    entries.push({
      ...shared,
      messageId: messageId === null ? null : `${messageId}:advisor:${index}`,
      model: it.model as string,
      split: readSplit(it),
      fast: it.speed === "fast",
      hasSpeed: it.speed === "fast" || it.speed === "standard",
    });
  });
  return entries;
}

// ccusage's should_replace_deduped_entry: a main-chain line beats a sidechain copy, then
// the larger token total wins, then a line that states its speed beats one that does not.
function shouldReplace(candidate: Entry, existing: Entry): boolean {
  if (candidate.sidechain !== existing.sidechain) return existing.sidechain;
  const a = splitTotal(candidate.split);
  const b = splitTotal(existing.split);
  if (a !== b) return a > b;
  return candidate.hasSpeed && !existing.hasSpeed;
}

function exactKey(e: Entry): string | null {
  if (e.messageId === null) return null;
  if (e.requestId !== null) return `r\u0000${e.messageId}\u0000${e.requestId}`;
  const inSession = `s\u0000${e.messageId}\u0000${e.sessionId}`;
  return isAnthropicMessageId(e.messageId) ? inSession : `${inSession}\u0000${e.instant}`;
}

const replayKey = (messageId: string, sessionId: string): string =>
  `${messageId}\u0000${sessionId}`;

export function createUsageAccumulator(options: { cutoff?: string | null } = {}): UsageAccumulator {
  const cutoff = options.cutoff ?? null;
  const total = emptyBucket();
  const daily = new Map<string, UsageBucket>();
  const projects = new Map<string, UsageBucket>();
  let firstTimestamp: string | null = null;
  let lastTimestamp: string | null = null;

  const byKey = new Map<string, Counted>();
  // /btw sidechains replay parent messages under new request ids: index every response by
  // (message, session), and sidechain responses once more for parent candidates.
  const replayAny = new Map<string, Counted[]>();
  const replaySidechain = new Map<string, Counted[]>();

  const push = (index: Map<string, Counted[]>, key: string, c: Counted): void => {
    const list = index.get(key);
    if (!list) index.set(key, [c]);
    else if (!list.includes(c)) list.push(c);
  };

  const bucket = (map: Map<string, UsageBucket>, key: string): UsageBucket => {
    let b = map.get(key);
    if (!b) {
      b = emptyBucket();
      map.set(key, b);
    }
    return b;
  };

  const place = (c: Counted, e: Entry, sign: 1 | -1): void => {
    const targets = [total, bucket(projects, c.project)];
    if (c.date) targets.push(bucket(daily, c.date));
    const tokens = splitTotal(e.split);
    for (const b of targets) {
      addSplit(b, e.split, sign);
      b.tokens += sign * tokens;
      b.models[c.model] = (b.models[c.model] ?? 0) + sign * tokens;
      const m = (b.modelTokens[c.model] ??= { ...emptySplit(), fast: emptySplit() });
      addSplit(m, e.split, sign);
      if (e.fast) addSplit(m.fast, e.split, sign);
      if (sign > 0) b.sessions.add(c.session);
    }
  };

  const findReplay = (e: Entry): Counted | undefined => {
    if (e.messageId === null) return undefined;
    const index = e.sidechain ? replayAny : replaySidechain;
    return index.get(replayKey(e.messageId, e.sessionId))?.find((c) => {
      const requestless = e.requestId === null && c.entry.requestId === null;
      return (requestless || c.entry.instant === e.instant) && (e.sidechain || c.entry.sidechain);
    });
  };

  const consider = (e: Entry, ctx: UsageContext): boolean => {
    const key = exactKey(e);
    const existing = (key ? byKey.get(key) : undefined) ?? findReplay(e);

    if (existing) {
      const previous = existing.entry;
      if (e.messageId !== null && previous.sessionId !== e.sessionId) {
        // A cross-session copy can become the survivor: keep both sessions' replay routes.
        for (const sessionId of [e.sessionId, previous.sessionId]) {
          push(replayAny, replayKey(e.messageId, sessionId), existing);
          push(replaySidechain, replayKey(e.messageId, sessionId), existing);
        }
      }
      if (existing.excluded || !shouldReplace(e, previous)) return false;
      place(existing, previous, -1);
      existing.entry = e;
      place(existing, e, 1);
      if (key && byKey.get(key) !== existing) byKey.set(key, existing);
      if (e.messageId !== null) {
        push(replayAny, replayKey(e.messageId, e.sessionId), existing);
        if (e.sidechain) push(replaySidechain, replayKey(e.messageId, e.sessionId), existing);
      }
      return true;
    }

    const c: Counted = {
      entry: e,
      model: e.model,
      date: utcDate(e.timestamp),
      project: ctx.projectName,
      session: ctx.sessionKey,
      excluded: Boolean(cutoff && e.timestamp && e.timestamp < cutoff),
    };
    if (key) byKey.set(key, c);
    if (e.messageId !== null) {
      push(replayAny, replayKey(e.messageId, e.sessionId), c);
      if (e.sidechain) push(replaySidechain, replayKey(e.messageId, e.sessionId), c);
    }
    if (c.excluded) return false;

    place(c, e, 1);
    if (e.timestamp && c.date) {
      if (!firstTimestamp || e.timestamp < firstTimestamp) firstTimestamp = e.timestamp;
      if (!lastTimestamp || e.timestamp > lastTimestamp) lastTimestamp = e.timestamp;
    }
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
