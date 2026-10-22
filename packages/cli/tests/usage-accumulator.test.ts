import { describe, expect, it } from "vitest";
import { createUsageAccumulator } from "../src/lib/usage-accumulator";

interface LineSpec {
  id?: string | null;
  req?: string | null;
  session?: string | null;
  ts?: string | null;
  model?: string | null;
  input?: number | null; // null leaves input_tokens out
  output?: number;
  cw?: number;
  cache?: [fiveMinute: number, oneHour: number];
  cr?: number;
  speed?: string;
  sidechain?: unknown;
  iterations?: unknown[];
  type?: string;
  version?: string | null;
  top?: Record<string, unknown>; // more top-level fields
  usageExtra?: Record<string, unknown>; // more usage fields
}

function line(o: LineSpec): Record<string, unknown> {
  return {
    type: o.type ?? "assistant",
    ...(o.ts !== null ? { timestamp: o.ts ?? "2026-10-01T10:00:00.000Z" } : {}),
    sessionId: o.session === undefined ? "s1" : o.session,
    ...(o.req !== undefined ? { requestId: o.req } : {}),
    ...(o.sidechain !== undefined ? { isSidechain: o.sidechain } : {}),
    ...(o.version !== undefined ? { version: o.version } : {}),
    ...o.top,
    message: {
      ...(o.id !== undefined ? { id: o.id } : {}),
      model: o.model === undefined ? "claude-opus-4-8" : o.model,
      usage: {
        ...(o.input === null ? {} : { input_tokens: o.input ?? 0 }),
        output_tokens: o.output ?? 0,
        cache_creation_input_tokens: o.cw ?? 0,
        cache_read_input_tokens: o.cr ?? 0,
        ...(o.cache
          ? {
              cache_creation: {
                ephemeral_5m_input_tokens: o.cache[0],
                ephemeral_1h_input_tokens: o.cache[1],
              },
            }
          : {}),
        ...(o.speed ? { speed: o.speed } : {}),
        ...(o.iterations ? { iterations: o.iterations } : {}),
        ...o.usageExtra,
      },
    },
  };
}

const advisor = (model: string, input: number, output: number, extra = {}) => ({
  type: "advisor_message",
  model,
  input_tokens: input,
  output_tokens: output,
  cache_creation_input_tokens: 0,
  cache_read_input_tokens: 0,
  ...extra,
});
const ownIteration = { type: "message", model: null, input_tokens: 2, output_tokens: 3 };

const A = { sessionKey: "/p/a.jsonl", projectName: "proj" };
const B = { sessionKey: "/p/b.jsonl", projectName: "proj" };
const day = (acc: ReturnType<typeof createUsageAccumulator>, date = "2026-10-01") =>
  acc.result().daily.get(date);

