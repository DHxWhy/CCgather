import type { SupabaseClient } from "@supabase/supabase-js";

// PostgREST puts `.in()` values in the GET query string. At ~64 chars per hash the
// URL blows past the server limit around 390 hashes and the request 414s — silently,
// if the caller ignores `error`. Heavy users send tens of thousands of hashes, so the
// lookup must be chunked, run with bounded concurrency, and fail loudly.
const CHUNK_SIZE = 250;
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
export const STORE_CHUNK_SIZE = 500;
const STORE_MAX_CONCURRENT = 10;
const STORE_RETRIES = 2;

export interface StoreSessionHashesInput {
  /** 페이로드의 해시 전부 (중복 허용) */
  hashes: string[];
  /** 조회에서 이미 장부에 있다고 확인된 해시 */
  knownHashes: Iterable<string>;
  userId: string;
  deviceId: string | null;
}

export interface StoreSessionHashesResult {
  /** 실제로 보낸 새 해시 수 */
  attempted: number;
  chunks: number;
  failedChunks: number;
  lastError: string | null;
}

interface SessionHashInsert {
  session_hash: string;
  user_id: string;
  device_id: string | null;
}

async function upsertChunk(
  supabase: SupabaseClient,
  batch: SessionHashInsert[]
): Promise<string | null> {
  let lastError = "";
  for (let attempt = 0; attempt <= STORE_RETRIES; attempt++) {
    const { error } = await supabase
      .from("submitted_sessions")
      .upsert(batch, { onConflict: "session_hash", ignoreDuplicates: true });
    if (!error) return null;
    lastError = error.message;
    if (attempt < STORE_RETRIES) {
      await new Promise((r) => setTimeout(r, 150 * (attempt + 1)));
    }
  }
  return lastError;
}

export async function storeSessionHashes(
  supabase: SupabaseClient,
  input: StoreSessionHashesInput
): Promise<StoreSessionHashesResult> {
  const known = input.knownHashes instanceof Set ? input.knownHashes : new Set(input.knownHashes);
  const fresh = [...new Set(input.hashes)].filter((hash) => !known.has(hash));
  if (fresh.length === 0) {
    return { attempted: 0, chunks: 0, failedChunks: 0, lastError: null };
  }

  const records: SessionHashInsert[] = fresh.map((session_hash) => ({
    session_hash,
    user_id: input.userId,
    device_id: input.deviceId,
  }));
  const batches = chunk(records, STORE_CHUNK_SIZE);
  let failedChunks = 0;
  let lastError: string | null = null;

  for (const wave of chunk(batches, STORE_MAX_CONCURRENT)) {
    const outcomes = await Promise.all(wave.map((batch) => upsertChunk(supabase, batch)));
    for (const outcome of outcomes) {
      if (outcome !== null) {
        failedChunks++;
        lastError = outcome;
      }
    }
  }

  return { attempted: fresh.length, chunks: batches.length, failedChunks, lastError };
}
