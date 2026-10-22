import { describe, expect, it } from "vitest";
import { createUsageAccumulator } from "../src/lib/usage-accumulator";

interface LineSpec {
  id?: string;
  req?: string;
  session?: string;
  ts?: string;
  model?: string;
  input?: number;
  output?: number;
  cw?: number;
  cw1h?: number;
  cr?: number;
  speed?: "fast" | "standard";
  sidechain?: boolean;
  iterations?: unknown[];
  type?: string;
  version?: string;
}

function line(o: LineSpec): Record<string, unknown> {
  return {
    type: o.type ?? "assistant",
    timestamp: o.ts ?? "2026-10-01T10:00:00.000Z",
    sessionId: o.session ?? "s1",
    ...(o.req !== undefined ? { requestId: o.req } : {}),
    ...(o.sidechain !== undefined ? { isSidechain: o.sidechain } : {}),
    ...(o.version !== undefined ? { version: o.version } : {}),
    message: {
      ...(o.id !== undefined ? { id: o.id } : {}),
      model: o.model ?? "claude-opus-4-8",
      usage: {
        input_tokens: o.input ?? 0,
        output_tokens: o.output ?? 0,
        cache_creation_input_tokens: o.cw ?? 0,
        cache_read_input_tokens: o.cr ?? 0,
        ...(o.cw1h !== undefined
          ? {
              cache_creation: {
                ephemeral_5m_input_tokens: (o.cw ?? 0) - o.cw1h,
                ephemeral_1h_input_tokens: o.cw1h,
              },
            }
          : {}),
        ...(o.speed ? { speed: o.speed } : {}),
        ...(o.iterations ? { iterations: o.iterations } : {}),
      },
    },
  };
}

const A = { sessionKey: "/p/a.jsonl", projectName: "proj" };
const B = { sessionKey: "/p/b.jsonl", projectName: "proj" };

