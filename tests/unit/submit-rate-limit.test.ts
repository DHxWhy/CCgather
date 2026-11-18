import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { admitSubmit, judgeSubmitLimit, recordSubmitEvent } from "@/lib/services/submit-rate-limit";

const alerts = vi.hoisted(() => ({ once: vi.fn(async () => "notified" as const) }));
vi.mock("@/lib/services/ops-alert", () => ({ alertOpsOncePerUser: alerts.once }));

const SUBMITTER = { id: "u1", username: "someone" };

const limitAlerts = () =>
  alerts.once.mock.calls.map((call) => {
    const alert = (
      call as unknown as [
        unknown,
        {
          type: string;
          userId: string;
          detail: { username: string; step: string; reason: string };
        },
      ]
    )[1];
    return { type: alert.type, userId: alert.userId, ...alert.detail };
  });

const NOW = Date.parse("2026-11-18T12:00:00.000Z");
const at = (clock: string) => `2026-11-18T${clock}.000Z`;
const accepted = (clock: string) => ({ outcome: "accepted", created_at: at(clock) });
const attempt = (clock: string) => ({ outcome: "attempt", created_at: at(clock) });

describe("judgeSubmitLimit", () => {
  it("기록이 없으면 받는다", () => {
    expect(judgeSubmitLimit([], NOW)).toEqual({ allowed: true });
  });

  it("한 시간 안에 받은 제출이 1번이면 받는다", () => {
    expect(judgeSubmitLimit([accepted("11:55:00")], NOW)).toEqual({ allowed: true });
  });

  it("한 시간 안에 받은 제출이 2번이면 막고, 먼저 것이 한 시간을 채울 때까지 남은 분을 알린다", () => {
    expect(judgeSubmitLimit([accepted("11:10:00"), accepted("11:50:00")], NOW)).toEqual({
      allowed: false,
      reason: "accepted",
      retryAfterMinutes: 10,
    });
  });

  it("정확히 한 시간 전 제출은 세지 않는다", () => {
    expect(judgeSubmitLimit([accepted("11:00:00"), accepted("11:50:00")], NOW)).toEqual({
      allowed: true,
    });
  });

  it("3번이 들어와 있으면 두 번째로 새로운 것이 빠질 때까지 막는다", () => {
    expect(
      judgeSubmitLimit([accepted("11:10:00"), accepted("11:50:00"), accepted("11:30:00")], NOW)
    ).toEqual({ allowed: false, reason: "accepted", retryAfterMinutes: 30 });
  });

  it("남은 시간이 1분보다 짧아도 1분으로 알린다", () => {
    expect(judgeSubmitLimit([accepted("11:00:30"), accepted("11:59:00")], NOW)).toEqual({
      allowed: false,
      reason: "accepted",
      retryAfterMinutes: 1,
    });
  });

  it("시도가 9번이면 받는다", () => {
    const attempts = ["05", "10", "15", "20", "25", "30", "35", "40", "45"].map((minute) =>
      attempt(`11:${minute}:00`)
    );
    expect(judgeSubmitLimit(attempts, NOW)).toEqual({ allowed: true });
  });

  it("시도가 10번이면 막고, 가장 오래된 시도가 빠질 때까지 남은 분을 알린다", () => {
    const attempts = ["05", "10", "15", "20", "25", "30", "35", "40", "45", "50"].map((minute) =>
      attempt(`11:${minute}:00`)
    );
    expect(judgeSubmitLimit(attempts, NOW)).toEqual({
      allowed: false,
      reason: "attempts",
      retryAfterMinutes: 5,
    });
  });

  it("거절 기록은 받은 제출로도 시도로도 세지 않는다", () => {
    const refusals = ["10", "20", "30", "40", "50"].map((minute) => ({
      outcome: "duplicate_session",
      created_at: at(`11:${minute}:00`),
    }));
    expect(judgeSubmitLimit([...refusals, accepted("11:55:00")], NOW)).toEqual({ allowed: true });
  });
});

type EventRow = {
  id: number;
  user_id: string;
  outcome: string;
  created_at: string;
  /** 다른 요청이 같은 순간에 적어, 이 읽기 순번부터 보이는 행 (기본: 처음부터) */
  visibleFromRead?: number;
};

