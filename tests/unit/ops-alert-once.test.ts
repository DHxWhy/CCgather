import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { alertOps, alertOpsOncePerUser } from "@/lib/services/ops-alert";

type AlertRow = {
  id: string;
  type: string;
  message: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

const NOW = new Date("2026-11-18T12:00:00.000Z");
const hoursAgo = (hours: number) => new Date(NOW.getTime() - hours * 3_600_000).toISOString();

// admin_alerts 대역: 실제 코드가 쓰는 조회(type · metadata->>user_id · created_at 이후 · 가장 이른 1건)와
// insert().select("id").single() 만 받는다. 새 행을 앞에 두고 요청한 정렬만 적용하므로, 정렬을
// 빼먹으면 가장 이른 행이 아니라 가장 새 행이 나온다.
function fakeAlertsTable(
  seed: AlertRow[] = [],
  options: { insertFails?: boolean; readFails?: boolean; sameInstant?: boolean } = {}
) {
  const rows = [...seed];
  let nextId = 1;
  const from = vi.fn((table: string) => {
    expect(table).toBe("admin_alerts");
    return {
      select: (columns: string) => {
        expect(columns).toBe("id");
        const wanted: { type?: string; userId?: string; since?: string } = {};
        const orders: [keyof AlertRow, boolean][] = [];
        const query = {
          eq: (column: string, value: string) => {
            expect(column).toBe("type");
            wanted.type = value;
            return query;
          },
          filter: (column: string, operator: string, value: string) => {
            expect([column, operator]).toEqual(["metadata->>user_id", "eq"]);
            wanted.userId = value;
            return query;
          },
          gte: (column: string, value: string) => {
            expect(column).toBe("created_at");
            wanted.since = value;
            return query;
          },
          order: (column: keyof AlertRow, direction: { ascending: boolean }) => {
            orders.push([column, direction.ascending]);
            return query;
          },
          limit: async (count: number) => {
            expect(count).toBe(1);
            if (options.readFails) return { data: null, error: { message: "read refused" } };
            const found = rows
              .filter(
                (row) =>
                  row.type === wanted.type &&
                  row.metadata.user_id === wanted.userId &&
                  row.created_at >= (wanted.since ?? "")
              )
              .sort((a, b) => {
                for (const [column, ascending] of orders) {
                  const order = String(a[column]).localeCompare(String(b[column]));
                  if (order !== 0) return ascending ? order : -order;
                }
                return 0;
              });
            return { data: found.slice(0, 1).map((row) => ({ id: row.id })), error: null };
          },
        };
        return query;
      },
      insert: (row: Omit<AlertRow, "id" | "created_at">) => ({
        select: () => ({
          single: async () => {
            if (options.insertFails) {
              return { data: null, error: { message: "new row violates check constraint" } };
            }
            const stored = { ...row, id: `row-${nextId++}`, created_at: new Date().toISOString() };
            rows.unshift(stored);
            if (!options.sameInstant) vi.setSystemTime(Date.now() + 1);
            return { data: { id: stored.id }, error: null };
          },
        }),
      }),
    };
  });
  return { client: { from } as unknown as SupabaseClient, rows };
}

const refusal = (userId = "u1") => ({
  type: "duplicate_refusal_few_hashes",
  userId,
  title: "Submit refused over a few hashes",
  message: "제출 거절 확인 필요: @someone",
  detail: { username: "someone", conflicting: 1, submitted: 6185 },
});

const seeded = (overrides: Partial<AlertRow>): AlertRow => ({
  id: "seed-1",
  type: "duplicate_refusal_few_hashes",
  message: "earlier",
  metadata: { user_id: "u1" },
  created_at: hoursAgo(1),
  ...overrides,
});

let webhook: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  vi.stubEnv("DISCORD_WEBHOOK_ISSUE", "https://discord.test/webhook");
  webhook = vi.fn(async () => new Response(null, { status: 204 }));
  vi.stubGlobal("fetch", webhook);
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const heldLines = () =>
  vi
    .mocked(console.error)
    .mock.calls.map((call) => JSON.parse(String(call[0])) as Record<string, unknown>)
    .filter((line) => line.evt === "ops_alert_held");

const pushedTitles = () =>
  webhook.mock.calls.map(
    (call) => JSON.parse((call[1] as { body: string }).body).embeds[0].title as string
  );

describe("alertOpsOncePerUser", () => {
  it("첫 알림은 기록을 남기고 한 번 보낸다", async () => {
    const table = fakeAlertsTable();

    const outcome = await alertOpsOncePerUser(table.client, refusal());

    expect(outcome).toBe("notified");
    expect(table.rows).toEqual([
      {
        id: "row-1",
        type: "duplicate_refusal_few_hashes",
        message: "제출 거절 확인 필요: @someone",
        metadata: { user_id: "u1", username: "someone", conflicting: 1, submitted: 6185 },
        created_at: NOW.toISOString(),
      },
    ]);
    expect(pushedTitles()).toEqual(["🚨 Submit refused over a few hashes"]);
  });

  it("같은 사용자의 같은 종류는 20시간 안에 다시 보내지도 적지도 않는다", async () => {
    const table = fakeAlertsTable([seeded({ created_at: hoursAgo(19.9) })]);

    const outcome = await alertOpsOncePerUser(table.client, refusal());

    expect(outcome).toBe("deduped");
    expect(table.rows).toHaveLength(1);
    expect(webhook).not.toHaveBeenCalled();
  });

  it("20시간이 지난 기록은 새 알림을 막지 않는다 — 매일 같은 시각의 제출은 날마다 알린다", async () => {
    const table = fakeAlertsTable([seeded({ created_at: hoursAgo(20.1) })]);

    const outcome = await alertOpsOncePerUser(table.client, refusal());

    expect(outcome).toBe("notified");
    expect(table.rows).toHaveLength(2);
    expect(webhook).toHaveBeenCalledTimes(1);
  });

  it("다른 사용자의 기록은 막지 않는다", async () => {
    const table = fakeAlertsTable([seeded({ metadata: { user_id: "u2" } })]);

    expect(await alertOpsOncePerUser(table.client, refusal("u1"))).toBe("notified");
    expect(webhook).toHaveBeenCalledTimes(1);
  });

  it("같은 사용자라도 다른 종류의 기록은 막지 않는다", async () => {
    const table = fakeAlertsTable([seeded({ type: "submit_without_fingerprint" })]);

    expect(await alertOpsOncePerUser(table.client, refusal("u1"))).toBe("notified");
    expect(webhook).toHaveBeenCalledTimes(1);
  });

  it("동시에 들어온 요청은 먼저 기록된 한 건만 보낸다", async () => {
    const table = fakeAlertsTable();

    const outcomes = await Promise.all([
      alertOpsOncePerUser(table.client, refusal()),
      alertOpsOncePerUser(table.client, refusal()),
      alertOpsOncePerUser(table.client, refusal()),
    ]);

    expect(outcomes).toEqual(["notified", "deduped", "deduped"]);
    expect(webhook).toHaveBeenCalledTimes(1);
    expect(heldLines()).toHaveLength(2);
  });

  it("같은 시각에 적힌 행들은 id 가 앞선 한 건만 보낸다", async () => {
    const table = fakeAlertsTable([], { sameInstant: true });

    const outcomes = await Promise.all([
      alertOpsOncePerUser(table.client, refusal()),
      alertOpsOncePerUser(table.client, refusal()),
      alertOpsOncePerUser(table.client, refusal()),
    ]);

    expect(new Set(table.rows.map((row) => row.created_at)).size).toBe(1);
    expect(outcomes).toEqual(["notified", "deduped", "deduped"]);
    expect(webhook).toHaveBeenCalledTimes(1);
  });

  it("기록을 남기지 못하면 그 사실을 남기고 알림은 보낸다", async () => {
    const table = fakeAlertsTable([], { insertFails: true });

    const outcome = await alertOpsOncePerUser(table.client, refusal());

    expect(outcome).toBe("notified");
    expect(webhook).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalledWith(
      "[ops-alert] admin_alerts insert failed for duplicate_refusal_few_hashes:",
      "new row violates check constraint"
    );
  });

  it("기록을 남기지 못하는 동안에도 같은 계정의 같은 종류는 한 번만 보낸다", async () => {
    const table = fakeAlertsTable([], { insertFails: true });

    const first = await alertOpsOncePerUser(table.client, refusal("u-unrecorded"));
    const second = await alertOpsOncePerUser(table.client, refusal("u-unrecorded"));
    const other = await alertOpsOncePerUser(table.client, refusal("u-unrecorded-2"));

    expect([first, second, other]).toEqual(["notified", "deduped", "notified"]);
    expect(webhook).toHaveBeenCalledTimes(2);
    expect(heldLines()).toMatchObject([{ userId: "u-unrecorded", type: refusal().type }]);
  });

  it("기록 없이 보낸 알림도 20시간이 지나면 다시 보낸다", async () => {
    const table = fakeAlertsTable([], { insertFails: true });

    await alertOpsOncePerUser(table.client, refusal("u-unrecorded-later"));
    vi.setSystemTime(new Date(NOW.getTime() + 20.1 * 3_600_000));
    const later = await alertOpsOncePerUser(table.client, refusal("u-unrecorded-later"));

    expect(later).toBe("notified");
    expect(webhook).toHaveBeenCalledTimes(2);
  });

  it("장부를 읽지 못하면 적지 않고, 같은 계정의 같은 종류는 한 번만 보낸다", async () => {
    const table = fakeAlertsTable([], { readFails: true });

    const first = await alertOpsOncePerUser(table.client, refusal("u-unreadable"));
    const second = await alertOpsOncePerUser(table.client, refusal("u-unreadable"));

    expect([first, second]).toEqual(["notified", "deduped"]);
    expect(table.rows).toHaveLength(0);
    expect(webhook).toHaveBeenCalledTimes(1);
    expect(heldLines()).toMatchObject([{ userId: "u-unreadable" }]);
  });

  it("장부를 읽다 예외가 나도 던지지 않고, 같은 계정의 같은 종류는 한 번만 보낸다", async () => {
    const broken = {
      from: () => {
        throw new Error("network down");
      },
    } as unknown as SupabaseClient;

    const first = await alertOpsOncePerUser(broken, refusal("u-thrown"));
    const second = await alertOpsOncePerUser(broken, refusal("u-thrown"));

    expect([first, second]).toEqual(["notified", "deduped"]);
    expect(webhook).toHaveBeenCalledTimes(1);
    expect(heldLines()).toMatchObject([{ userId: "u-thrown" }]);
  });

  it("묶여서 보내지 않은 알림도 서버 로그에는 건마다 한 줄 남긴다", async () => {
    const table = fakeAlertsTable([seeded({ created_at: hoursAgo(1) })]);

    expect(await alertOpsOncePerUser(table.client, refusal())).toBe("deduped");
    expect(await alertOpsOncePerUser(table.client, refusal())).toBe("deduped");

    const held = heldLines();
    expect(held).toHaveLength(2);
    expect(held[0]).toMatchObject({
      type: "duplicate_refusal_few_hashes",
      title: "Submit refused over a few hashes",
      userId: "u1",
      username: "someone",
      conflicting: 1,
      submitted: 6185,
    });
    expect(webhook).not.toHaveBeenCalled();
  });
});

describe("alertOps", () => {
  const pushedFields = () =>
    JSON.parse((webhook.mock.calls[0]?.[1] as { body: string }).body).embeds[0].fields as {
      name: string;
      value: string;
    }[];

  it("빈 값은 빈 필드로 보내지 않고 줄표로 바꿔 보낸다", async () => {
    await alertOps("Session hash store failed", { username: "someone", error: "", count: 0 });

    expect(pushedFields()).toEqual([
      { name: "username", value: "someone", inline: true },
      { name: "error", value: "—", inline: true },
      { name: "count", value: "0", inline: true },
    ]);
  });

  it("디스코드가 거절하면 응답 코드를 남긴다", async () => {
    webhook.mockResolvedValueOnce(new Response("bad embed", { status: 400 }));

    await alertOps("Session hash store failed", { username: "someone" });

    expect(console.warn).toHaveBeenCalledWith("[ops-alert] Discord push refused:", 400);
  });
});
