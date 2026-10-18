import { afterEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { STORE_CHUNK_SIZE, storeSessionHashes } from "@/lib/utils/session-hash-query";

type UpsertCall = {
  rows: { session_hash: string; user_id: string; device_id: string | null }[];
  opts: unknown;
};

// 해시 저장 전용 대역: upsert 호출을 기록하고, 지정한 횟수만큼 먼저 실패시킬 수 있다.
function fakeClient(failFirst = 0, failMessage = "canceling statement due to statement timeout") {
  const calls: UpsertCall[] = [];
  let remainingFailures = failFirst;
  const upsert = vi.fn(async (rows: UpsertCall["rows"], opts: unknown) => {
    calls.push({ rows, opts });
    if (remainingFailures > 0) {
      remainingFailures--;
      return { error: { code: "57014", message: failMessage } };
    }
    return { error: null };
  });
  const from = vi.fn((table: string) => {
    expect(table).toBe("submitted_sessions");
    return { upsert };
  });
  return { client: { from } as unknown as SupabaseClient, calls, upsert };
}

const hashes = (n: number, prefix = "h") => Array.from({ length: n }, (_, i) => `${prefix}${i}`);

afterEach(() => {
  vi.restoreAllMocks();
});

describe("storeSessionHashes", () => {
  it("이미 장부에 있는 해시와 페이로드 내 중복은 보내지 않는다", async () => {
    const { client, calls } = fakeClient();

    const result = await storeSessionHashes(client, {
      hashes: ["a", "b", "c", "b"],
      knownHashes: ["a"],
      userId: "u1",
      deviceId: "dev1",
    });

    expect(result).toMatchObject({ attempted: 2, chunks: 1, failedChunks: 0, lastError: null });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.rows).toEqual([
      { session_hash: "b", user_id: "u1", device_id: "dev1" },
      { session_hash: "c", user_id: "u1", device_id: "dev1" },
    ]);
    expect(calls[0]?.opts).toEqual({ onConflict: "session_hash", ignoreDuplicates: true });
  });

  it("새 해시가 없으면 DB 를 건드리지 않는다", async () => {
    const { client, upsert } = fakeClient();

    const result = await storeSessionHashes(client, {
      hashes: ["a", "b"],
      knownHashes: new Set(["a", "b"]),
      userId: "u1",
      deviceId: null,
    });

    expect(result).toEqual({ attempted: 0, chunks: 0, failedChunks: 0, lastError: null });
    expect(upsert).not.toHaveBeenCalled();
  });

  it("STORE_CHUNK_SIZE 단위로 나눠 보내고 전부 덮는다", async () => {
    const { client, calls } = fakeClient();
    const total = STORE_CHUNK_SIZE * 2 + 234;

    const result = await storeSessionHashes(client, {
      hashes: hashes(total),
      knownHashes: [],
      userId: "u1",
      deviceId: null,
    });

    expect(result).toMatchObject({ attempted: total, chunks: 3, failedChunks: 0 });
    expect(calls.map((c) => c.rows.length)).toEqual([STORE_CHUNK_SIZE, STORE_CHUNK_SIZE, 234]);
    const sent = calls.flatMap((c) => c.rows.map((r) => r.session_hash));
    expect(new Set(sent).size).toBe(total);
    for (const c of calls) expect(c.rows.length).toBeLessThanOrEqual(STORE_CHUNK_SIZE);
  });

  it("일시 오류는 재시도해 넘긴다", async () => {
    const { client, upsert } = fakeClient(1);

    const result = await storeSessionHashes(client, {
      hashes: ["a"],
      knownHashes: [],
      userId: "u1",
      deviceId: null,
    });

    expect(result).toMatchObject({ attempted: 1, chunks: 1, failedChunks: 0, lastError: null });
    expect(upsert).toHaveBeenCalledTimes(2);
  });

  it("재시도를 다 써도 던지지 않고 실패 수와 마지막 오류를 돌려준다", async () => {
    const { client, upsert } = fakeClient(99);

    const result = await storeSessionHashes(client, {
      hashes: ["a"],
      knownHashes: [],
      userId: "u1",
      deviceId: null,
    });

    expect(result.failedChunks).toBe(1);
    expect(result.lastError).toContain("statement timeout");
    expect(upsert).toHaveBeenCalledTimes(3);
  });
});
