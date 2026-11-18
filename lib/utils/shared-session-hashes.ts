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
 *
 * Only the first shape has been seen. The other two are the same journal caught earlier in its
 * first write — the line without its newline, and the empty file — listed before any account
 * holds them so that nobody is refused first.
 */
export const SHARED_SESSION_HASHES: ReadonlySet<string> = new Set([
  // journal.jsonl holding {"type":"launched"} and its final newline
  "58912a10ec106bc20dc49fa698646d88c7d619f9cc1a0b342155c019957226ae",
  // the same line with no final newline
  "5eb828bc2c41c792c237b290cfcd34cd279d95dcf5ba20749a1804d5954a25a8",
  // an empty journal.jsonl
  "1e2503a6789fa5bb1bc98ea107df34301052b00e21d3c07be1c1fa8eba273c6e",
]);

const SHA256_HEX = /^[0-9a-f]{64}$/;

/**
 * The payload's session hashes without the shared ones. Only a sha256 hex digest counts: that is
 * what every CLI sends (all 616,164 hashes in the ledger on 2026-11-18 have this shape), and the
 * list goes into the ownership lookup's URL, where one string of tens of thousands of characters
 * makes the request fail and the whole submit with it.
 *
 * Each hash is kept once. The CLI sends one per file, so files with the same name and content
 * repeat theirs — and a repeat that lands in another lookup batch comes back as another row,
 * which made one conflicting file count as several.
 */
export function dropSharedSessionHashes(hashes: unknown): string[] {
  if (!Array.isArray(hashes)) return [];
  const kept = new Set<string>();
  for (const hash of hashes) {
    if (typeof hash === "string" && SHA256_HEX.test(hash) && !SHARED_SESSION_HASHES.has(hash)) {
      kept.add(hash);
    }
  }
  return [...kept];
}

/**
 * A refusal over this few hashes looks like a file every machine shares, not copied data: issue
 * #41 was 1 hash out of 6,185, while a copied project conflicts on every session it holds.
 */
const SHARED_FILE_SUSPECT_MAX_CONFLICTS = 5;

export interface DuplicateRefusal {
  conflicting: number;
  submitted: number;
  /** Other accounts that hold at least one of the conflicting hashes */
  owners: number;
  sharedFileSuspected: boolean;
  /** The conflicting hashes when a shared file is suspected: the candidates for the list above */
  hashes: string[];
}

export function describeDuplicateRefusal(
  foreign: ReadonlyArray<{ session_hash: string; user_id: string }>,
  submitted: number
): DuplicateRefusal {
  const sharedFileSuspected = foreign.length <= SHARED_FILE_SUSPECT_MAX_CONFLICTS;
  return {
    conflicting: foreign.length,
    submitted,
    owners: new Set(foreign.map((row) => row.user_id)).size,
    sharedFileSuspected,
    hashes: sharedFileSuspected ? foreign.map((row) => row.session_hash) : [],
  };
}
