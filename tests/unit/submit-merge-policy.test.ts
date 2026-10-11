import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { earliestSubmittedDate, floorSessionsToStored } from "@/lib/utils/submit-merge-policy";

// 세션 정의 변경(PR #33: 서브에이전트 전사는 세션으로 안 셈) 뒤의 재제출은 같은 날짜에
// 더 낮은 sessions 를 보낼 수 있다. 저장값보다 낮으면 저장값을 유지하고, 높으면 새 값을 쓴다.
describe("floorSessionsToStored", () => {
  const records = [
    { date: "2026-10-01", sessions: 3, total_tokens: 100, device_id: "dev-a" },
    { date: "2026-10-02", sessions: 9, total_tokens: 200, device_id: "dev-a" },
    { date: "2026-10-03", sessions: 0, total_tokens: 50, device_id: "dev-a" },
  ];
  const stored = new Map([
    ["2026-10-01", 7],
    ["2026-10-02", 4],
  ]);
  const lookup = (date: string) => stored.get(date) ?? 0;

  it("keeps the stored count when the resubmitted count is lower", () => {
    expect(floorSessionsToStored(records, lookup)[0].sessions).toBe(7);
  });

  it("takes the new count when it is higher", () => {
    expect(floorSessionsToStored(records, lookup)[1].sessions).toBe(9);
  });

  it("leaves dates without a stored row untouched", () => {
    expect(floorSessionsToStored(records, lookup)[2].sessions).toBe(0);
  });

  it("does not touch other fields or the input array", () => {
    const out = floorSessionsToStored(records, lookup);
    expect(out[0]).toMatchObject({ date: "2026-10-01", total_tokens: 100, device_id: "dev-a" });
    expect(records[0].sessions).toBe(3);
    expect(out[1]).toBe(records[1]);
  });
});

// 라우트 배선 검사(텍스트 기반): 라우트는 Supabase 없이 실행할 수 없어 호출 형태만 고정한다.
// 프리페치가 sessions 를 읽어야 바닥값이 생기고, 두 upsert 경로(기기별·레거시) 모두 거쳐야 한다.
describe("submit route wiring", () => {
  const src = readFileSync(path.resolve(__dirname, "../../app/api/cli/submit/route.ts"), "utf-8");

  it("reads stored sessions in the prefetch", () => {
    expect(src).toContain('.select("date, total_tokens, cost_usd, sessions, device_id")');
  });

  it("floors sessions on both the device-aware and the legacy upsert path", () => {
    expect(src.match(/floorSessionsToStored\(/g)?.length).toBe(2);
  });

  // Supabase 는 응답 1회 1000행 상한. 무제한 읽기는 최신 날짜를 조용히 잘라 가드를 무력화한다.
  it("bounds the stored-row prefetch to the submitted range and pages it", () => {
    expect(src).toContain('.gte("date", prefetchFromDate)');
    expect(src).toContain(".range(from, from + STORED_PAGE - 1)");
  });

  it("refuses the submission when stored rows cannot be read", () => {
    const prefetch = src.slice(
      src.indexOf("const prefetchFromDate"),
      src.indexOf("const previousDailyAggregated")
    );
    expect(prefetch).toContain("status: 503");
  });
});

describe("earliestSubmittedDate", () => {
  it("picks the earliest well-formed date", () => {
    expect(earliestSubmittedDate(["2026-10-03", "2026-09-28", "2026-10-01"], "2026-10-12")).toBe(
      "2026-09-28"
    );
  });

  it("ignores malformed, null and non-string entries", () => {
    expect(
      earliestSubmittedDate(
        [null, undefined, 42, "2026-9-1", "yesterday", "2026-10-02"],
        "2026-10-12"
      )
    ).toBe("2026-10-02");
  });

  it("falls back when nothing is usable", () => {
    expect(earliestSubmittedDate([], "2026-10-12")).toBe("2026-10-12");
    expect(earliestSubmittedDate(["nope"], "2026-10-12")).toBe("2026-10-12");
  });
});
