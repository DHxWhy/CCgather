import type { SupabaseClient } from "@supabase/supabase-js";
import { alertOpsOncePerUser } from "@/lib/services/ops-alert";

/**
 * The hourly submit limit, counted from one submit_events row per request.
 *
 * It used to count the distinct usage_stats.submitted_at values of the last hour. Rows were
 * stamped one by one, so a single submit looked like several and the next one was refused for an
 * hour (56 of the 63 latest submits measured on 2026-11-18). Stamping a request once does not fix
 * it either: the next submit rewrites the same rows, so the count never passes 1. And a request
 * that ended in a refusal or an error wrote no row at all, so it could repeat the session-hash
 * lookup and store as often as it liked.
 */
const WINDOW_MS = 60 * 60 * 1000;
export const MAX_ACCEPTED_PER_HOUR = 2;
/** Requests let past the limit, whatever became of them */
const MAX_ATTEMPTS = 10;
const READ_LIMIT = 200;

export type SubmitEventOutcome = "attempt" | "accepted" | "duplicate_session";

export interface SubmitEvent {
  outcome: string;
  created_at: string;
}

export type SubmitLimitVerdict =
  | { allowed: true }
  | { allowed: false; reason: "accepted" | "attempts"; retryAfterMinutes: number };

export function judgeSubmitLimit(events: SubmitEvent[], nowMs: number): SubmitLimitVerdict {
  const newestFirst = (outcome: SubmitEventOutcome): number[] =>
    events
      .filter((event) => event.outcome === outcome)
      .map((event) => Date.parse(event.created_at))
      .filter((time) => nowMs - time < WINDOW_MS)
      .sort((a, b) => b - a);
  const refused = (
    reason: "accepted" | "attempts",
    times: number[],
    max: number
  ): SubmitLimitVerdict | null => {
    const lastCounted = times[max - 1];
    if (lastCounted === undefined) return null;
    const waitMs = lastCounted + WINDOW_MS - nowMs;
    return { allowed: false, reason, retryAfterMinutes: Math.max(1, Math.ceil(waitMs / 60_000)) };
  };

  return (
    refused("accepted", newestFirst("accepted"), MAX_ACCEPTED_PER_HOUR) ??
    refused("attempts", newestFirst("attempt"), MAX_ATTEMPTS) ?? { allowed: true }
  );
}

interface StoredSubmitEvent extends SubmitEvent {
  id: number;
}

export interface Submitter {
  id: string;
  username: string;
}

// What stops the limit — a missing table, a stale schema cache, a lost privilege — stops it for
// every account at once, so the alert is held under one key, not one per submitter. Under one key
// a single passing error would also keep a real outage quiet for as long as the push is held, so
// it is held for an hour, not the usual 20: while the limit stays off, ops hears of it every hour.
const EVERY_ACCOUNT = "every-account";
const UNAVAILABLE_ALERT_EVERY_MS = 60 * 60 * 1000;

/**
 * The limit could not be read or recorded, so this request went on without it. Nothing else would
 * show that: a missing table, a stale schema cache or a lost privilege all look like a quiet day.
 */
async function limitNotApplied(
  supabase: SupabaseClient,
  submitter: Submitter,
  step: string,
  reason: string
): Promise<void> {
  console.error(`[CLI Submit] submit limit not applied (${step}):`, reason);
  await alertOpsOncePerUser(supabase, {
    type: "submit_limit_unavailable",
    userId: EVERY_ACCOUNT,
    title: "Submit limit not applied",
    message: `제출 횟수 제한을 적용하지 못함 (${step}) — 처음 걸린 계정 @${submitter.username}`,
    detail: { username: submitter.username, step, reason },
    windowMs: UNAVAILABLE_ALERT_EVERY_MS,
  });
}

type Read = { rows: StoredSubmitEvent[] } | { failed: string };

/**
 * The newest READ_LIMIT rows of the hour, or of the part of it written before `beforeId`.
 * Cutting the read there cannot hide a refusal: only a request that was let through writes a
 * second row, so a full page is almost all attempts and already far past the limit. The cut must
 * fall on the database's side of `beforeId`, though — after a burst larger than the page, the
 * newest rows are all ones written after this request.
 *
 * Newest by created_at, the column the index holds after user_id. A read filtered by user and
 * ordered by the primary key is one the planner may answer by walking the whole key: that read
 * on submitted_sessions ran into the statement timeout (2026-11-18).
 */
