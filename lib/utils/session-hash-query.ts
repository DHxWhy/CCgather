import type { SupabaseClient } from "@supabase/supabase-js";

// PostgREST puts `.in()` values in the GET query string. At ~64 chars per hash the
// URL exceeds the server limit around 390 hashes and the request 400s — silently,
// if the caller ignores `error`. Heavy users send tens of thousands of hashes, so
// every lookup must be chunked, run with bounded concurrency, and fail loudly.
const CHUNK_SIZE = 200;
const MAX_CONCURRENT = 10;

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

async function runChunked<T>(
  hashes: string[],
  query: (batch: string[]) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  label: string
): Promise<T[]> {
  const batches = chunk(hashes, CHUNK_SIZE);
  const results: T[] = [];

  for (const group of chunk(batches, MAX_CONCURRENT)) {
    const settled = await Promise.all(group.map((batch) => query(batch)));
    for (const { data, error } of settled) {
      if (error) {
        throw new Error(`${label} failed: ${error.message}`);
      }
      if (data) results.push(...data);
    }
  }

  return results;
}

export interface OwnedHashRow {
  session_hash: string;
  user_id: string;
}

export function fetchHashOwners(
  supabase: SupabaseClient,
  hashes: string[]
): Promise<OwnedHashRow[]> {
  return runChunked<OwnedHashRow>(
    hashes,
    (batch) =>
      supabase
        .from("submitted_sessions")
        .select("session_hash, user_id")
        .in("session_hash", batch) as PromiseLike<{
        data: OwnedHashRow[] | null;
        error: { message: string } | null;
      }>,
    "session hash owner lookup"
  );
}

export interface StaleDeviceRow {
  session_hash: string;
  device_id: string | null;
}

export function fetchStaleDeviceRows(
  supabase: SupabaseClient,
  userId: string,
  hashes: string[],
  currentDeviceId: string
): Promise<StaleDeviceRow[]> {
  return runChunked<StaleDeviceRow>(
    hashes,
    (batch) =>
      supabase
        .from("submitted_sessions")
        .select("session_hash, device_id")
        .eq("user_id", userId)
        .in("session_hash", batch)
        .not("device_id", "is", null)
        .neq("device_id", currentDeviceId) as PromiseLike<{
        data: StaleDeviceRow[] | null;
        error: { message: string } | null;
      }>,
    "stale device lookup"
  );
}
