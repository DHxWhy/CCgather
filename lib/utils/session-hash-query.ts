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

export async function fetchSessionHashRows(
  supabase: SupabaseClient,
  hashes: string[]
): Promise<SessionHashRow[]> {
  const batches = chunk(hashes, CHUNK_SIZE);
  const rows: SessionHashRow[] = [];

  for (const wave of chunk(batches, MAX_CONCURRENT)) {
    const settled = await Promise.all(
      wave.map(
        (batch) =>
          supabase
            .from("submitted_sessions")
            .select("session_hash, user_id, device_id")
            .in("session_hash", batch) as PromiseLike<{
            data: SessionHashRow[] | null;
            error: { message: string } | null;
          }>
      )
    );

    for (const { data, error } of settled) {
      if (error) {
        throw new Error(`session hash lookup failed: ${error.message}`);
      }
      if (data) rows.push(...data);
    }
  }

  return rows;
}
