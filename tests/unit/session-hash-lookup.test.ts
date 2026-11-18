import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchSessionHashRows } from "@/lib/utils/session-hash-query";

const TIMEOUT = { code: "57014", message: "canceling statement due to statement timeout" };

function fakeClient(
  options: { ledger?: Set<string>; fails?: (batch: string[], call: number) => boolean } = {}
) {
  const calls: string[][] = [];
  let inFlight = 0;
  let maxInFlight = 0;
  const lookUp = async (column: string, batch: string[]) => {
    expect(column).toBe("session_hash");
    const call = calls.length;
    calls.push(batch);
    inFlight++;
    maxInFlight = Math.max(maxInFlight, inFlight);
    await Promise.resolve();
    inFlight--;
    if (options.fails?.(batch, call)) return { data: null, error: TIMEOUT };
    const found = batch
      .filter((hash) => options.ledger?.has(hash))
      .map((session_hash) => ({ session_hash, user_id: "owner", device_id: "dev1" }));
    return { data: found, error: null };
  };
  const from = vi.fn((table: string) => {
    expect(table).toBe("submitted_sessions");
    return {
      select: (columns: string) => {
        expect(columns).toBe("session_hash, user_id, device_id");
        return { in: lookUp };
      },
    };
  });
  return {
    client: { from } as unknown as SupabaseClient,
    calls,
    sizes: () => calls.map((batch) => batch.length),
    maxInFlight: () => maxInFlight,
  };
}

const hashes = (n: number) => Array.from({ length: n }, (_, i) => `h${i}`);

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("fetchSessionHashRows", () => {
  it("한 번에 100개까지만 묻고 장부에 있는 행을 모두 돌려준다", async () => {
    const ledger = new Set(["h0", "h99", "h100", "h249"]);
    const fake = fakeClient({ ledger });

    const work = fetchSessionHashRows(fake.client, hashes(250));
    await vi.runAllTimersAsync();
    const rows = await work;

    expect(fake.sizes()).toEqual([100, 100, 50]);
    expect(new Set(fake.calls.flat())).toEqual(new Set(hashes(250)));
    expect(rows).toEqual([
      { session_hash: "h0", user_id: "owner", device_id: "dev1" },
      { session_hash: "h99", user_id: "owner", device_id: "dev1" },
      { session_hash: "h100", user_id: "owner", device_id: "dev1" },
      { session_hash: "h249", user_id: "owner", device_id: "dev1" },
    ]);
  });

  it("동시에 묻는 조회는 25개를 넘지 않는다", async () => {
    const fake = fakeClient();

    const work = fetchSessionHashRows(fake.client, hashes(3000));
    await vi.runAllTimersAsync();
    await work;

    expect(fake.calls).toHaveLength(30);
    expect(fake.maxInFlight()).toBe(25);
  });

  it("실패한 조회는 같은 묶음을 다시 물어 넘긴다", async () => {
    const fake = fakeClient({ ledger: new Set(["h1"]), fails: (_batch, call) => call === 0 });

    const work = fetchSessionHashRows(fake.client, hashes(3));
    await vi.runAllTimersAsync();
    const rows = await work;

    expect(fake.calls).toEqual([hashes(3), hashes(3)]);
    expect(rows).toEqual([{ session_hash: "h1", user_id: "owner", device_id: "dev1" }]);
  });

  it("같은 묶음이 세 번 실패하면 통과시키지 않고 던진다", async () => {
    const fake = fakeClient({ fails: () => true });

    const work = fetchSessionHashRows(fake.client, hashes(3));
    const refusal = expect(work).rejects.toThrow(
      "session hash lookup failed: canceling statement due to statement timeout"
    );
    await vi.runAllTimersAsync();
    await refusal;

    expect(fake.calls).toHaveLength(3);
  });
});
