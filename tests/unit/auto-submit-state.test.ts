import { describe, expect, it } from "vitest";
import {
  AUTO_SUBMIT_LABELS,
  AUTO_SUBMIT_STALE_HOURS,
  AUTO_SUBMIT_STATES,
  deriveAutoSubmitState,
  formatAutoSubmitAge,
  type AutoSubmitSignals,
} from "@/lib/admin/auto-submit-state";

const NOW = new Date("2026-10-19T12:00:00Z");
const HOUR = 60 * 60 * 1000;
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * HOUR).toISOString();
const signals = (s: Partial<AutoSubmitSignals>): AutoSubmitSignals => ({
  auto_sync_enabled: null,
  auto_sync_reported_at: null,
  last_scheduled_submit_at: null,
  ...s,
});

describe("관리자 표 자동 제출 상태 판정", () => {
  it("옛 CLI(보고도 예약 제출도 없음)는 미확인", () => {
    expect(deriveAutoSubmitState(signals({}), NOW)).toBe("unknown");
    // 열이 false 로만 차 있던 2.3.0 시절 기본값도 미확인 — 끔으로 오판하지 않는다
    expect(deriveAutoSubmitState(signals({ auto_sync_enabled: false }), NOW)).toBe("unknown");
  });

  it("끔으로 보고하면 예약 제출 흔적이 최근이어도 끔", () => {
    const s = signals({
      auto_sync_enabled: false,
      auto_sync_reported_at: hoursAgo(1),
      last_scheduled_submit_at: hoursAgo(2),
    });
    expect(deriveAutoSubmitState(s, NOW)).toBe("off");
  });

  it("켬으로 보고하고 아직 첫 실행 전이면 켬 (첫 실행은 최대 하루 뒤)", () => {
    const s = signals({ auto_sync_enabled: true, auto_sync_reported_at: hoursAgo(1) });
    expect(deriveAutoSubmitState(s, NOW)).toBe("on");
  });

  it("켠 지 3일이 넘도록 실행이 없으면 켬·멈춤", () => {
    const s = signals({ auto_sync_enabled: true, auto_sync_reported_at: hoursAgo(5 * 24) });
    expect(deriveAutoSubmitState(s, NOW)).toBe("stalled");
  });

  // 정책: 예약 작업은 하루 1회라 하루 이틀 기기가 꺼져 있던 건 봐준다 → 멈춤 기준 3일.
  // 상수를 되돌려 재면 순환 측정이 되므로 시각은 숫자로 박는다(뮤테이션 72→48 에 RED 확인)
  it("멈춤 기준은 3일: 2.5일 전 실행은 켬, 3일 하고 1분 전은 멈춤", () => {
    expect(AUTO_SUBMIT_STALE_HOURS).toBe(72);
    const base = { auto_sync_enabled: true, auto_sync_reported_at: hoursAgo(10 * 24) };
    expect(
      deriveAutoSubmitState(signals({ ...base, last_scheduled_submit_at: hoursAgo(60) }), NOW)
    ).toBe("on");
    expect(
      deriveAutoSubmitState(signals({ ...base, last_scheduled_submit_at: hoursAgo(72) }), NOW)
    ).toBe("on");
    const justOver = new Date(NOW.getTime() - 72 * HOUR - 60_000).toISOString();
    expect(
      deriveAutoSubmitState(signals({ ...base, last_scheduled_submit_at: justOver }), NOW)
    ).toBe("stalled");
  });

  it("보고 없이 예약 제출만 있어도 서버가 켬으로 기록하므로 켬", () => {
    const s = signals({ auto_sync_enabled: true, last_scheduled_submit_at: hoursAgo(3) });
    expect(deriveAutoSubmitState(s, NOW)).toBe("on");
  });

  it("멈춘 뒤 autosubmit on 을 다시 돌리면(재보고) 시계가 초기화돼 켬", () => {
    const s = signals({
      auto_sync_enabled: true,
      auto_sync_reported_at: hoursAgo(1),
      last_scheduled_submit_at: hoursAgo(4 * 24),
    });
    expect(deriveAutoSubmitState(s, NOW)).toBe("on");
  });

  it("깨진 시각 문자열은 없는 것으로 본다", () => {
    const s = signals({
      auto_sync_enabled: true,
      auto_sync_reported_at: "not-a-date",
      last_scheduled_submit_at: "",
    });
    expect(deriveAutoSubmitState(s, NOW)).toBe("unknown");
  });

  it("상태마다 라벨이 있고 서로 다르다", () => {
    const labels = AUTO_SUBMIT_STATES.map((s) => AUTO_SUBMIT_LABELS[s]);
    expect(labels.every((l) => l.length > 0)).toBe(true);
    expect(new Set(labels).size).toBe(AUTO_SUBMIT_STATES.length);
  });

  it("경과 표시: 분·시간·일, 음수는 방금", () => {
    expect(formatAutoSubmitAge(-5000)).toBe("방금");
    expect(formatAutoSubmitAge(30_000)).toBe("방금");
    expect(formatAutoSubmitAge(5 * 60_000)).toBe("5분 전");
    expect(formatAutoSubmitAge(3 * HOUR)).toBe("3시간 전");
    expect(formatAutoSubmitAge(50 * HOUR)).toBe("2일 전");
  });
});
