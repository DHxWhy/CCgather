import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { hashStoreDeadline, storeAlert, storeSessionHashes } from "@/lib/utils/session-hash-query";

type Row = { session_hash: string; user_id: string; device_id: string | null };
type UpsertCall = { rows: Row[]; opts: unknown; startedAt: number };

const TIMEOUT = { code: "57014", message: "canceling statement due to statement timeout" };

// 해시 저장 전용 대역: upsert 호출을 기록하고, 호출마다 실패 여부와 걸린 시간을 정할 수 있다.
function fakeClient(
  options: { fails?: (rows: Row[], call: number) => boolean; takesMs?: number } = {}
) {
  const calls: UpsertCall[] = [];
  let inFlight = 0;
  let maxInFlight = 0;
  const upsert = vi.fn(async (rows: Row[], opts: unknown) => {
    const call = calls.length;
    calls.push({ rows, opts, startedAt: Date.now() });
    if (options.takesMs) vi.setSystemTime(Date.now() + options.takesMs);
    inFlight++;
    maxInFlight = Math.max(maxInFlight, inFlight);
    await Promise.resolve();
    inFlight--;
    return { error: options.fails?.(rows, call) ? TIMEOUT : null };
  });
  const from = vi.fn((table: string) => {
    expect(table).toBe("submitted_sessions");
    return { upsert };
  });
  return {
    client: { from } as unknown as SupabaseClient,
    calls,
    sizes: () => calls.map((c) => c.rows.length),
    sent: () => calls.flatMap((c) => c.rows.map((r) => r.session_hash)),
    maxInFlight: () => maxInFlight,
  };
}

const hashes = (n: number) => Array.from({ length: n }, (_, i) => `h${i}`);
const descending = (sizes: number[]) => [...sizes].sort((a, b) => b - a);

