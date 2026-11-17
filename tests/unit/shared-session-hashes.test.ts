import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SHARED_SESSION_HASHES, dropSharedSessionHashes } from "@/lib/utils/shared-session-hashes";

// The published session hash is sha256 of `<file name>:<first 50 lines joined by "\n">`. A file
// that ends in a newline has an empty last line, so this journal's hash input ends in "\n".
const LAUNCHED_ONLY_JOURNAL = "58912a10ec106bc20dc49fa698646d88c7d619f9cc1a0b342155c019957226ae";

describe("shared session hashes", () => {
  it("holds the hash of a journal whose only line is its launched record", () => {
    const input = 'journal.jsonl:{"type":"launched"}\n';
    expect(createHash("sha256").update(input).digest("hex")).toBe(LAUNCHED_ONLY_JOURNAL);
    expect(SHARED_SESSION_HASHES.has(LAUNCHED_ONLY_JOURNAL)).toBe(true);
  });

  it("drops a shared hash and keeps the others in order", () => {
    expect(dropSharedSessionHashes(["a1", LAUNCHED_ONLY_JOURNAL, "b2"])).toEqual(["a1", "b2"]);
  });

  it("reads anything but a list of strings as no hashes", () => {
    expect(dropSharedSessionHashes(undefined)).toEqual([]);
    expect(dropSharedSessionHashes("a1b2")).toEqual([]);
    expect(dropSharedSessionHashes([1, null, "a1"])).toEqual(["a1"]);
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
