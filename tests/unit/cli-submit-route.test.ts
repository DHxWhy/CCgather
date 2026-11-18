import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

type Step = { method: string; args: unknown[] };
type Query = { table: string; steps: Step[] };
type Answer = { data?: unknown; error: { message: string } | null; count?: number };

const mocks = vi.hoisted(() => ({
  client: { current: null as unknown },
  alertOps: vi.fn(async () => {}),
  alertOpsOncePerUser: vi.fn(async () => "notified" as const),
}));

vi.mock("@/lib/supabase/server", () => ({ createServiceClient: () => mocks.client.current }));
vi.mock("@/lib/services/ops-alert", () => ({
  alertOps: mocks.alertOps,
  alertOpsOncePerUser: mocks.alertOpsOncePerUser,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: vi.fn(),
}));
vi.mock("@/lib/cache/edge-cache", () => ({
  CACHE_TAG_LEADERBOARD: "leaderboard",
  userCacheTag: (id: string) => `user:${id}`,
  invalidateEdgeCache: vi.fn(async () => {}),
}));
vi.mock("@/lib/services/badgeService", () => ({
  checkAndAwardBadges: vi.fn(async () => ({ newBadges: [], allBadges: [] })),
}));
vi.mock("@/lib/push/send-notification", () => ({
  sendPushNotificationToUser: vi.fn(async () => {}),
  createSubmissionSummaryNotification: vi.fn(() => ({})),
}));
vi.mock("@/lib/services/pricing", () => ({
  getPricingData: vi.fn(async () => ({})),
  resolveDayCost: vi.fn(() => ({ cost: 1.5, splitRejected: false })),
  computeDayCost: vi.fn(() => 1.5),
}));
vi.mock("@/lib/services/pricing-dispatch", () => ({
  unpricedClaudeModels: vi.fn(() => []),
  requestPricingCheck: vi.fn(async () => {}),
}));
vi.mock("@/lib/services/rank-totals", () => ({
  readUsageTotals: vi.fn(async () => ({
    rows: [{ total_tokens: 1000, cost_usd: 1.5, sessions: 2, device_id: "aaaaaaaaaaaaaaaa" }],
    error: null,
    fromDb: true,
  })),
  recalculateRanks: vi.fn(async () => ({ rank: 5, countryRank: 2, fromDb: true })),
}));
vi.mock("@/lib/services/validation-notify", () => ({
  notifyValidationIssue: vi.fn(async () => "skipped_no_flags"),
}));

const { POST } = await import("@/app/api/cli/submit/route");

const hash = (char: string) => char.repeat(64);
const LAUNCHED_ONLY_JOURNAL = "58912a10ec106bc20dc49fa698646d88c7d619f9cc1a0b342155c019957226ae";
const DEVICE = "aaaaaaaaaaaaaaaa";
const TOKEN = "token-1";

interface World {
  user: Record<string, unknown> | null;
  /** session_hash → who holds it */
  ledger: Map<string, { user_id: string; device_id: string | null }>;
  /** submit_events rows of this account */
  events: { id: number; outcome: string; created_at: string; [column: string]: unknown }[];
  eventsError: string | null;
  lookupError: string | null;
  hashStoreError: string | null;
  /** Runs as each ledger lookup starts, with the number of lookups started before it */
  onLookup: ((startedBefore: number) => void) | null;
  /** Runs as each ledger upsert starts, with the number of upserts started before it */
  onHashStore: ((startedBefore: number) => void) | null;
  queries: Query[];
}