async function store(client: SupabaseClient, list: string[], known: Iterable<string> = []) {
  const work = storeSessionHashes(client, {
    hashes: list,
    knownHashes: known,
    userId: "u1",
    deviceId: "dev1",
    deadline: Date.now() + 60_000,
  });
  await vi.runAllTimersAsync();
  return work;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-18T12:00:00.000Z"));
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("storeSessionHashes", () => {
  it("이미 장부에 있는 해시와 페이로드 내 중복은 보내지 않는다", async () => {
    const fake = fakeClient();

    const result = await store(fake.client, ["a", "b", "c", "b"], ["a"]);

    expect(result).toEqual({
      attempted: 2,
      stored: 2,
      failed: 0,
      deferred: 0,
      statements: 1,
      lastError: null,
    });
    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0]?.rows).toEqual([
      { session_hash: "b", user_id: "u1", device_id: "dev1" },
      { session_hash: "c", user_id: "u1", device_id: "dev1" },
    ]);
    expect(fake.calls[0]?.opts).toEqual({ onConflict: "session_hash", ignoreDuplicates: true });
  });

  it("새 해시가 없으면 DB 를 건드리지 않는다", async () => {
    const fake = fakeClient();

    const result = await store(fake.client, ["a", "b"], new Set(["a", "b"]));

    expect(result).toEqual({
      attempted: 0,
      stored: 0,
      failed: 0,
      deferred: 0,
      statements: 0,
      lastError: null,
    });
    expect(fake.calls).toHaveLength(0);
  });

  it("한 번에 100개씩 나눠 보내고 전부 덮는다", async () => {
    const fake = fakeClient();

    const result = await store(fake.client, hashes(250));

    expect(fake.sizes()).toEqual([100, 100, 50]);
    expect(new Set(fake.sent())).toEqual(new Set(hashes(250)));
    expect(result).toMatchObject({ attempted: 250, stored: 250, failed: 0, deferred: 0 });
    expect(result.statements).toBe(3);
  });

  it("동시에 보내는 upsert 는 10개를 넘지 않는다", async () => {
    const fake = fakeClient();

    const result = await store(fake.client, hashes(2000));

    expect(fake.calls).toHaveLength(20);
    expect(fake.maxInFlight()).toBe(10);
    expect(result.stored).toBe(2000);
  });

  it("실패한 조각은 반으로 나눠 다시 보낸다", async () => {
    const fake = fakeClient({ fails: (_rows, call) => call === 0 });

    const result = await store(fake.client, hashes(100));

    expect(fake.sizes()).toEqual([100, 50, 50]);
    const halves = fake.calls.slice(1).flatMap((c) => c.rows.map((r) => r.session_hash));
    expect(new Set(halves)).toEqual(new Set(hashes(100)));
    expect(halves).toHaveLength(100);
    expect(result).toMatchObject({ attempted: 100, stored: 100, failed: 0, deferred: 0 });
    expect(result.statements).toBe(3);
  });

  it("큰 조각만 시간 초과가 나면 작아진 조각으로 전부 적는다", async () => {
    const fake = fakeClient({ fails: (rows) => rows.length > 30 });

    const result = await store(fake.client, hashes(100));

    expect(descending(fake.sizes())).toEqual([100, 50, 50, 25, 25, 25, 25]);
    expect(result).toMatchObject({ attempted: 100, stored: 100, failed: 0, deferred: 0 });
  });

  it("25개 조각은 더 쪼개지 않고 두 번 더 보낸 뒤 실패로 센다", async () => {
    const fake = fakeClient({ fails: () => true });

    const result = await store(fake.client, hashes(100));

    const sizes = fake.sizes();
    expect(sizes.filter((n) => n === 100)).toHaveLength(1);
    expect(sizes.filter((n) => n === 50)).toHaveLength(2);
    expect(sizes.filter((n) => n === 25)).toHaveLength(12);
    expect(sizes).toHaveLength(15);
    expect(result).toMatchObject({ attempted: 100, stored: 0, failed: 100, deferred: 0 });
    expect(result.statements).toBe(15);
    expect(result.lastError).toContain("statement timeout");
  });

  it("처음부터 작은 조각은 같은 크기로 다시 보내 일시 오류를 넘긴다", async () => {
    const fake = fakeClient({ fails: (_rows, call) => call === 0 });

    const result = await store(fake.client, ["a"]);

    expect(fake.sizes()).toEqual([1, 1]);
    expect(result).toMatchObject({ attempted: 1, stored: 1, failed: 0, deferred: 0 });
  });

  it("작은 조각이 세 번 다 실패하면 던지지 않고 실패 수와 오류를 돌려준다", async () => {
    const fake = fakeClient({ fails: () => true });

    const result = await store(fake.client, ["a"]);

    expect(fake.sizes()).toEqual([1, 1, 1]);
    expect(result).toMatchObject({ attempted: 1, stored: 0, failed: 1, deferred: 0 });
    expect(result.lastError).toContain("statement timeout");
  });

  it("마감 시각이 지나면 새 upsert 를 시작하지 않고 남은 해시를 미룬 수로 돌려준다", async () => {
    // upsert 하나가 4초씩 걸리는 DB: 0·4·…·56초에 시작한 15개까지만 나간다
    const fake = fakeClient({ takesMs: 4000 });
    const startedAt = Date.now();

    const result = await store(fake.client, hashes(2000));

    expect(fake.calls.map((c) => c.startedAt - startedAt)).toEqual([
      0, 4000, 8000, 12000, 16000, 20000, 24000, 28000, 32000, 36000, 40000, 44000, 48000, 52000,
      56000,
    ]);
    expect(result).toEqual({
      attempted: 2000,
      stored: 1500,
      failed: 0,
      deferred: 500,
      statements: 15,
      lastError: null,
    });
  });

  it("실패해서 다시 줄 선 조각도 시간이 지나면 실패가 아니라 미룬 수로 센다", async () => {
    // 40초씩 걸리며 실패하는 DB: 첫 조각 둘(0·40초)만 나가고, 반으로 나뉜 조각은 80초라 못 나간다
    const fake = fakeClient({ takesMs: 40000, fails: () => true });

    const result = await store(fake.client, hashes(200));

    expect(fake.sizes()).toEqual([100, 100]);
    expect(result).toMatchObject({ attempted: 200, stored: 0, failed: 0, deferred: 200 });
    expect(result.lastError).toContain("statement timeout");
  });
});

describe("storeAlert", () => {
  const written = {
    attempted: 10,
    stored: 10,
    failed: 0,
    deferred: 0,
    statements: 1,
    lastError: null,
  };

  it("전부 적었으면 알리지 않는다", () => {
    expect(storeAlert(written)).toBeNull();
  });

  it("오류가 있었어도 다시 보내 전부 적었으면 알리지 않는다", () => {
    expect(storeAlert({ ...written, statements: 3, lastError: "statement timeout" })).toBeNull();
  });

  it("적지 못한 해시가 있으면 실패로 알린다", () => {
    expect(storeAlert({ ...written, stored: 4, failed: 6 })).toEqual({
      type: "session_hash_store_failed",
      title: "Session hash store failed",
    });
  });

  it("시간이 모자라 미룬 해시만 있으면 실패와 구분해 알린다", () => {
    expect(storeAlert({ ...written, stored: 4, deferred: 6 })).toEqual({
      type: "session_hash_store_out_of_time",
      title: "Session hash store ran out of time",
    });
  });

  it("실패와 미룸이 함께 있으면 실패로 알린다", () => {
    expect(storeAlert({ ...written, stored: 2, failed: 3, deferred: 5 })?.type).toBe(
      "session_hash_store_failed"
    );
  });
});

describe("hashStoreDeadline", () => {
  it("요청이 시작된 지 85초가 되는 시각이다", () => {
    expect(hashStoreDeadline(Date.parse("2026-11-18T12:00:00.000Z"))).toBe(
      Date.parse("2026-11-18T12:01:25.000Z")
    );
  });
});