describe("one response written as several lines", () => {
  it("counts it once, at its largest line (ccusage)", () => {
    const acc = createUsageAccumulator();
    const base = { id: "msg_1", req: "req_1", cr: 1000 };
    expect(acc.add(line({ ...base, output: 8 }), A)).toBe(true);
    expect(acc.add(line({ ...base, output: 8 }), A)).toBe(false);
    expect(acc.add(line({ ...base, output: 8 }), A)).toBe(false);
    expect(acc.add(line({ ...base, output: 534 }), A)).toBe(true);

    expect(day(acc)?.outputTokens).toBe(534);
    expect(day(acc)?.cacheReadTokens).toBe(1000);
    expect(day(acc)?.tokens).toBe(1534);
    expect(acc.result().total.tokens).toBe(1534);
  });

  it("keeps the first line when a later one is smaller", () => {
    const acc = createUsageAccumulator();
    acc.add(line({ id: "msg_1", req: "req_1", output: 534 }), A);
    expect(acc.add(line({ id: "msg_1", req: "req_1", output: 8 }), A)).toBe(false);
    expect(acc.result().total.outputTokens).toBe(534);
  });

  it("counts a response found in two files once", () => {
    const acc = createUsageAccumulator();
    acc.add(line({ id: "msg_1", req: "req_1", session: "s1", output: 8 }), A);
    acc.add(line({ id: "msg_1", req: "req_1", session: "s2", output: 534 }), B);
    expect(acc.result().total.outputTokens).toBe(534);
  });

  it("stays on the day and model first seen (not ccusage: moving it could count it twice)", () => {
    const acc = createUsageAccumulator();
    acc.add(
      line({
        id: "msg_1",
        req: "req_1",
        ts: "2026-10-01T23:59:59.000Z",
        model: "first",
        output: 8,
      }),
      A
    );
    acc.add(
      line({
        id: "msg_1",
        req: "req_1",
        ts: "2026-10-02T00:00:01.000Z",
        model: "second",
        output: 534,
      }),
      A
    );
    expect(day(acc)?.models).toEqual({ first: 534 });
    expect(acc.result().daily.has("2026-10-02")).toBe(false);
  });

  it("prefers the line that carries speed when the totals tie", () => {
    const acc = createUsageAccumulator();
    acc.add(line({ id: "msg_1", req: "req_1", output: 10 }), A);
    expect(acc.add(line({ id: "msg_1", req: "req_1", output: 10, speed: "fast" }), A)).toBe(true);
    const split = day(acc)?.modelTokens["claude-opus-4-8"];
    expect(split?.outputTokens).toBe(10);
    expect(split?.fast.outputTokens).toBe(10);
  });

  it("keeps a line that states standard speed against a later fast copy of the same size (not ccusage)", () => {
    const acc = createUsageAccumulator();
    acc.add(line({ id: "msg_1", req: "req_1", output: 10 }), A);
    expect(acc.add(line({ id: "msg_1", req: "req_1", output: 10, speed: "standard" }), A)).toBe(
      true
    );
    expect(acc.add(line({ id: "msg_1", req: "req_1", output: 10, speed: "fast" }), A)).toBe(false);
    expect(day(acc)?.modelTokens["claude-opus-4-8"]?.fast.outputTokens).toBe(0);
  });

  it("takes the replaced line's fast share back while the model keeps other responses", () => {
    const acc = createUsageAccumulator();
    const fastLine = (output: number) =>
      line({
        id: "msg_1",
        req: "req_1",
        output,
        cr: 100_000,
        speed: "fast",
        model: "claude-opus-4-6",
      });
    acc.add(line({ id: "msg_0", req: "req_0", output: 1, model: "claude-opus-4-6" }), A);
    acc.add(fastLine(8), A);
    acc.add(fastLine(534), A);
    const split = day(acc)?.modelTokens["claude-opus-4-6"];
    expect(split?.outputTokens).toBe(535);
    expect(split?.fast.outputTokens).toBe(534);
    expect(split?.fast.cacheReadTokens).toBe(100_000);
  });

  it("swaps the fast share too, so it never exceeds the model's share", () => {
    const acc = createUsageAccumulator();
    acc.add(line({ id: "msg_1", req: "req_1", output: 8, speed: "fast" }), A);
    acc.add(line({ id: "msg_1", req: "req_1", output: 534, speed: "fast" }), A);
    const split = day(acc)?.modelTokens["claude-opus-4-8"];
    expect(split?.outputTokens).toBe(534);
    expect(split?.fast.outputTokens).toBe(534);
  });
});

