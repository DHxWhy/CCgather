import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  SHARED_SESSION_HASHES,
  describeDuplicateRefusal,
  dropSharedSessionHashes,
} from "@/lib/utils/shared-session-hashes";

// The published session hash is sha256 of `<file name>:<first 50 lines joined by "\n">`. A file
// that ends in a newline has an empty last line, so this journal's hash input ends in "\n".
const LAUNCHED_ONLY_JOURNAL = "58912a10ec106bc20dc49fa698646d88c7d619f9cc1a0b342155c019957226ae";
const LAUNCHED_NO_NEWLINE = "5eb828bc2c41c792c237b290cfcd34cd279d95dcf5ba20749a1804d5954a25a8";
const EMPTY_JOURNAL = "1e2503a6789fa5bb1bc98ea107df34301052b00e21d3c07be1c1fa8eba273c6e";

const sha256 = (input: string) => createHash("sha256").update(input).digest("hex");
const A = "a".repeat(64);
const B = "0123456789abcdef".repeat(4);

describe("shared session hashes", () => {
  it("holds the hash of a journal whose only line is its launched record", () => {
    expect(sha256('journal.jsonl:{"type":"launched"}\n')).toBe(LAUNCHED_ONLY_JOURNAL);
    expect(SHARED_SESSION_HASHES.has(LAUNCHED_ONLY_JOURNAL)).toBe(true);
  });

  it("drops a shared hash and keeps the others in order", () => {
    expect(dropSharedSessionHashes([A, LAUNCHED_ONLY_JOURNAL, B])).toEqual([A, B]);
  });

  it("drops the same journal written without a final newline", () => {
    expect(sha256('journal.jsonl:{"type":"launched"}')).toBe(LAUNCHED_NO_NEWLINE);
    expect(dropSharedSessionHashes([A, LAUNCHED_NO_NEWLINE])).toEqual([A]);
  });

  it("drops an empty journal", () => {
    expect(sha256("journal.jsonl:")).toBe(EMPTY_JOURNAL);
    expect(dropSharedSessionHashes([EMPTY_JOURNAL, A])).toEqual([A]);
  });

  it("reads anything but a list of strings as no hashes", () => {
    expect(dropSharedSessionHashes(undefined)).toEqual([]);
    expect(dropSharedSessionHashes(A)).toEqual([]);
    expect(dropSharedSessionHashes([1, null, A])).toEqual([A]);
  });

  it("keeps one of each hash, in the order first seen", () => {
    expect(dropSharedSessionHashes([A, B, A, A, B])).toEqual([A, B]);
  });

  it("keeps only strings shaped like a sha256 hex digest", () => {
    expect(
      dropSharedSessionHashes([
        A,
        A.toUpperCase(),
        "a".repeat(63),
        "a".repeat(65),
        "g".repeat(64),
        `${"a".repeat(63)}\n`,
        `${A}\n`,
        "x".repeat(60000),
        "",
        B,
      ])
    ).toEqual([A, B]);
  });
});

describe("describeDuplicateRefusal", () => {
  const held = (session_hash: string, user_id: string) => ({ session_hash, user_id });
  const heldBy = (user_id: string, count: number) =>
    Array.from({ length: count }, (_, i) => held(`${user_id}-${i}`, user_id));

  it("suspects a shared file when one hash out of thousands belongs to someone else", () => {
    expect(describeDuplicateRefusal([held("a1", "u2")], 6185)).toEqual({
      conflicting: 1,
      submitted: 6185,
      owners: 1,
      sharedFileSuspected: true,
      hashes: ["a1"],
    });
  });

  it("counts each account that holds a conflicting hash once", () => {
    const refusal = describeDuplicateRefusal(
      [held("a1", "u2"), held("b2", "u2"), held("c3", "u3")],
      40
    );
    expect(refusal.conflicting).toBe(3);
    expect(refusal.owners).toBe(2);
  });

  it("still suspects a shared file at 5 conflicting hashes", () => {
    const refusal = describeDuplicateRefusal(heldBy("u2", 5), 900);
    expect(refusal.sharedFileSuspected).toBe(true);
    expect(refusal.hashes).toEqual(["u2-0", "u2-1", "u2-2", "u2-3", "u2-4"]);
  });

  it("reads 6 conflicting hashes as copied data and lists none", () => {
    expect(describeDuplicateRefusal(heldBy("u2", 6), 900)).toEqual({
      conflicting: 6,
      submitted: 900,
      owners: 1,
      sharedFileSuspected: false,
      hashes: [],
    });
  });
});

describe("submit route", () => {
  const ROUTE = readFileSync(path.resolve(__dirname, "../../app/api/cli/submit/route.ts"), "utf-8");

  it("checks and stores only the hashes that are not shared", () => {
    expect(ROUTE).toContain(
      "const sessionHashes = dropSharedSessionHashes(body.sessionFingerprint?.sessionHashes);"
    );
    // Any other read of the payload's list would skip the filter
    expect(ROUTE.match(/sessionFingerprint\??\.sessionHashes|\{ sessionHashes \} =/g)).toHaveLength(
      1
    );
    expect(ROUTE).toContain("const hasFingerprint = sessionHashes.length > 0;");
    expect(ROUTE).toContain("fetchSessionHashRows(supabase, sessionHashes)");
    expect(ROUTE).toContain("hashes: sessionHashes,");
  });
});