// submit_events 대역: 사용자·시각 조건으로 거른 행을 돌려주고, insert 한 행에 순번을 매긴다.
function fakeEvents(
  seed: EventRow[] = [],
  options: {
    failRead?: number;
    insertFails?: boolean;
    nextId?: number;
    /** 같은 시각 행을 어느 쪽부터 돌려주는지 — 질의가 정하지 않으므로 양쪽을 다 본다 */
    sameInstantOrder?: "newest-id-first" | "oldest-id-first";
  } = {}
) {
  const rows = [...seed];
  const inserted: Record<string, unknown>[] = [];
  const readSince: (string | undefined)[] = [];
  const readSizes: number[] = [];
  let reads = 0;
  let nextId = options.nextId ?? 1000;
  const from = vi.fn((table: string) => {
    expect(table).toBe("submit_events");
    return {
      select: (columns: string) => {
        expect(columns).toBe("id, outcome, created_at");
        const wanted: { userId?: string; since?: string; beforeId?: number } = {};
        let createdAtAscending: boolean | undefined;
        const query = {
          eq: (column: string, value: string) => {
            expect(column).toBe("user_id");
            wanted.userId = value;
            return query;
          },
          gte: (column: string, value: string) => {
            expect(column).toBe("created_at");
            wanted.since = value;
            return query;
          },
          lt: (column: string, value: number) => {
            expect(column).toBe("id");
            wanted.beforeId = value;
            return query;
          },
          order: (column: string, direction: { ascending: boolean }) => {
            expect(column).toBe("created_at");
            createdAtAscending = direction.ascending;
            return query;
          },
          limit: async (count: number) => {
            reads += 1;
            readSince.push(wanted.since);
            if (options.failRead === reads) {
              return { data: null, error: { code: "PGRST205", message: "table not found" } };
            }
            const matching = rows.filter(
              (row) =>
                row.user_id === wanted.userId &&
                row.created_at >= (wanted.since ?? "") &&
                (wanted.beforeId === undefined || row.id < wanted.beforeId) &&
                (row.visibleFromRead ?? 1) <= reads
            );
            // 정렬을 요청하지 않으면 적힌 순서 그대로(오래된 것부터) 나온다
            if (createdAtAscending !== undefined) {
              const byTime = createdAtAscending ? 1 : -1;
              const byId = options.sameInstantOrder === "oldest-id-first" ? 1 : -1;
              matching.sort(
                (a, b) => byTime * a.created_at.localeCompare(b.created_at) || byId * (a.id - b.id)
              );
            }
            const visible = matching.slice(0, count);
            readSizes.push(visible.length);
            return {
              data: visible.map(({ id, outcome, created_at }) => ({ id, outcome, created_at })),
              error: null,
            };
          },
        };
        return query;
      },
      insert: (row: Record<string, unknown>) => {
        const write = async () => {
          if (options.insertFails) return { data: null, error: { message: "insert refused" } };
          const id = nextId++;
          inserted.push(row);
          rows.push({
            id,
            user_id: row.user_id as string,
            outcome: row.outcome as string,
            created_at: new Date().toISOString(),
          });
          return { data: { id }, error: null };
        };
        return {
          select: () => ({ single: write }),
          then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
            write().then(resolve, reject),
        };
      },
    };
  });
  return {
    client: { from } as unknown as SupabaseClient,
    inserted,
    readSince,
    readSizes: () => readSizes,
    reads: () => reads,
  };
}

const concurrentAttempts = (ids: number[]): EventRow[] =>
  ids.map((id) => ({
    id,
    user_id: "u1",
    outcome: "attempt",
    created_at: at("11:59:59"),
    visibleFromRead: 2,
  }));