describe("dedup keys (ccusage daily)", () => {
  // ccusage daily.rs dedupes_daily_sidechain_replay_after_cross_session_survivor_replacement
  it("matches a /btw replay in the old session after another session's copy took over", () => {
    const acc = createUsageAccumulator();
    const ts = "2026-03-20T09:46:40.000Z";
    const parent = { id: "msg-parent", req: "req-parent", ts, output: 10 };
    acc.add(line({ ...parent, session: "session-b", cr: 20 }), A);
    acc.add(line({ ...parent, session: "session-a", cr: 30 }), A);
    const replay = { ...parent, req: "req-sidechain-replay", session: "session-b", cr: 50_000 };
    expect(acc.add(line({ ...replay, sidechain: true }), A)).toBe(false);
    expect(acc.result().total.tokens).toBe(40);
  });

  it("matches it too when every line is a sidechain line", () => {
    const acc = createUsageAccumulator();
    const x = { id: "msg_x", req: "req_1", input: 1, sidechain: true };
    acc.add(line({ ...x, session: "s1", ts: "2026-10-01T10:00:00.000Z", output: 8 }), A);
    acc.add(line({ ...x, session: "s2", ts: "2026-10-01T10:00:00.000Z", output: 534 }), A);
    const replay = { ...x, req: "req_9", session: "s1", ts: "2026-10-02T08:00:00.000Z" };
    expect(acc.add(line({ ...replay, output: 534 }), A)).toBe(false);
    expect([...acc.result().daily.keys()]).toEqual(["2026-10-01"]);
    expect(acc.result().total.tokens).toBe(535);
  });

  it("collapses a requestless Anthropic id within a session, not across sessions", () => {
    const acc = createUsageAccumulator();
    acc.add(line({ id: "msg_x", session: "s1", ts: "2026-10-01T10:00:00.000Z", output: 5 }), A);
    acc.add(line({ id: "msg_x", session: "s1", ts: "2026-10-01T10:00:01.000Z", output: 5 }), A);
    acc.add(line({ id: "msg_x", session: "s2", ts: "2026-10-01T10:00:02.000Z", output: 5 }), B);
    expect(acc.result().total.outputTokens).toBe(10);
  });

  it("collapses a requestless resp_ id within a session, like msg_", () => {
    const acc = createUsageAccumulator();
    acc.add(line({ id: "resp_1", ts: "2026-10-01T10:00:00.000Z", output: 3 }), A);
    acc.add(line({ id: "resp_1", ts: "2026-10-01T10:00:05.000Z", output: 8 }), A);
    expect(acc.result().total.outputTokens).toBe(8);
  });

  it("counts a gateway id reused without a request id once per timestamp", () => {
    const acc = createUsageAccumulator();
    acc.add(line({ id: "gw-1", ts: "2026-10-01T10:00:00.000Z", output: 5 }), A);
    acc.add(line({ id: "gw-1", ts: "2026-10-01T10:00:00.000Z", output: 5 }), A);
    acc.add(line({ id: "gw-1", ts: "2026-10-01T10:05:00.000Z", output: 5 }), A);
    expect(acc.result().total.outputTokens).toBe(10);
  });

  it("counts every line that has no message id", () => {
    const acc = createUsageAccumulator();
    acc.add(line({ output: 5 }), A);
    acc.add(line({ output: 5 }), A);
    expect(acc.result().total.outputTokens).toBe(10);
  });

  it("collapses a /btw sidechain replay of a parent message, at any time or request id", () => {
    const acc = createUsageAccumulator();
    acc.add(line({ id: "msg_p", req: "req_1", ts: "2026-10-01T10:00:00.000Z", output: 7 }), A);
    expect(
      acc.add(
        line({
          id: "msg_p",
          req: "req_2",
          ts: "2026-10-01T11:00:00.000Z",
          output: 7,
          sidechain: true,
        }),
        B
      )
    ).toBe(false);
    acc.add(line({ id: "msg_q", req: "req_3", output: 3, sidechain: true }), B);
    // The parent arriving after its replay takes over (main chain wins), without adding.
    expect(
      acc.add(line({ id: "msg_q", req: "req_4", ts: "2026-10-01T12:00:00.000Z", output: 3 }), A)
    ).toBe(true);
    expect(acc.result().total.outputTokens).toBe(10);
  });

  it("keeps a sidechain line of the same message from another session", () => {
    const acc = createUsageAccumulator();
    acc.add(line({ id: "msg_p", req: "req_1", session: "s1", output: 7 }), A);
    acc.add(line({ id: "msg_p", req: "req_2", session: "s2", output: 7, sidechain: true }), B);
    expect(acc.result().total.outputTokens).toBe(14);
  });

  it("finds a replay through the other session of a cross-session copy", () => {
    const acc = createUsageAccumulator();
    acc.add(line({ id: "msg_a", req: "req_1", session: "s1", output: 7 }), A);
    acc.add(line({ id: "msg_a", req: "req_1", session: "s2", output: 7 }), B);
    acc.add(line({ id: "msg_a", req: "req_9", session: "s2", output: 7, sidechain: true }), B);
    expect(acc.result().total.outputTokens).toBe(7);
  });

  it("matches a replay route only while the response is still in that session", () => {
    const acc = createUsageAccumulator();
    const sub = (session: string, req: string | undefined, output: number) =>
      line({ id: "msg_x", req, session, output, sidechain: true });
    acc.add(
      line({ id: "msg_ref", req: "r_ref", model: "claude-sonnet-4-6", input: 1000, output: 1 }),
      A
    );
    acc.add(sub("s1", "req_b", 1), A);
    acc.add(sub("s2", "req_a", 5), A);
    acc.add(sub("s1", "req_a", 6), A);
    acc.add(sub("s2", "req_b", 3), A);
    acc.add(sub("s1", undefined, 4), A);
    // ccusage 20.0.37 on the same lines in the same order
    expect(day(acc)?.models).toEqual({ "claude-opus-4-8": 9, "claude-sonnet-4-6": 1001 });
  });

  it("lets a parent find a sidechain response through the session of an equal copy", () => {
    const acc = createUsageAccumulator();
    acc.add(line({ id: "msg_x", req: "req_x", session: "s1", output: 10, sidechain: true }), A);
    acc.add(line({ id: "msg_x", req: "req_x", session: "s2", output: 10, sidechain: true }), B);
    acc.add(line({ id: "msg_x", req: "req_main", session: "s2", output: 10 }), B);
    expect(acc.result().total.outputTokens).toBe(10);
  });

  it("re-indexes a response under the key of the line that took it over", () => {
    const acc = createUsageAccumulator();
    acc.add(line({ id: "msg_q", req: "req_s", output: 3, sidechain: true }), B);
    acc.add(line({ id: "msg_q", req: "req_m", output: 3 }), A);
    expect(acc.add(line({ id: "msg_q", req: "req_m", output: 9 }), A)).toBe(true);
    expect(acc.result().total.outputTokens).toBe(9);
  });

  it("matches an exact key only while it still describes the surviving line", () => {
    const acc = createUsageAccumulator();
    acc.add(line({ id: "msg_x", req: "req_1", output: 3, sidechain: true }), B);
    acc.add(line({ id: "msg_x", output: 4 }), A);
    expect(acc.result().total.outputTokens).toBe(4);
    expect(acc.add(line({ id: "msg_x", req: "req_1", output: 5 }), A)).toBe(true);
    expect(acc.result().total.outputTokens).toBe(9);
  });

  it("prefers the main-chain copy over a sidechain one, whatever the totals", () => {
    const acc = createUsageAccumulator();
    acc.add(line({ id: "msg_1", req: "req_1", output: 534, sidechain: true }), B);
    expect(acc.add(line({ id: "msg_1", req: "req_1", output: 8 }), A)).toBe(true);
    expect(acc.result().total.outputTokens).toBe(8);
  });
});

