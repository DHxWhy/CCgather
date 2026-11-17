/**
 * Session hashes that are the same on every machine, so they prove nothing about whose data a
 * submit holds.
 *
 * CLI 2.3.3 and earlier put every transcript file in the fingerprint, including a workflow
 * journal that names no session and holds no usage. A run that stopped right after launch leaves
 * a journal holding only `{"type":"launched"}`, and its hash — sha256 of `journal.jsonl:` and the
 * file's lines — is identical everywhere. The first account to submit it held it, and every later
 * account that sent it was refused as a duplicate (issue #41). Newer CLIs leave such files out;
 * older ones keep sending the hash, so the server drops it before the ownership check and never
 * stores it.
 */
export const SHARED_SESSION_HASHES: ReadonlySet<string> = new Set([
  // journal.jsonl holding {"type":"launched"} and its final newline
  "58912a10ec106bc20dc49fa698646d88c7d619f9cc1a0b342155c019957226ae",
]);

/** The payload's session hashes without the shared ones; anything but a list of strings is none. */
export function dropSharedSessionHashes(hashes: unknown): string[] {
  if (!Array.isArray(hashes)) return [];
  return hashes.filter(
    (hash): hash is string => typeof hash === "string" && !SHARED_SESSION_HASHES.has(hash)
  );
}
