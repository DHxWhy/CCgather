import { beforeEach, describe, expect, it, vi } from "vitest";

type Result = { data: unknown; error: unknown };
type Op = [string, unknown[]];

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  results: {} as Record<string, Result>,
  ops: {} as Record<string, Op[]>,
}));

vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: () => ({
    from: (table: string) => {
      const ops: Op[] = (mocks.ops[table] = []);
      const builder = {
        select: (...args: unknown[]) => (ops.push(["select", args]), builder),
        eq: (...args: unknown[]) => (ops.push(["eq", args]), builder),
        is: (...args: unknown[]) => (ops.push(["is", args]), builder),
        order: (...args: unknown[]) => (ops.push(["order", args]), builder),
        limit: (...args: unknown[]) => (ops.push(["limit", args]), builder),
        maybeSingle: async () => mocks.results[table] ?? { data: null, error: null },
      };
      return builder;
    },
  }),
}));

import { GET } from "@/app/api/me/cli-status/route";

const MEMBER: Result = { data: { id: "user-1" }, error: null };

describe("GET /api/me/cli-status — 로그인한 회원 본인의 마지막 제출 CLI 판", () => {
  beforeEach(() => {
    mocks.auth.mockReset();
    mocks.results = {};
    mocks.ops = {};
  });

  it("로그인 전이면 401 이고 DB 를 읽지 않는다", async () => {
    mocks.auth.mockResolvedValueOnce({ userId: null });

    const response = await GET();

    expect(response.status).toBe(401);
    expect(mocks.ops).toEqual({});
  });

  it("탈퇴하지 않은 본인 행을 찾고, 마지막으로 받은 제출의 판과 옛 판 여부를 돌려준다", async () => {
    mocks.auth.mockResolvedValueOnce({ userId: "clerk_1" });
    mocks.results.users = MEMBER;
    mocks.results.submit_events = { data: { cli_version: "2.3.0" }, error: null };

    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ version: "2.3.0", outdated: true });
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(mocks.ops.users).toEqual(
      expect.arrayContaining([
        ["eq", ["clerk_id", "clerk_1"]],
        ["is", ["deleted_at", null]],
      ])
    );
    expect(mocks.ops.submit_events).toEqual(
      expect.arrayContaining([
        ["eq", ["user_id", "user-1"]],
        ["eq", ["outcome", "accepted"]],
        ["order", ["created_at", { ascending: false }]],
        ["limit", [1]],
      ])
    );
  });

  it("새 판으로 받은 제출이면 안내하지 않는다", async () => {
    mocks.auth.mockResolvedValueOnce({ userId: "clerk_1" });
    mocks.results.users = MEMBER;
    mocks.results.submit_events = { data: { cli_version: "2.3.4" }, error: null };

    const response = await GET();

    expect(await response.json()).toEqual({ version: "2.3.4", outdated: false });
  });

  it("받은 제출 기록이 없으면 판 없음 · 안내 없음", async () => {
    mocks.auth.mockResolvedValueOnce({ userId: "clerk_1" });
    mocks.results.users = MEMBER;

    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ version: null, outdated: false });
  });

  it("회원 행이 없으면 404 이고 제출 기록을 읽지 않는다", async () => {
    mocks.auth.mockResolvedValueOnce({ userId: "clerk_1" });

    const response = await GET();

    expect(response.status).toBe(404);
    expect(mocks.ops.submit_events).toBeUndefined();
  });

  it("기록을 못 읽으면 500 — 판을 모르는 채로 안내하지 않는다", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.auth.mockResolvedValue({ userId: "clerk_1" });
    mocks.results.users = { data: null, error: { message: "timeout" } };
    expect((await GET()).status).toBe(500);

    mocks.results.users = MEMBER;
    mocks.results.submit_events = { data: null, error: { message: "timeout" } };
    expect((await GET()).status).toBe(500);
  });
});