// supabase 대역: 어떤 메서드 사슬이든 기록하고, 기다리는 순간 표와 첫 동사로 답을 고른다.
function makeWorld(overrides: Partial<Omit<World, "queries">> = {}): World {
  const world: World = {
    user: {
      id: "u1",
      username: "someone",
      github_id: "1",
      total_tokens: 0,
      total_cost: 0,
      total_sessions: 0,
      country_code: "KR",
      last_submission_at: null,
      global_rank: null,
      country_rank: null,
      current_level: 1,
      auto_sync_enabled: false,
      github_starred_at: null,
      shadow_banned: false,
    },
    ledger: new Map(),
    events: [],
    eventsError: null,
    lookupError: null,
    hashStoreError: null,
    onLookup: null,
    onHashStore: null,
    queries: [],
    ...overrides,
  };
  let lookupsStarted = 0;
  let hashStoresStarted = 0;

  const answer = (query: Query): Answer => {
    const first = query.steps[0];
    const verb = first?.method;
    if (query.table === "users" && verb === "select") {
      const token = query.steps.find((step) => step.method === "eq" && step.args[0] === "api_key")
        ?.args[1];
      if (world.user === null || token !== TOKEN) return { data: null, error: null };
      const asked = String(first?.args[0])
        .split(",")
        .map((column) => column.trim());
      return {
        data: Object.fromEntries(asked.map((column) => [column, world.user?.[column]])),
        error: null,
      };
    }
    if (query.table === "users" && verb === "update") return { error: null };
    if (query.table === "usage_stats" && verb === "select") {
      if (first?.args[0] === "submitted_at")
        throw new Error("the limit no longer reads usage rows");
      return { data: [], error: null };
    }
    if (query.table === "submit_events" && verb === "select") {
      if (world.eventsError) return { data: null, error: { message: world.eventsError } };
      const since = query.steps.find((step) => step.method === "gte")?.args[1] as string;
      const before = query.steps.find((step) => step.method === "lt")?.args[1] as
        number | undefined;
      return {
        data: world.events
          .filter((row) => row.created_at >= since && (before === undefined || row.id < before))
          .sort((a, b) => b.id - a.id),
        error: null,
      };
    }
    if (query.table === "submit_events" && verb === "insert") {
      if (world.eventsError) return { data: null, error: { message: world.eventsError } };
      const id = Math.max(0, ...world.events.map((row) => row.id)) + 1;
      world.events.push({
        ...(first?.args[0] as { outcome: string }),
        id,
        created_at: new Date().toISOString(),
      });
      return { data: { id }, error: null };
    }
    if (query.table === "usage_stats" && verb === "upsert") return { error: null };
    if (query.table === "usage_stats" && verb === "delete") return { error: null, count: 0 };
    if (query.table === "submitted_sessions" && verb === "select") {
      world.onLookup?.(lookupsStarted++);
      if (world.lookupError) return { data: null, error: { message: world.lookupError } };
      const batch = query.steps.find((step) => step.method === "in")?.args[1] as string[];
      return {
        data: [...new Set(batch)]
          .filter((session_hash) => world.ledger.has(session_hash))
          .map((session_hash) => ({ session_hash, ...world.ledger.get(session_hash) })),
        error: null,
      };
    }
    if (query.table === "submitted_sessions" && verb === "upsert") {
      world.onHashStore?.(hashStoresStarted++);
      return { error: world.hashStoreError ? { message: world.hashStoreError } : null };
    }
    if (query.table === "user_notification_settings") {
      return { data: { push_enabled: false, notify_submissions: false }, error: null };
    }
    throw new Error(`unexpected query: ${query.table}.${verb}`);
  };

  const from = (table: string) => {
    const query: Query = { table, steps: [] };
    world.queries.push(query);
    const builder: unknown = new Proxy(
      {},
      {
        get(_target, property: string) {
          if (property === "then") {
            return (resolve: (value: Answer) => unknown, reject: (reason: unknown) => unknown) =>
              Promise.resolve()
                .then(() => answer(query))
                .then(resolve, reject);
          }
          return (...args: unknown[]) => {
            query.steps.push({ method: property, args });
            return builder;
          };
        },
      }
    );
    return builder;
  };

  mocks.client.current = { from };
  return world;
}

const did = (world: World, table: string, verb: string) =>
  world.queries.filter((query) => query.table === table && query.steps[0]?.method === verb);

const lookedUp = (world: World) =>
  did(world, "submitted_sessions", "select").flatMap(
    (query) => query.steps.find((step) => step.method === "in")?.args[1] as string[]
  );

