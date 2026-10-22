import { describe, expect, it } from "vitest";
import { createUsageAccumulator } from "../src/lib/usage-accumulator";

interface LineSpec {
  id?: string | null;
  req?: string | null;
  session?: string | null;
  ts?: string | null;
  model?: string | null;
  input?: number;
  output?: number;
  cw?: number;
  cache?: [fiveMinute: number, oneHour: number];
  cr?: number;
  speed?: string;
  sidechain?: boolean;
  iterations?: unknown[];
  type?: string;
  version?: string;
}

function line(o: LineSpec): Record<string, unknown> {
  return {
    type: o.type ?? "assistant",
    ...(o.ts !== null ? { timestamp: o.ts ?? "2026-10-01T10:00:00.000Z" } : {}),
    sessionId: o.session === undefined ? "s1" : o.session,
    ...(o.req !== undefined ? { requestId: o.req } : {}),
    ...(o.sidechain !== undefined ? { isSidechain: o.sidechain } : {}),
    ...(o.version !== undefined ? { version: o.version } : {}),
    message: {
      ...(o.id !== undefined ? { id: o.id } : {}),
      model: o.model === undefined ? "claude-opus-4-8" : o.model,
      usage: {
        input_tokens: o.input ?? 0,
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
    expect(acc.result().lastTimestamp).toBe("2026-10-01T23:59:59.000Z");
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
  it("collapses a requestless Anthropic id within a session, not across sessions", () => {
    const acc = createUsageAccumulator();
    acc.add(line({ id: "msg_x", session: "s1", ts: "2026-10-01T10:00:00.000Z", output: 5 }), A);
    acc.add(line({ id: "msg_x", session: "s1", ts: "2026-10-01T10:00:01.000Z", output: 5 }), A);
    acc.add(line({ id: "msg_x", session: "s2", ts: "2026-10-01T10:00:02.000Z", output: 5 }), B);
    expect(acc.result().total.outputTokens).toBe(10);
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
  ])("skips a line with %s", (_label, spec) => {
    const acc = createUsageAccumulator();
    expect(acc.add(line({ id: "msg_1", req: "req_1", output: 5, ...spec }), A)).toBe(false);
    expect(acc.result().total.tokens).toBe(0);
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

describe("buckets and bounds", () => {
  it("leaves out lines before the cutoff, with the rest of their response", () => {
    const acc = createUsageAccumulator({ cutoff: "2026-10-01T00:00:00.000Z" });
    acc.add(line({ id: "msg_1", req: "r1", ts: "2026-09-30T23:59:59.000Z", output: 8 }), A);
    expect(
      acc.add(line({ id: "msg_1", req: "r1", ts: "2026-10-01T00:00:01.000Z", output: 534 }), A)
    ).toBe(false);
    acc.add(line({ id: "msg_2", req: "r2", ts: "2026-10-01T09:00:00.000Z", output: 5 }), A);
    expect(acc.result().total.outputTokens).toBe(5);
  });

  it("tracks sessions per day, projects, and the first and last timestamps", () => {
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
    expect(r.firstTimestamp).toBe("2026-10-01T05:00:00.000Z");
    expect(r.lastTimestamp).toBe("2026-10-02T01:00:00.000Z");
  });
});