describe("lines ccusage leaves out", () => {
  it.each<[string, LineSpec]>([
    ["an empty request id", { req: "" }],
    ["an empty message id", { id: "" }],
    ["an empty model", { model: "" }],
    ["a null model", { model: null }],
    ["an empty session id", { session: "" }],
    ["a null session id", { session: null }],
    ["a version that is not semver", { version: "dev" }],
    ["an unknown speed", { speed: "turbo" }],
    ["negative tokens", { output: -5 }],
    ["fractional tokens", { output: 1.5 }],
    ["no timestamp", { ts: null }],
    ["a timestamp without a zone", { ts: "2026-10-01T10:00:00" }],
    ["a lowercase timestamp", { ts: "2026-10-01t10:00:00.000z" }],
    ["a timestamp with nanoseconds", { ts: "2026-10-01T10:00:00.123456789Z" }],
    ["a timestamp with one fractional digit", { ts: "2026-10-01T10:00:00.1Z" }],
    ["no input tokens", { input: null }],
    ["a sidechain flag that is not a boolean", { sidechain: "true" }],
    ["a null cwd", { top: { cwd: null } }],
    ["a null isApiErrorMessage", { top: { isApiErrorMessage: null } }],
    ["a cost that is not a number", { top: { costUSD: "0.1" } }],
    ["a cache breakdown that is not an object", { usageExtra: { cache_creation: "x" } }],
    ["a negative 1-hour cache count", { cache: [5, -1] }],
    ["a version with two parts", { version: "2.1" }],
    ["a null version", { version: null }],
    ["a null speed", { usageExtra: { speed: null } }],
    ["an offset without a colon", { ts: "2026-10-01T10:00:00+0900" }],
    ["hour 24", { ts: "2026-10-01T24:00:00Z" }],
    ["February 30", { ts: "2026-02-30T10:00:00Z" }],
    ["April 31", { ts: "2026-04-31T10:00:00Z" }],
    ["February 29 of a common year", { ts: "2026-02-29T10:00:00Z" }],
    ["February 29 of 1900", { ts: "1900-02-29T10:00:00Z" }],
    [
      "an iteration with a null speed",
      { iterations: [{ type: "message", input_tokens: 1, output_tokens: 1, speed: null }] },
    ],
    [
      "an iteration with a null cache write count",
      {
        iterations: [
          { type: "message", input_tokens: 1, output_tokens: 1, cache_creation_input_tokens: null },
        ],
      },
    ],
    [
      "an iteration with a null cache count",
      {
        iterations: [
          { type: "message", input_tokens: 1, output_tokens: 1, cache_read_input_tokens: null },
        ],
      },
    ],
  ])("skips a line with %s", (_label, spec) => {
    const acc = createUsageAccumulator();
    expect(acc.add(line({ id: "msg_1", req: "req_1", output: 5, ...spec }), A)).toBe(false);
    expect(acc.result().total.tokens).toBe(0);
  });

  it("counts a line whose isSidechain is null as a main-chain line, as ccusage does", () => {
    const acc = createUsageAccumulator();
    expect(acc.add(line({ id: "msg_1", req: "req_1", output: 5, sidechain: null }), A)).toBe(true);
    acc.add(line({ id: "msg_1", req: "req_2", output: 9, sidechain: true }), A);
    expect(acc.result().total.outputTokens).toBe(5);
  });

  // Month lengths written out here, not taken from the code under test
  it.each([
    ["2026-01", 31],
    ["2026-02", 28],
    ["2026-03", 31],
    ["2026-04", 30],
    ["2026-05", 31],
    ["2026-06", 30],
    ["2026-07", 31],
    ["2026-08", 31],
    ["2026-09", 30],
    ["2026-10", 31],
    ["2026-11", 30],
    ["2026-12", 31],
    ["2028-02", 29],
  ])("counts the last day of %s (day %i) and skips the day number after it", (month, last) => {
    const acc = createUsageAccumulator();
    const at = (d: number) => `${month}-${String(d).padStart(2, "0")}T10:00:00Z`;
    expect(acc.add(line({ id: "msg_1", req: "r1", ts: at(last), output: 2 }), A)).toBe(true);
    expect(acc.add(line({ id: "msg_2", req: "r2", ts: at(last + 1), output: 3 }), A)).toBe(false);
    expect([...acc.result().daily.keys()]).toEqual([`${month}-${last}`]);
  });

  it.each(["2028-02-29T10:00:00Z", "2000-02-29T10:00:00Z", "0000-02-29T10:00:00Z"])(
    "counts February 29 of a leap year: %s",
    (ts) => {
      const acc = createUsageAccumulator();
      expect(acc.add(line({ id: "msg_1", req: "r1", ts, output: 2 }), A)).toBe(true);
      expect(acc.result().total.outputTokens).toBe(2);
    }
  );

  it("takes the flat cache write count when cache_creation is null", () => {
    const acc = createUsageAccumulator();
    acc.add(line({ id: "msg_1", req: "r1", cw: 999, usageExtra: { cache_creation: null } }), A);
    expect(acc.result().total.cacheWriteTokens).toBe(999);
  });

  it("takes whole seconds or milliseconds, Z or an offset, by UTC day", () => {
    const acc = createUsageAccumulator();
    expect(
      acc.add(line({ id: "msg_1", req: "r1", ts: "2026-10-01T10:00:00Z", output: 1 }), A)
    ).toBe(true);
    acc.add(line({ id: "msg_2", req: "r2", ts: "2026-10-02T08:00:00+09:00", output: 2 }), A);
    expect(day(acc)?.outputTokens).toBe(3);
    expect(acc.result().daily.has("2026-10-02")).toBe(false);
  });

  it("skips a line without output tokens", () => {
    const acc = createUsageAccumulator();
    const event = line({ id: "msg_1", req: "req_1", input: 5 });
    delete (event.message as { usage: Record<string, unknown> }).usage.output_tokens;
    expect(acc.add(event, A)).toBe(false);
  });

  it("does not let a dropped line's key absorb a later valid copy", () => {
    const acc = createUsageAccumulator();
    acc.add(line({ id: "msg_1", req: "req_1", output: 534, ts: null }), A);
    acc.add(line({ id: "msg_1", req: "req_1", output: 534 }), A);
    expect(day(acc)?.outputTokens).toBe(534);
  });
});

