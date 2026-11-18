import type { SupabaseClient } from "@supabase/supabase-js";

// PostgREST puts `.in()` values in the GET query string. At ~64 chars per hash the
// URL blows past the server limit around 390 hashes and the request 414s — silently,
// if the caller ignores `error`. Heavy users send tens of thousands of hashes, so the
// lookup must be chunked, run with bounded concurrency, and fail loudly.
//
// A statement takes time in proportion to the hashes it names — about 1.5 ms each on a
// quiet database (measured 2026-11-18), several times that on a busy one — and the API role
// cancels it after about 8 s. That day a submit of some 15,000 hashes had spent roughly 26 s
// by the time its store began (worked back from the stored rows' timestamps) — three waves at
// 250, so statements were running into the limit. 100 keeps each one well under it. The
// concurrency is the lookup's throughput and stays.
const CHUNK_SIZE = 100;
const MAX_CONCURRENT = 25;

export interface SessionHashRow {
  session_hash: string;
  user_id: string;
  device_id: string | null;
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

// A heavy user issues ~100 chunks; without a retry, one transient blip in any
// single chunk would fail the whole submit. Retry each chunk before giving up.
const CHUNK_RETRIES = 2;

async function queryChunk(supabase: SupabaseClient, batch: string[]): Promise<SessionHashRow[]> {
  let lastError = "";
  for (let attempt = 0; attempt <= CHUNK_RETRIES; attempt++) {
    const { data, error } = (await supabase
      .from("submitted_sessions")
      .select("session_hash, user_id, device_id")
      .in("session_hash", batch)) as {
      data: SessionHashRow[] | null;
      error: { message: string } | null;
    };
    if (!error) return data ?? [];
    lastError = error.message;
    if (attempt < CHUNK_RETRIES) {
      await new Promise((r) => setTimeout(r, 150 * (attempt + 1)));
    }
  }
  throw new Error(`session hash lookup failed: ${lastError}`);
}

export async function fetchSessionHashRows(
  supabase: SupabaseClient,
  hashes: string[]
): Promise<SessionHashRow[]> {
  const batches = chunk(hashes, CHUNK_SIZE);
  const rows: SessionHashRow[] = [];

  for (const wave of chunk(batches, MAX_CONCURRENT)) {
    const settled = await Promise.all(wave.map((batch) => queryChunk(supabase, batch)));
    for (const data of settled) rows.push(...data);
  }

  return rows;
}

// ---------------------------------------------------------------------------
// 저장 — 조회가 끝난 뒤 새 해시만 장부에 적는다.
//
// 옛 코드는 페이로드의 해시 전부(수만 개)를 한 번의 upsert 로 보냈다. 매일 재제출하는
// 사용자는 거의 전부 이미 있는 해시라 결과는 DO NOTHING 인데도 행마다 유니크 인덱스를
// 탐침하느라 statement timeout(57014)이 났고, 실패는 console.error 로만 남아 1 Project
// 1 Person 가드에 조용한 구멍이 생겼다(2026-10-17 하루 4회). 조회로 이미 아는 해시를 빼면
// 일일 제출은 그날 새 세션 수십 개로 줄고, 첫 제출의 대량 해시는 조각·재시도로 넘긴다.
//
// 2026-11-18: 한 행을 적는 데 평소 4~9ms, DB 가 바쁠 때는 16ms 넘게 걸려 500행 upsert 가 API
// 역할의 statement timeout(8초)을 넘겼고, 같은 크기로 다시 보낸 재시도도 함께 넘겼다(14조각 중
// 8조각 실패). upsert 하나에 걸리는 시간은 행 수에 비례하므로 100행으로 줄이고, 실패한 조각은
// 반으로 나눠 다시 보낸다. 동시 실행 수는 처리량이라 그대로 둔다.
const STORE_CHUNK_SIZE = 100;
// 이 크기부터는 더 쪼개지 않고 같은 조각을 다시 보낸다
const STORE_MIN_CHUNK_SIZE = 25;
const STORE_MAX_CONCURRENT = 10;
const STORE_RETRIES = 2;
const STORE_RETRY_DELAY_MS = 150;
// 저장은 요청이 시작된 지 이만큼 될 때까지만 새 upsert 를 보낸다. 자동 제출 CLI 는 응답을
// 120초 기다리고 끊으므로(packages/cli/src/commands/submit.ts 의 NON_INTERACTIVE_TIMEOUT_MS),
// 돌고 있던 upsert 와 그 뒤 단계까지 그 안에 끝나도록 남긴 몫이다. 조회가 오래 걸린 요청은
// 그만큼 저장에 쓸 시간이 준다. 남은 해시는 보내지 않는다 — 장부에 없으니 다음 제출의
// 조회에서 다시 새 해시로 잡혀 그때 적힌다. 2026-11-18 에 첫 제출 지문 29,627개를 적는 데
// 27.6초가 걸렸다.
const STORE_UNTIL_MS_AFTER_REQUEST_START = 85_000;

export function hashStoreDeadline(requestStartedAt: number): number {
  return requestStartedAt + STORE_UNTIL_MS_AFTER_REQUEST_START;
}

export interface StoreSessionHashesInput {
  /** 페이로드의 해시 전부 (중복 허용) */
  hashes: string[];
  /** 조회에서 이미 장부에 있다고 확인된 해시 */
  knownHashes: Iterable<string>;
  userId: string;
  deviceId: string | null;
  /** 이 시각(epoch ms)부터는 새 upsert 를 시작하지 않는다 — hashStoreDeadline */
  deadline: number;
}

export interface StoreSessionHashesResult {
  /** 이번 제출이 새로 적어야 했던 해시 수 (stored + failed + deferred) */
  attempted: number;
  stored: number;
  /** 가장 작은 조각으로 다시 보내도 적지 못한 수 */
  failed: number;
  /** 마감 시각이 지나 보내지 않은 수 */
  deferred: number;
  /** 보낸 upsert 수 */
  statements: number;
  lastError: string | null;
}

interface SessionHashInsert {
  session_hash: string;
  user_id: string;
  device_id: string | null;
}

export interface StoreAlert {
  type: "session_hash_store_failed" | "session_hash_store_out_of_time";
  title: string;
}

/** 운영 알림의 종류와 제목. 새 해시를 전부 적었으면 알릴 것이 없어 null */
export function storeAlert(result: StoreSessionHashesResult): StoreAlert | null {
  if (result.failed > 0) {
    return { type: "session_hash_store_failed", title: "Session hash store failed" };
  }
  if (result.deferred > 0) {
    return { type: "session_hash_store_out_of_time", title: "Session hash store ran out of time" };
  }
  return null;
}

interface StoreJob {
  rows: SessionHashInsert[];
  retriesLeft: number;
}

async function upsertRows(
  supabase: SupabaseClient,
  rows: SessionHashInsert[]
): Promise<string | null> {
  const { error } = await supabase
    .from("submitted_sessions")
    .upsert(rows, { onConflict: "session_hash", ignoreDuplicates: true });
  return error ? error.message : null;
}

export async function storeSessionHashes(
  supabase: SupabaseClient,
  input: StoreSessionHashesInput
): Promise<StoreSessionHashesResult> {
  const known = input.knownHashes instanceof Set ? input.knownHashes : new Set(input.knownHashes);
  const fresh = [...new Set(input.hashes)].filter((hash) => !known.has(hash));
  const result: StoreSessionHashesResult = {
    attempted: fresh.length,
    stored: 0,
    failed: 0,
    deferred: 0,
    statements: 0,
    lastError: null,
  };
  if (fresh.length === 0) return result;

  const records: SessionHashInsert[] = fresh.map((session_hash) => ({
    session_hash,
    user_id: input.userId,
    device_id: input.deviceId,
  }));
  const queue: StoreJob[] = chunk(records, STORE_CHUNK_SIZE).map((rows) => ({
    rows,
    retriesLeft: STORE_RETRIES,
  }));
  const worker = async (): Promise<void> => {
    for (let job = queue.shift(); job; job = queue.shift()) {
      if (Date.now() >= input.deadline) {
        result.deferred += job.rows.length;
        continue;
      }
      result.statements++;
      const error = await upsertRows(supabase, job.rows);
      if (error === null) {
        result.stored += job.rows.length;
        continue;
      }
      result.lastError = error;
      if (job.rows.length > STORE_MIN_CHUNK_SIZE) {
        const half = Math.ceil(job.rows.length / 2);
        queue.unshift(
          { rows: job.rows.slice(0, half), retriesLeft: STORE_RETRIES },
          { rows: job.rows.slice(half), retriesLeft: STORE_RETRIES }
        );
      } else if (job.retriesLeft > 0) {
        queue.unshift({ rows: job.rows, retriesLeft: job.retriesLeft - 1 });
      } else {
        result.failed += job.rows.length;
      }
      await new Promise((resolve) => setTimeout(resolve, STORE_RETRY_DELAY_MS));
    }
  };

  await Promise.all(Array.from({ length: Math.min(STORE_MAX_CONCURRENT, queue.length) }, worker));
  return result;
}