const storedHashes = (world: World) =>
  did(world, "submitted_sessions", "upsert").flatMap((query) =>
    (query.steps[0]?.args[0] as { session_hash: string }[]).map((row) => row.session_hash)
  );

const wroteNothing = (world: World) =>
  did(world, "usage_stats", "upsert").length === 0 &&
  did(world, "submitted_sessions", "upsert").length === 0 &&
  did(world, "users", "update").length === 0;

function submit(overrides: Record<string, unknown> = {}, token = TOKEN) {
  const payload = {
    totalTokens: 1000,
    totalSpent: 1.5,
    timestamp: "2026-11-18T12:00:00.000Z",
    dailyUsage: [
      {
        date: "2026-11-18",
        tokens: 1000,
        cost: 1.5,
        inputTokens: 600,
        outputTokens: 400,
        sessions: 2,
        models: { "claude-fable-5-2": 1000 },
      },
    ],
    sessionFingerprint: {
      sessionHashes: [hash("a"), hash("b")],
      combinedHash: hash("c"),
      sessionCount: 2,
    },
    deviceId: DEVICE,
    cliVersion: "2.3.4",
    ...overrides,
  };
  return POST(
    new NextRequest("https://ccgather.com/api/cli/submit", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
  );
}

const onceAlerts = () =>
  mocks.alertOpsOncePerUser.mock.calls.map(
    (call) => (call as unknown as [unknown, { type: string; detail: Record<string, unknown> }])[1]
  );

beforeEach(() => {
  vi.stubEnv("SUBMIT_VALIDATION_MODE", "off");
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.alertOps.mockClear();
  mocks.alertOpsOncePerUser.mockClear();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("POST /api/cli/submit — 지문 소유 검사", () => {
  it("모든 지문이 내 것이거나 새것이면 받고, 새 지문만 장부에 적는다", async () => {
    const world = makeWorld({
      ledger: new Map([[hash("a"), { user_id: "u1", device_id: DEVICE }]]),
    });

    const response = await submit();

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ success: true, rank: 5 });
    expect(lookedUp(world)).toEqual([hash("a"), hash("b")]);
    expect(storedHashes(world)).toEqual([hash("b")]);
    const usage = did(world, "usage_stats", "upsert");
    expect(usage).toHaveLength(1);
    expect(usage[0]?.steps[0]?.args[0]).toMatchObject([
      { user_id: "u1", date: "2026-11-18", total_tokens: 1000, device_id: DEVICE },
    ]);
    expect(did(world, "users", "update")).toHaveLength(1);
    expect(mocks.alertOps).not.toHaveBeenCalled();
    expect(mocks.alertOpsOncePerUser).not.toHaveBeenCalled();
  });

  it("다른 계정 지문이 1개 섞이면 전체를 409 로 거절하고 아무것도 쓰지 않는다", async () => {
    const world = makeWorld({
      ledger: new Map([[hash("b"), { user_id: "u2", device_id: "bbbbbbbbbbbbbbbb" }]]),
    });

    const response = await submit();

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: "DUPLICATE_SESSION" });
    expect(wroteNothing(world)).toBe(true);
    expect(onceAlerts()).toMatchObject([
      {
        type: "duplicate_refusal_few_hashes",
        userId: "u1",
        detail: { conflicting: 1, submitted: 2, owners: 1, hashes: hash("b") },
      },
    ]);
  });

  it("다른 계정 지문이 6개 섞여도 409 로 거절하고, 이때는 운영 알림을 보내지 않는다", async () => {
    const foreign = ["1", "2", "3", "4", "5", "6"].map(hash);
    const world = makeWorld({
      ledger: new Map(foreign.map((h) => [h, { user_id: "u2", device_id: null }])),
    });

    const response = await submit({
      sessionFingerprint: {
        sessionHashes: [hash("a"), ...foreign],
        combinedHash: hash("c"),
        sessionCount: 7,
      },
    });

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: "DUPLICATE_SESSION" });
    expect(wroteNothing(world)).toBe(true);
    expect(mocks.alertOpsOncePerUser).not.toHaveBeenCalled();
  });

  it("같은 지문이 여러 번 실려 와도 한 개로 묻고 한 개로 센다", async () => {
    const world = makeWorld({
      ledger: new Map([[hash("b"), { user_id: "u2", device_id: null }]]),
    });

    const response = await submit({
      sessionFingerprint: {
        sessionHashes: [hash("a"), ...Array.from({ length: 600 }, () => hash("b"))],
        combinedHash: hash("c"),
        sessionCount: 601,
      },
    });

    expect(response.status).toBe(409);
    expect(lookedUp(world)).toEqual([hash("a"), hash("b")]);
    expect(onceAlerts()).toMatchObject([
      {
        type: "duplicate_refusal_few_hashes",
        detail: { conflicting: 1, submitted: 2, hashes: hash("b") },
      },
    ]);
  });

  it("모양이 맞지 않는 지문은 조회에도 저장에도 가지 않는다", async () => {
    const world = makeWorld();

    const response = await submit({
      sessionFingerprint: {
        sessionHashes: [hash("a"), "x".repeat(60000), hash("A"), `${hash("b")}\n`],
        combinedHash: hash("c"),
        sessionCount: 4,
      },
    });

    expect(response.status).toBe(200);
    expect(lookedUp(world)).toEqual([hash("a")]);
    expect(storedHashes(world)).toEqual([hash("a")]);
  });

  it("지문 조회가 실패하면 통과시키지 않고 503 으로 끝낸다", async () => {
    const world = makeWorld({ lookupError: "canceling statement due to statement timeout" });

    const response = await submit();

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: "HASH_LOOKUP_FAILED" });
    expect(wroteNothing(world)).toBe(true);
    expect(onceAlerts()).toMatchObject([{ type: "session_hash_lookup_failed", userId: "u1" }]);
    expect(mocks.alertOps).not.toHaveBeenCalled();
  });

  it("지문 저장이 실패해도 제출은 받고, 운영 알림은 계정당 한 번 방식으로 보낸다", async () => {
    const world = makeWorld({ hashStoreError: "canceling statement due to statement timeout" });

    const response = await submit();

    expect(response.status).toBe(200);
    expect(did(world, "usage_stats", "upsert")).toHaveLength(1);
    expect(onceAlerts()).toMatchObject([
      {
        type: "session_hash_store_failed",
        userId: "u1",
        detail: { attempted: 2, stored: 0, failed: 2, deferred: 0 },
      },
    ]);
    expect(Object.keys(onceAlerts()[0]?.detail ?? {}).slice(0, 8)).toEqual([
      "username",
      "attempted",
      "stored",
      "failed",
      "deferred",
      "ms",
      "deviceId",
      "error",
    ]);
    expect(mocks.alertOps).not.toHaveBeenCalled();
  });

  it("문자열이 아닌 기기 ID 는 기기 ID 로 쓰지 않는다", async () => {
    const world = makeWorld();

    const response = await submit({ deviceId: ["aaaaaaaa"] });

    expect(response.status).toBe(200);
    expect(did(world, "usage_stats", "upsert")[0]?.steps[0]?.args[0]).toMatchObject([
      { device_id: "legacy" },
    ]);
    expect(did(world, "submitted_sessions", "upsert")[0]?.steps[0]?.args[0]).toMatchObject([
      { device_id: null },
      { device_id: null },
    ]);
  });
});

