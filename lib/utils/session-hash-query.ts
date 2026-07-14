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