describe("admitSubmit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(NOW));
    vi.spyOn(console, "error").mockImplementation(() => {});
    alerts.once.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("통과한 요청은 시도 한 행을 적는다", async () => {
    const fake = fakeEvents([{ id: 1, user_id: "u1", ...accepted("11:50:00") }]);

    expect(await admitSubmit(fake.client, SUBMITTER)).toEqual({ allowed: true });
    expect(fake.inserted).toEqual([
      {
        user_id: "u1",
        outcome: "attempt",
        device_id: null,
        cli_version: null,
        submission_source: null,
        detail: {},
      },
    ]);
    expect(alerts.once).not.toHaveBeenCalled();
  });

  it("두 번의 읽기 모두 최근 한 시간으로 좁혀 묻는다", async () => {
    const fake = fakeEvents();

    await admitSubmit(fake.client, SUBMITTER);

    expect(fake.readSince).toEqual(["2026-11-18T11:00:00.000Z", "2026-11-18T11:00:00.000Z"]);
  });

  it("이미 막힌 계정의 요청은 아무것도 적지 않는다", async () => {
    const fake = fakeEvents([
      { id: 1, user_id: "u1", ...accepted("11:10:00") },
      { id: 2, user_id: "u1", ...accepted("11:50:00") },
    ]);

    expect(await admitSubmit(fake.client, SUBMITTER)).toEqual({
      allowed: false,
      reason: "accepted",
      retryAfterMinutes: 10,
    });
    expect(fake.inserted).toEqual([]);
  });

  it("다른 사용자의 기록과 한 시간이 지난 기록은 세지 않는다", async () => {
    const fake = fakeEvents([
      { id: 1, user_id: "u2", ...accepted("11:10:00") },
      { id: 2, user_id: "u2", ...accepted("11:50:00") },
      { id: 3, user_id: "u1", ...accepted("10:30:00") },
      { id: 4, user_id: "u1", ...accepted("11:50:00") },
    ]);

    expect(await admitSubmit(fake.client, SUBMITTER)).toEqual({ allowed: true });
  });

  it("동시에 들어와 먼저 적힌 시도가 10개면, 처음 읽을 때 안 보였어도 막는다", async () => {
    const fake = fakeEvents(concurrentAttempts([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]), { nextId: 11 });

    expect(await admitSubmit(fake.client, SUBMITTER)).toEqual({
      allowed: false,
      reason: "attempts",
      retryAfterMinutes: 60,
    });
    expect(fake.reads()).toBe(2);
  });

  it("동시에 들어와 먼저 적힌 시도가 9개면 받는다", async () => {
    const fake = fakeEvents(concurrentAttempts([1, 2, 3, 4, 5, 6, 7, 8, 9]), { nextId: 10 });

    expect(await admitSubmit(fake.client, SUBMITTER)).toEqual({ allowed: true });
  });

  it("동시에 수백 건이 들어와도 나보다 먼저 적힌 10건을 놓치지 않는다", async () => {
    const later = Array.from({ length: 289 }, (_, i) => 12 + i);
    const fake = fakeEvents(concurrentAttempts([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, ...later]), {
      nextId: 11,
    });

    expect(await admitSubmit(fake.client, SUBMITTER)).toEqual({
      allowed: false,
      reason: "attempts",
      retryAfterMinutes: 60,
    });
  });

  it("나보다 늦게 적힌 시도는 나를 막지 않는다", async () => {
    const fake = fakeEvents(concurrentAttempts([12, 13, 14, 15, 16, 17, 18, 19, 20, 21]), {
      nextId: 11,
    });

    expect(await admitSubmit(fake.client, SUBMITTER)).toEqual({ allowed: true });
  });

  it.each(["newest-id-first", "oldest-id-first"] as const)(
    "내 순번 앞의 시도가 읽기 상한(200행)을 넘어도 막는다 — 같은 시각 행이 %s 로 잘려도",
    async (sameInstantOrder) => {
      const burst = concurrentAttempts(Array.from({ length: 250 }, (_, i) => i + 1));
      const fake = fakeEvents(burst, { nextId: 251, sameInstantOrder });

      expect(await admitSubmit(fake.client, SUBMITTER)).toEqual({
        allowed: false,
        reason: "attempts",
        retryAfterMinutes: 60,
      });
      expect(fake.readSizes()).toEqual([0, 200]);
    }
  );

  it("읽기 상한에서 잘릴 때는 가장 새 시도들이 남아, 남은 시간을 그것으로 센다", async () => {
    const spread: EventRow[] = Array.from({ length: 250 }, (_, i) => ({
      id: i + 1,
      user_id: "u1",
      outcome: "attempt",
      created_at: new Date(NOW - (250 - i) * 12_000).toISOString(),
      visibleFromRead: 2,
    }));
    const fake = fakeEvents(spread, { nextId: 251 });

    expect(await admitSubmit(fake.client, SUBMITTER)).toEqual({
      allowed: false,
      reason: "attempts",
      retryAfterMinutes: 58,
    });
    expect(fake.readSizes()).toEqual([0, 200]);
  });

  it("기록을 읽지 못하면 제출을 막지 않고, 제한이 걸리지 않았다고 운영에 알린다", async () => {
    const fake = fakeEvents([], { failRead: 1 });

    expect(await admitSubmit(fake.client, SUBMITTER)).toEqual({ allowed: true });
    expect(fake.inserted).toEqual([]);
    expect(limitAlerts()).toEqual([
      {
        type: "submit_limit_unavailable",
        userId: "every-account",
        username: "someone",
        step: "read",
        reason: "table not found",
      },
    ]);
  });

  it("시도를 적지 못하면 제출을 막지 않고 운영에 알린다", async () => {
    const fake = fakeEvents([], { insertFails: true });

    expect(await admitSubmit(fake.client, SUBMITTER)).toEqual({ allowed: true });
    expect(limitAlerts()).toEqual([
      {
        type: "submit_limit_unavailable",
        userId: "every-account",
        username: "someone",
        step: "attempt record",
        reason: "insert refused",
      },
    ]);
  });

  it("적은 뒤 다시 읽지 못하면 제출을 막지 않고 운영에 알린다", async () => {
    const fake = fakeEvents(concurrentAttempts([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]), {
      nextId: 11,
      failRead: 2,
    });

    expect(await admitSubmit(fake.client, SUBMITTER)).toEqual({ allowed: true });
    expect(limitAlerts()).toEqual([
      {
        type: "submit_limit_unavailable",
        userId: "every-account",
        username: "someone",
        step: "second read",
        reason: "table not found",
      },
    ]);
  });

  it("어느 계정에서 일어나든 같은 열쇠로 알려, 표가 없을 때 계정 수만큼 울리지 않게 한다", async () => {
    const fake = fakeEvents([], { failRead: 1 });
    await admitSubmit(fake.client, SUBMITTER);
    const other = fakeEvents([], { failRead: 1 });
    await admitSubmit(other.client, { id: "u2", username: "another" });

    expect(limitAlerts().map((alert) => [alert.userId, alert.username])).toEqual([
      ["every-account", "someone"],
      ["every-account", "another"],
    ]);
  });

  it("제한 미적용 알림은 한 시간에 한 번으로 묶는다 — 잠깐의 오류 한 번이 뒤이은 장애를 가리지 않게", async () => {
    const fake = fakeEvents([], { failRead: 1 });

    await admitSubmit(fake.client, SUBMITTER);

    const windows = alerts.once.mock.calls.map(
      (call) => (call as unknown as [unknown, { windowMs?: number }])[1].windowMs
    );
    expect(windows).toEqual([3_600_000]);
  });

  it("클라이언트가 예외를 던져도 제출을 막지 않고 운영에 알린다", async () => {
    const broken = {
      from: () => {
        throw new Error("network down");
      },
    } as unknown as SupabaseClient;

    expect(await admitSubmit(broken, SUBMITTER)).toEqual({ allowed: true });
    expect(limitAlerts()).toMatchObject([{ step: "check", reason: "network down" }]);
  });
});