describe("POST /api/cli/submit — 지문 저장 마감", () => {
  const manyHashes = Array.from({ length: 1100 }, (_, i) => i.toString(16).padStart(64, "0"));
  const START = Date.parse("2026-11-18T12:00:00.000Z");

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(START);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const submitMany = () =>
    submit({
      sessionFingerprint: {
        sessionHashes: manyHashes,
        combinedHash: hash("c"),
        sessionCount: manyHashes.length,
      },
    });

  it("요청이 시작된 지 84초까지는 남은 지문을 계속 적는다", async () => {
    const world = makeWorld({
      onHashStore: (startedBefore) => {
        if (startedBefore === 0) vi.setSystemTime(START + 84_000);
      },
    });

    const response = await submitMany();

    expect(response.status).toBe(200);
    expect(storedHashes(world)).toHaveLength(1100);
    expect(mocks.alertOpsOncePerUser).not.toHaveBeenCalled();
  });

  it("요청이 시작된 지 86초가 지나면 남은 지문은 미루고, 미룬 수를 알린다", async () => {
    const world = makeWorld({
      onHashStore: (startedBefore) => {
        if (startedBefore === 0) vi.setSystemTime(START + 86_000);
      },
    });

    const response = await submitMany();

    expect(response.status).toBe(200);
    expect(storedHashes(world)).toHaveLength(1000);
    expect(onceAlerts()).toMatchObject([
      {
        type: "session_hash_store_out_of_time",
        detail: { attempted: 1100, stored: 1000, failed: 0, deferred: 100 },
      },
    ]);
  });

  it("마감은 저장을 시작한 때가 아니라 요청이 시작된 때부터 잰다", async () => {
    // 조회에 50초를 쓴 요청: 저장을 시작한 지 36초 만에 요청 시작 뒤 86초가 된다
    const world = makeWorld({
      onLookup: (startedBefore) => {
        if (startedBefore === 0) vi.setSystemTime(START + 50_000);
      },
      onHashStore: (startedBefore) => {
        if (startedBefore === 0) vi.setSystemTime(START + 86_000);
      },
    });

    const response = await submitMany();

    expect(response.status).toBe(200);
    expect(storedHashes(world)).toHaveLength(1000);
    expect(onceAlerts()).toMatchObject([
      { type: "session_hash_store_out_of_time", detail: { stored: 1000, deferred: 100 } },
    ]);
  });
});