describe("token shares", () => {
  it("counts cache writes from the 5-minute + 1-hour breakdown when it is there", () => {
    const acc = createUsageAccumulator();
    acc.add(line({ id: "msg_1", req: "r1", cw: 999, cache: [10, 20] }), A);
    acc.add(line({ id: "msg_2", req: "r2", cw: 0, cache: [0, 20_649] }), A);
    acc.add(line({ id: "msg_3", req: "r3", cw: 500 }), A);
    expect(day(acc)?.cacheWriteTokens).toBe(30 + 20_649 + 500);
    expect(day(acc)?.cacheWrite1hTokens).toBe(20 + 20_649);
    expect(day(acc)?.modelTokens["claude-opus-4-8"]?.cacheWrite1hTokens).toBe(20_669);
  });

  it("puts a fast-mode response into its model's fast share", () => {
    const acc = createUsageAccumulator();
    acc.add(line({ id: "msg_1", req: "r1", input: 3, output: 4, speed: "fast" }), A);
    acc.add(line({ id: "msg_2", req: "r2", input: 10, speed: "standard" }), A);
    const split = day(acc)?.modelTokens["claude-opus-4-8"];
    expect(split).toMatchObject({ inputTokens: 13, outputTokens: 4 });
    expect(split?.fast).toEqual({
      inputTokens: 3,
      outputTokens: 4,
      cacheWriteTokens: 0,
      cacheWrite1hTokens: 0,
      cacheReadTokens: 0,
    });
  });

  it("adds advisor iterations under the advisor's model, once per response", () => {
    const acc = createUsageAccumulator();
    const parent = {
      id: "msg_1",
      req: "r1",
      input: 2,
      output: 3,
      iterations: [ownIteration, advisor("claude-opus-5-5", 10, 2)],
    };
    expect(acc.add(line(parent), A)).toBe(true);
    expect(acc.add(line(parent), A)).toBe(false);
    expect(day(acc)?.models).toEqual({ "claude-opus-4-8": 5, "claude-opus-5-5": 12 });
    expect(day(acc)?.tokens).toBe(17);
  });

  it("numbers advisors among advisor iterations only, so a later line's extra iteration does not recount", () => {
    const acc = createUsageAccumulator();
    acc.add(line({ id: "msg_1", req: "r1", iterations: [advisor("claude-opus-5-5", 10, 2)] }), A);
    acc.add(
      line({
        id: "msg_1",
        req: "r1",
        iterations: [ownIteration, advisor("claude-opus-5-5", 10, 2)],
      }),
      A
    );
    expect(day(acc)?.models["claude-opus-5-5"]).toBe(12);
  });

  it("keeps two advisors of one response apart", () => {
    const acc = createUsageAccumulator();
    acc.add(
      line({
        id: "msg_1",
        req: "r1",
        iterations: [advisor("claude-opus-5-5", 10, 2), advisor("claude-opus-5-5", 20, 4)],
      }),
      A
    );
    expect(day(acc)?.models["claude-opus-5-5"]).toBe(36);
  });

  it("uses the advisor's own speed for its fast share", () => {
    const acc = createUsageAccumulator();
    acc.add(
      line({
        id: "msg_1",
        req: "r1",
        iterations: [advisor("claude-opus-5-5", 10, 2, { speed: "fast" })],
      }),
      A
    );
    expect(day(acc)?.modelTokens["claude-opus-5-5"]?.fast.inputTokens).toBe(10);
  });

  it.each<[string, unknown]>([
    ["an unknown speed", advisor("claude-opus-4-8", 100, 10, { speed: "turbo" })],
    [
      "a negative cache count",
      advisor("claude-opus-4-8", 100, 10, { cache_read_input_tokens: -1 }),
    ],
    ["no input tokens", { type: "message", model: null, output_tokens: 3 }],
    ["a model that is not text", { type: "message", model: 5, input_tokens: 1, output_tokens: 1 }],
    [
      "a cache breakdown that is not an object",
      advisor("claude-opus-4-8", 100, 10, { cache_creation: "x" }),
    ],
    [
      "a negative 1-hour cache count",
      advisor("claude-opus-4-8", 100, 10, {
        cache_creation: { ephemeral_5m_input_tokens: 1, ephemeral_1h_input_tokens: -1 },
      }),
    ],
  ])("drops every advisor of a line with an iteration that has %s", (_label, odd) => {
    const acc = createUsageAccumulator();
    expect(
      acc.add(
        line({
          id: "msg_1",
          req: "req_1",
          output: 5,
          iterations: [advisor("claude-sonnet-4-6", 7, 3), odd],
        }),
        A
      )
    ).toBe(true);
    expect(day(acc)?.models).toEqual({ "claude-opus-4-8": 5 });
  });

  it("reads advisors from direct lines only, not from agent-progress records", () => {
    const acc = createUsageAccumulator();
    acc.add(
      {
        type: "progress",
        sessionId: "s1",
        data: {
          message: {
            timestamp: "2026-10-01T10:00:00.000Z",
            requestId: "req_sub",
            message: {
              id: "msg_sub",
              model: "claude-haiku-4-5",
              usage: {
                input_tokens: 4,
                output_tokens: 6,
                iterations: [advisor("claude-opus-4-8", 100, 10)],
              },
            },
          },
        },
      },
      A
    );
    expect(day(acc)?.models).toEqual({ "claude-haiku-4-5": 10 });
  });

  it("lets an advisor line that states its speed take over a tie", () => {
    const acc = createUsageAccumulator();
    const withAdvisor = (extra: Record<string, unknown>) =>
      line({
        id: "msg_1",
        req: "req_1",
        output: 5,
        iterations: [advisor("claude-opus-4-6", 100, 10, extra)],
      });
    acc.add(withAdvisor({}), A);
    acc.add(withAdvisor({ speed: "fast" }), A);
    expect(day(acc)?.modelTokens["claude-opus-4-6"]?.fast.outputTokens).toBe(10);
  });

  it("drops every advisor of a line whose iterations are malformed, but counts the line", () => {
    const acc = createUsageAccumulator();
    acc.add(
      line({
        id: "msg_1",
        req: "r1",
        output: 3,
        iterations: [
          { model: "claude-opus-5-5", input_tokens: 1, output_tokens: 1 },
          advisor("claude-opus-5-5", 10, 2),
        ],
      }),
      A
    );
    expect(day(acc)?.models).toEqual({ "claude-opus-4-8": 3 });
  });
});