describe("recordSubmitEvent", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    alerts.once.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("요청 한 건을 한 행으로 적는다", async () => {
    const fake = fakeEvents();

    await recordSubmitEvent(fake.client, SUBMITTER, {
      outcome: "accepted",
      deviceId: "0123456789abcdef",
      cliVersion: "2.3.4",
      source: "cli-scheduled",
      detail: { days: 30 },
    });

    expect(fake.inserted).toEqual([
      {
        user_id: "u1",
        outcome: "accepted",
        device_id: "0123456789abcdef",
        cli_version: "2.3.4",
        submission_source: "cli-scheduled",
        detail: { days: 30 },
      },
    ]);
    expect(alerts.once).not.toHaveBeenCalled();
  });

  it("적지 못해도 던지지 않고, 받은 제출이 세어지지 않았다고 운영에 알린다", async () => {
    const fake = fakeEvents([], { insertFails: true });

    await expect(
      recordSubmitEvent(fake.client, SUBMITTER, { outcome: "accepted" })
    ).resolves.toBeUndefined();
    expect(limitAlerts()).toEqual([
      {
        type: "submit_limit_unavailable",
        userId: "every-account",
        username: "someone",
        step: "accepted record",
        reason: "insert refused",
      },
    ]);
  });

  it("클라이언트가 예외를 던져도 제출을 깨지 않는다", async () => {
    const broken = {
      from: () => {
        throw new Error("network down");
      },
    } as unknown as SupabaseClient;

    await expect(
      recordSubmitEvent(broken, SUBMITTER, { outcome: "accepted" })
    ).resolves.toBeUndefined();
    expect(limitAlerts()).toMatchObject([{ step: "accepted record", reason: "network down" }]);
  });
});
