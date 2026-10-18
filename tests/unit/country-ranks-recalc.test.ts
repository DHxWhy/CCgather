import { afterEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { recalcCountryRanks } from "@/lib/services/country-ranks";

// PostgREST 빌더는 PromiseLike 라 then 만 있고 catch 가 없다. 프로덕션 빌더와 같은 모양의
// 대역을 써야 `rpc(...).catch(...)` 류 회귀가 TypeError 로 드러난다.
function catchlessBuilder<T>(value: T): PromiseLike<T> {
  return {
    then<R1 = T, R2 = never>(
      onfulfilled?: ((v: T) => R1 | PromiseLike<R1>) | null,
      onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null
    ): PromiseLike<R1 | R2> {
      return Promise.resolve(value).then(onfulfilled, onrejected);
    },
  };
}

function fakeClient(result: { error: { message: string } | null }) {
  const rpc = vi.fn(() => catchlessBuilder(result));
  return { client: { rpc } as unknown as SupabaseClient, rpc };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("recalcCountryRanks", () => {
  it("catch 가 없는 빌더로 성공 경로가 돈다", async () => {
    const { client, rpc } = fakeClient({ error: null });
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(recalcCountryRanks(client, "test")).resolves.toBe(true);

    expect(rpc).toHaveBeenCalledWith("calculate_country_ranks");
    expect(errSpy).not.toHaveBeenCalled();
  });

  it("RPC 실패는 던지지 않고 로그만 남긴다 (호출자 응답을 막지 않음)", async () => {
    const { client } = fakeClient({ error: { message: "boom" } });
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(recalcCountryRanks(client, "ctx")).resolves.toBe(false);

    expect(errSpy).toHaveBeenCalledTimes(1);
    expect(String(errSpy.mock.calls[0]?.[0])).toContain("ctx");
  });

  it("옛 패턴 rpc().catch 는 같은 대역에서 TypeError 다 (대역이 실제 빌더처럼 군다는 증거)", async () => {
    const { client } = fakeClient({ error: null });
    const legacy = client as unknown as { rpc: () => { catch?: unknown } };
    expect(typeof legacy.rpc().catch).toBe("undefined");
  });
});