describe("line shapes", () => {
  it("counts an agent-progress record, and its subagent copy only once", () => {
    const acc = createUsageAccumulator();
    const progress = {
      type: "progress",
      sessionId: "s1",
      data: {
        message: {
          timestamp: "2026-10-01T10:00:00.000Z",
          requestId: "req_sub",
          isSidechain: true,
          message: {
            id: "msg_sub",
            model: "claude-haiku-4-5",
            usage: { input_tokens: 4, output_tokens: 6 },
          },
        },
      },
    };
    expect(acc.add(progress, A)).toBe(true);
    acc.add(
      line({
        id: "msg_sub",
        req: "req_sub",
        model: "claude-haiku-4-5",
        input: 4,
        output: 6,
        sidechain: true,
      }),
      B
    );
    expect(day(acc)?.models).toEqual({ "claude-haiku-4-5": 10 });
  });

  it("reads a progress record's sidechain flag and request id from data.message", () => {
    const progress = (session: string, output: number) => ({
      type: "progress",
      sessionId: session,
      data: {
        message: {
          timestamp: "2026-10-01T10:00:00.000Z",
          requestId: "req_sub",
          isSidechain: true,
          message: {
            id: "msg_sub",
            model: "claude-haiku-4-5",
            usage: { input_tokens: 0, output_tokens: output },
          },
        },
      },
    });
    const acc = createUsageAccumulator();
    acc.add(progress("s1", 5), A);
    acc.add(
      line({
        id: "msg_sub",
        req: "req_sub",
        model: "claude-haiku-4-5",
        output: 9,
        sidechain: true,
      }),
      A
    );
    expect(acc.result().total.outputTokens).toBe(9);

    const other = createUsageAccumulator();
    other.add(progress("s1", 5), A);
    other.add(
      line({
        id: "msg_sub",
        req: "req_sub",
        session: "s2",
        model: "claude-haiku-4-5",
        output: 5,
        sidechain: true,
      }),
      B
    );
    expect(other.result().total.outputTokens).toBe(5);
  });

  it("does not check an agent-progress record's own version", () => {
    const acc = createUsageAccumulator();
    const progress = {
      type: "progress",
      sessionId: "s1",
      version: "dev",
      data: {
        message: {
          timestamp: "2026-10-01T10:00:00.000Z",
          requestId: "req_sub",
          message: {
            id: "msg_sub",
            model: "claude-haiku-4-5",
            usage: { input_tokens: 4, output_tokens: 6 },
          },
        },
      },
    };
    expect(acc.add(progress, A)).toBe(true);
  });

  it("reads a usage line whatever its type, as ccusage does", () => {
    const acc = createUsageAccumulator();
    expect(acc.add(line({ id: "msg_1", req: "r1", output: 5, type: "something-new" }), A)).toBe(
      true
    );
  });

  it("ignores lines without usage", () => {
    const acc = createUsageAccumulator();
    expect(acc.add({ type: "user", message: { content: "hi" } }, A)).toBe(false);
    expect(acc.add("not json", A)).toBe(false);
    expect(acc.result().total.tokens).toBe(0);
  });
});