describe("POST /api/cli/submit — 지문 없는 제출", () => {
  it("받되, 섀도 밴이 아닌 계정이면 운영 알림을 보낸다", async () => {
    const world = makeWorld();

    const response = await submit({ sessionFingerprint: undefined });

    expect(response.status).toBe(200);
    expect(did(world, "submitted_sessions", "select")).toHaveLength(0);
    expect(did(world, "usage_stats", "upsert")[0]?.steps[0]?.args[0]).toMatchObject([
      { device_id: "legacy" },
    ]);
    expect(onceAlerts()).toMatchObject([
      {
        type: "submit_without_fingerprint",
        userId: "u1",
        detail: { cliVersion: "2.3.4", declaredSessions: 0, daysWritten: 1 },
      },
    ]);
  });

  it("섀도 밴 계정이면 알림 없이 받는다", async () => {
    const world = makeWorld();
    world.user = { ...world.user, shadow_banned: true };

    const response = await submit({ sessionFingerprint: undefined });

    expect(response.status).toBe(200);
    expect(mocks.alertOpsOncePerUser).not.toHaveBeenCalled();
  });

  it("모든 기기에 같은 지문만 온 제출도 지문 없는 제출로 다룬다", async () => {
    const world = makeWorld();

    const response = await submit({
      sessionFingerprint: {
        sessionHashes: [LAUNCHED_ONLY_JOURNAL],
        combinedHash: hash("c"),
        sessionCount: 1,
      },
    });

    expect(response.status).toBe(200);
    expect(did(world, "submitted_sessions", "select")).toHaveLength(0);
    expect(did(world, "submitted_sessions", "upsert")).toHaveLength(0);
    expect(onceAlerts()).toMatchObject([
      { type: "submit_without_fingerprint", detail: { declaredSessions: 1 } },
    ]);
  });

  it("저장할 수 없는 문자가 든 버전과 숫자가 아닌 개수는 알림에 그대로 들어가지 않는다", async () => {
    makeWorld();

    await submit({
      cliVersion: "2.3.4\u0000",
      sessionFingerprint: { sessionHashes: [], combinedHash: "", sessionCount: "\u0000" },
    });

    expect(onceAlerts()).toMatchObject([
      {
        type: "submit_without_fingerprint",
        detail: { cliVersion: "invalid", declaredSessions: 0 },
      },
    ]);
  });
});