async function readLastHour(
  supabase: SupabaseClient,
  userId: string,
  nowMs: number,
  beforeId?: number
): Promise<Read> {
  const lastHour = supabase
    .from("submit_events")
    .select("id, outcome, created_at")
    .eq("user_id", userId)
    .gte("created_at", new Date(nowMs - WINDOW_MS).toISOString());
  const { data, error } = await (beforeId === undefined ? lastHour : lastHour.lt("id", beforeId))
    .order("created_at", { ascending: false })
    .limit(READ_LIMIT);
  return error ? { failed: error.message } : { rows: (data ?? []) as StoredSubmitEvent[] };
}

export interface SubmitEventRecord {
  outcome: SubmitEventOutcome;
  deviceId?: string;
  cliVersion?: string;
  source?: string;
  detail?: Record<string, unknown>;
}

type Insert = { id: number } | { failed: string };

async function insertEvent(
  supabase: SupabaseClient,
  userId: string,
  record: SubmitEventRecord
): Promise<Insert> {
  const { data, error } = await supabase
    .from("submit_events")
    .insert({
      user_id: userId,
      outcome: record.outcome,
      device_id: record.deviceId ?? null,
      cli_version: record.cliVersion ?? null,
      submission_source: record.source ?? null,
      detail: record.detail ?? {},
    })
    .select("id")
    .single();
  if (error || !data) return { failed: error?.message ?? "no row returned" };
  return { id: (data as { id: number }).id };
}

const message = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/**
 * Judges the limit and, for a request that may go on, writes its attempt row.
 *
 * A request refused on the first read writes nothing, so repeating it costs one read. Requests
 * that arrive together all read the same hour and would all pass, so the request is judged again
 * once its row is in, on the rows with a smaller id. That narrows the gap without closing it: a row
 * that took its id earlier but is committed later is not seen, so a burst can pass a few more than
 * the attempt limit. A request refused at that second look keeps its attempt row, which counts
 * like any other. The accepted limit is exact for submits that follow one another; a burst is held
 * by the attempt limit.
 *
 * Never refuses on its own failure: a limit that cannot be read or recorded is not applied, and
 * ops is told.
 */
export async function admitSubmit(
  supabase: SupabaseClient,
  submitter: Submitter
): Promise<SubmitLimitVerdict> {
  const nowMs = Date.now();
  try {
    const before = await readLastHour(supabase, submitter.id, nowMs);
    if ("failed" in before) {
      await limitNotApplied(supabase, submitter, "read", before.failed);
      return { allowed: true };
    }
    const verdict = judgeSubmitLimit(before.rows, nowMs);
    if (!verdict.allowed) return verdict;

    const attempt = await insertEvent(supabase, submitter.id, { outcome: "attempt" });
    if ("failed" in attempt) {
      await limitNotApplied(supabase, submitter, "attempt record", attempt.failed);
      return { allowed: true };
    }

    const cameFirst = await readLastHour(supabase, submitter.id, nowMs, attempt.id);
    if ("failed" in cameFirst) {
      await limitNotApplied(supabase, submitter, "second read", cameFirst.failed);
      return { allowed: true };
    }
    return judgeSubmitLimit(cameFirst.rows, nowMs);
  } catch (error) {
    await limitNotApplied(supabase, submitter, "check", message(error));
    return { allowed: true };
  }
}

/**
 * Never throws: the submit does not depend on the record. A record that could not be written is
 * a submit the limit will not count, so ops is told.
 */
export async function recordSubmitEvent(
  supabase: SupabaseClient,
  submitter: Submitter,
  record: SubmitEventRecord
): Promise<void> {
  const step = `${record.outcome} record`;
  try {
    const written = await insertEvent(supabase, submitter.id, record);
    if ("failed" in written) await limitNotApplied(supabase, submitter, step, written.failed);
  } catch (error) {
    await limitNotApplied(supabase, submitter, step, message(error));
  }
}