describe("a /btw replay read before its parent", () => {
  // subagents/ sorts before the transcript it sits next to, so the replay comes first.
  const replay = (ts: string) =>
    line({ id: "msg_p", req: "req_replay", ts, output: 7, cr: 1000, sidechain: true });
  const parent = line({
    id: "msg_p",
    req: "req_p",
    ts: "2026-10-01T10:00:00.000Z",
    output: 7,
    cr: 1000,
  });

  it("puts the response back on the parent's day when the parent's line takes over", () => {
    const acc = createUsageAccumulator();
    acc.add(replay("2026-10-02T08:00:00.000Z"), B);
    expect(acc.add(parent, A)).toBe(true);
    expect(day(acc)?.tokens).toBe(1007);
    expect(acc.result().daily.has("2026-10-02")).toBe(false);
  });

  it("leaves no empty model or day behind", () => {
    const acc = createUsageAccumulator();
    acc.add(replay("2026-10-02T08:00:00.000Z"), B);
    const answer = line({
      id: "msg_a",
      req: "req_a",
      ts: "2026-10-02T08:00:01.000Z",
      model: "claude-sonnet-4-6",
      output: 30,
      sidechain: true,
    });
    acc.add(answer, B);
    acc.add(parent, A);
    const replayDay = acc.result().daily.get("2026-10-02");
    expect(replayDay?.models).toEqual({ "claude-sonnet-4-6": 30 });
    expect(Object.keys(replayDay?.modelTokens ?? {})).toEqual(["claude-sonnet-4-6"]);
  });

  it("moves it to the parent's model and project too", () => {
    const acc = createUsageAccumulator();
    acc.add(
      line({
        id: "msg_p",
        req: "req_replay",
        ts: "2026-10-02T08:00:00.000Z",
        model: "claude-haiku-4-5",
        output: 7,
        sidechain: true,
      }),
      { sessionKey: "/q/aside.jsonl", projectName: "elsewhere" }
    );
    acc.add(line({ id: "msg_p", req: "req_p", ts: "2026-10-01T10:00:00.000Z", output: 7 }), A);
    expect(day(acc)?.models).toEqual({ "claude-opus-4-8": 7 });
    expect(acc.result().projects.has("elsewhere")).toBe(false);
    expect(acc.result().projects.get("proj")?.tokens).toBe(7);
    expect([...(day(acc)?.sessions ?? [])]).toEqual(["/p/a.jsonl"]);
  });

  it("takes the moved response's session off the replay's day", () => {
    const acc = createUsageAccumulator();
    acc.add(replay("2026-10-02T08:00:00.000Z"), B);
    const other = line({ id: "msg_o", req: "req_o", ts: "2026-10-02T09:00:00.000Z", output: 3 });
    acc.add(other, { sessionKey: "/q/c.jsonl", projectName: "proj" });
    acc.add(parent, A);
    expect([...(acc.result().daily.get("2026-10-02")?.sessions ?? [])]).toEqual(["/q/c.jsonl"]);
  });

  it("keeps a sidechain response on the day first seen when a larger sidechain line crosses midnight", () => {
    const acc = createUsageAccumulator();
    const sub = (ts: string, output: number) =>
      line({ id: "msg_s", req: "req_s", ts, output, sidechain: true });
    acc.add(sub("2026-10-01T23:59:59.000Z", 8), B);
    acc.add(sub("2026-10-02T00:00:01.000Z", 534), B);
    expect(day(acc)?.outputTokens).toBe(534);
    expect(acc.result().daily.has("2026-10-02")).toBe(false);
  });

  it("leaves the response out when the parent's day is before the cutoff", () => {
    const acc = createUsageAccumulator({ cutoff: "2026-10-02T00:00:00.000Z" });
    acc.add(replay("2026-10-03T08:00:00.000Z"), B);
    expect(acc.add(parent, A)).toBe(false);
    expect(acc.result().total.tokens).toBe(0);
  });
});