describe("POST /api/cli/submit — 그 밖의 문지기", () => {
  it("토큰이 없으면 401 이고 DB 를 읽지 않는다", async () => {
    const world = makeWorld();

    const response = await POST(
      new NextRequest("https://ccgather.com/api/cli/submit", {
        method: "POST",
        body: JSON.stringify({ totalTokens: 1, totalSpent: 0 }),
      })
    );

    expect(response.status).toBe(401);
    expect(world.queries).toHaveLength(0);
  });

  it("다른 토큰으로는 그 계정으로 제출하지 못한다", async () => {
    const world = makeWorld();

    const response = await submit({}, "token-2");

    expect(response.status).toBe(401);
    expect(wroteNothing(world)).toBe(true);
    expect(did(world, "submitted_sessions", "select")).toHaveLength(0);
  });

  it("모르는 토큰이면 401 이고 아무것도 쓰지 않는다", async () => {
    const world = makeWorld({ user: null });

    const response = await submit();

    expect(response.status).toBe(401);
    expect(wroteNothing(world)).toBe(true);
    expect(did(world, "submitted_sessions", "select")).toHaveLength(0);
  });

  it("최근 한 시간에 받은 제출이 2건이면 429 이고 조회도 쓰기도 기록도 하지 않는다", async () => {
    const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();
    const world = makeWorld({
      events: [
        { id: 1, outcome: "accepted", created_at: minutesAgo(50) },
        { id: 2, outcome: "accepted", created_at: minutesAgo(20) },
      ],
    });

    const response = await submit();

    expect(response.status).toBe(429);
    expect(await response.json()).toMatchObject({
      error: "Rate limit exceeded. Maximum 2 submissions per hour.",
      retryAfterMinutes: 10,
    });
    expect(did(world, "submitted_sessions", "select")).toHaveLength(0);
    expect(wroteNothing(world)).toBe(true);
    expect(world.events).toHaveLength(2);
  });

  it("받은 제출은 시도와 수락을 한 행씩 남긴다", async () => {
    const world = makeWorld();

    const response = await submit();

    expect(response.status).toBe(200);
    expect(world.events).toMatchObject([
      { outcome: "attempt", user_id: "u1" },
      {
        outcome: "accepted",
        user_id: "u1",
        device_id: DEVICE,
        cli_version: "2.3.4",
        submission_source: "cli",
        detail: { daysSubmitted: 1, daysWritten: 1 },
      },
    ]);
  });

  it("거절된 제출은 시도와 거절을 한 행씩 남긴다", async () => {
    const world = makeWorld({
      ledger: new Map([[hash("b"), { user_id: "u2", device_id: null }]]),
    });

    const response = await submit();

    expect(response.status).toBe(409);
    expect(world.events).toMatchObject([
      { outcome: "attempt", user_id: "u1" },
      {
        outcome: "duplicate_session",
        user_id: "u1",
        detail: { conflicting: 1, submitted: 2, owners: 1 },
      },
    ]);
  });

  it("제한 기록을 읽지도 쓰지도 못하면 제출은 받고, 제한이 걸리지 않았다고 운영에 알린다", async () => {
    const world = makeWorld({ eventsError: "Could not find the table 'public.submit_events'" });

    const response = await submit();

    expect(response.status).toBe(200);
    expect(did(world, "usage_stats", "upsert")).toHaveLength(1);
    expect(onceAlerts().map((alert) => alert.type)).toContain("submit_limit_unavailable");
  });

  it("날짜 형식이 틀리면 400 이고 사용량을 쓰지 않는다", async () => {
    const world = makeWorld();

    const response = await submit({ dailyUsage: [{ date: "18-11-2026", tokens: 1, cost: 0 }] });

    expect(response.status).toBe(400);
    expect(did(world, "usage_stats", "upsert")).toHaveLength(0);
    expect(did(world, "users", "update")).toHaveLength(0);
  });
});