describe("one response written as several lines", () => {
  it("counts it once, at its largest line (ccusage)", () => {
    const acc = createUsageAccumulator();
    const base = { id: "msg_1", req: "req_1", cr: 1000 };
    expect(acc.add(line({ ...base, output: 8 }), A)).toBe(true);
    expect(acc.add(line({ ...base, output: 8 }), A)).toBe(false);
    expect(acc.add(line({ ...base, output: 8 }), A)).toBe(false);
    expect(acc.add(line({ ...base, output: 534 }), A)).toBe(true);

    const day = acc.result().daily.get("2026-10-01");
    expect(day?.outputTokens).toBe(534);
    expect(day?.cacheReadTokens).toBe(1000);
    expect(day?.tokens).toBe(1534);
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

  it("adds a larger line's difference to the day and model first seen", () => {
    const acc = createUsageAccumulator();
    acc.add(line({ id: "msg_1", req: "req_1", ts: "2026-10-01T23:59:59.000Z", output: 8 }), A);
    acc.add(line({ id: "msg_1", req: "req_1", ts: "2026-10-02T00:00:01.000Z", output: 534 }), A);
    const { daily } = acc.result();
    expect(daily.get("2026-10-01")?.models).toEqual({ "claude-opus-4-8": 534 });
    expect(daily.has("2026-10-02")).toBe(false);
  });

  it("prefers the line that carries speed when the totals tie", () => {
    const acc = createUsageAccumulator();
    acc.add(line({ id: "msg_1", req: "req_1", output: 10 }), A);
    expect(acc.add(line({ id: "msg_1", req: "req_1", output: 10, speed: "fast" }), A)).toBe(true);
    const split = acc.result().daily.get("2026-10-01")?.modelTokens["claude-opus-4-8"];
    expect(split?.outputTokens).toBe(10);
    expect(split?.fast.outputTokens).toBe(10);
  });
});

describe("dedup keys (ccusage)", () => {
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

  it("collapses a /btw sidechain replay of a parent message", () => {
    const acc = createUsageAccumulator();
    const ts = "2026-10-01T10:00:00.000Z";
    acc.add(line({ id: "msg_p", req: "req_1", ts, output: 7 }), A);
    expect(acc.add(line({ id: "msg_p", req: "req_2", ts, output: 7, sidechain: true }), B)).toBe(
      false
    );
    acc.add(line({ id: "msg_q", req: "req_3", ts, output: 3, sidechain: true }), B);
    // The parent arriving after its replay takes over (main chain wins), without adding.
    expect(acc.add(line({ id: "msg_q", req: "req_4", ts, output: 3 }), A)).toBe(true);
    expect(acc.result().total.outputTokens).toBe(10);
  });

  it("keeps a sidechain line with a new request id and a new time", () => {
    const acc = createUsageAccumulator();
    acc.add(line({ id: "msg_p", req: "req_1", ts: "2026-10-01T10:00:00.000Z", output: 7 }), A);
    acc.add(
      line({
        id: "msg_p",
        req: "req_2",
        ts: "2026-10-01T11:00:00.000Z",
        output: 7,
        sidechain: true,
      }),
      B
    );
    expect(acc.result().total.outputTokens).toBe(14);
  });

  it("prefers the main-chain copy over a sidechain one, whatever the totals", () => {
    const acc = createUsageAccumulator();
    acc.add(line({ id: "msg_1", req: "req_1", output: 534, sidechain: true }), B);
    expect(acc.add(line({ id: "msg_1", req: "req_1", output: 8 }), A)).toBe(true);
    expect(acc.result().total.outputTokens).toBe(8);
  });

  it.each([
    ["an empty request id", { req: "" }],
    ["an empty message id", { id: "" }],
    ["an empty model", { model: "" }],
    ["an empty session id", { session: "" }],
    ["a version that is not semver", { version: "dev" }],
  ])("skips a line with %s, as ccusage does", (_label, spec: LineSpec) => {
    const acc = createUsageAccumulator();
    expect(acc.add(line({ id: "msg_1", req: "req_1", output: 5, ...spec }), A)).toBe(false);
    expect(acc.result().total.tokens).toBe(0);
  });
});

describe("token shares", () => {
  it("records the 1-hour part of cache writes, capped at the cache writes", () => {
    const acc = createUsageAccumulator();
    acc.add(line({ id: "msg_1", req: "r1", cw: 1000, cw1h: 600 }), A);
    acc.add(line({ id: "msg_2", req: "r2", cw: 500 }), A);
    acc.add(line({ id: "msg_3", req: "r3", cw: 100, cw1h: 300 }), A);
    const day = acc.result().daily.get("2026-10-01");
    expect(day?.cacheWriteTokens).toBe(1600);
    expect(day?.cacheWrite1hTokens).toBe(700);
    expect(day?.modelTokens["claude-opus-4-8"]?.cacheWrite1hTokens).toBe(700);
  });

  it("puts a fast-mode response into its model's fast share", () => {
    const acc = createUsageAccumulator();
    acc.add(line({ id: "msg_1", req: "r1", input: 3, output: 4, speed: "fast" }), A);
    acc.add(line({ id: "msg_2", req: "r2", input: 10, speed: "standard" }), A);
    const split = acc.result().daily.get("2026-10-01")?.modelTokens["claude-opus-4-8"];
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
    const iterations = [
      { type: "message", model: null, input_tokens: 2, output_tokens: 3 },
      {
        type: "advisor_message",
        model: "claude-opus-5-5",
        input_tokens: 10,
        output_tokens: 2,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
      },
    ];
    const parent = { id: "msg_1", req: "r1", input: 2, output: 3, iterations };
    expect(acc.add(line(parent), A)).toBe(true);
    expect(acc.add(line(parent), A)).toBe(false);
    const day = acc.result().daily.get("2026-10-01");
    expect(day?.models).toEqual({ "claude-opus-4-8": 5, "claude-opus-5-5": 12 });
    expect(day?.tokens).toBe(17);
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

  it("ignores lines without usage", () => {
    const acc = createUsageAccumulator();
    expect(acc.add({ type: "user", message: { content: "hi" } }, A)).toBe(false);
    expect(acc.add("not json", A)).toBe(false);
    expect(acc.result().total.tokens).toBe(0);
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

  it("counts a line without a timestamp in the totals but on no day", () => {
    const acc = createUsageAccumulator();
    const event = line({ id: "msg_1", req: "r1", output: 9 });
    delete event.timestamp;
    acc.add(event, A);
    expect(acc.result().total.outputTokens).toBe(9);
    expect(acc.result().daily.size).toBe(0);
  });
});