describe("buckets and bounds", () => {
  it("compares times as instants, so an offset timestamp is placed and cut off correctly", () => {
    const cut = createUsageAccumulator({ cutoff: "2026-10-01T00:00:00.000Z" });
    // 08:00 at +09:00 is 23:00 UTC the day before the cutoff
    expect(
      cut.add(line({ id: "msg_1", req: "r1", ts: "2026-10-01T08:00:00+09:00", output: 4 }), A)
    ).toBe(false);

    const acc = createUsageAccumulator();
    acc.add(line({ id: "msg_1", req: "r1", ts: "2026-10-01T23:30:00Z", output: 1 }), A);
    acc.add(line({ id: "msg_2", req: "r2", ts: "2026-10-02T08:00:00+09:00", output: 1 }), A);
    // 08:00 at +09:00 on the 2nd is 23:00 UTC on the 1st
    expect([...acc.result().daily.keys()]).toEqual(["2026-10-01"]);
  });

  it("cuts off at the cutoff's instant, not at its date", () => {
    // Local midnight in Seoul is 15:00 UTC the day before
    const acc = createUsageAccumulator({ cutoff: "2026-10-01T15:00:00.000Z" });
    expect(
      acc.add(line({ id: "msg_1", req: "r1", ts: "2026-10-01T14:59:59.000Z", output: 4 }), A)
    ).toBe(false);
    expect(
      acc.add(line({ id: "msg_2", req: "r2", ts: "2026-10-01T15:00:00.000Z", output: 2 }), A)
    ).toBe(true);
    expect(acc.result().total.outputTokens).toBe(2);
  });

  it("counts a line exactly at the cutoff", () => {
    const acc = createUsageAccumulator({ cutoff: "2026-10-01T00:00:00.000Z" });
    expect(
      acc.add(line({ id: "msg_1", req: "r1", ts: "2026-10-01T00:00:00.000Z", output: 4 }), A)
    ).toBe(true);
  });

  it("leaves out lines before the cutoff, with the rest of their response", () => {
    const acc = createUsageAccumulator({ cutoff: "2026-10-01T00:00:00.000Z" });
    acc.add(line({ id: "msg_1", req: "r1", ts: "2026-09-30T23:59:59.000Z", output: 8 }), A);
    expect(
      acc.add(line({ id: "msg_1", req: "r1", ts: "2026-10-01T00:00:01.000Z", output: 534 }), A)
    ).toBe(false);
    acc.add(line({ id: "msg_2", req: "r2", ts: "2026-10-01T09:00:00.000Z", output: 5 }), A);
    expect(acc.result().total.outputTokens).toBe(5);
  });

  it("tracks sessions per day and projects", () => {
    const acc = createUsageAccumulator();
    acc.add(line({ id: "msg_1", req: "r1", ts: "2026-10-01T05:00:00.000Z", output: 1 }), A);
    acc.add(line({ id: "msg_2", req: "r2", ts: "2026-10-01T06:00:00.000Z", output: 2 }), B);
    acc.add(line({ id: "msg_3", req: "r3", ts: "2026-10-02T01:00:00.000Z", output: 4 }), {
      sessionKey: "/q/c.jsonl",
      projectName: "other",
    });
    const r = acc.result();
    expect([...(r.daily.get("2026-10-01")?.sessions ?? [])].sort()).toEqual([
      "/p/a.jsonl",
      "/p/b.jsonl",
    ]);
    expect(r.projects.get("proj")?.tokens).toBe(3);
    expect(r.projects.get("other")?.tokens).toBe(4);
  });
});
