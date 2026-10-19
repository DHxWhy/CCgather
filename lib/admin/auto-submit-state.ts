// 관리자 화면 "자동 제출" 열의 상태 판정 (SSOT). import 0 — 클라이언트 페이지와
// 서버 라우트가 같이 쓴다(서버 전용 모듈을 끌어오면 next build 가 깨진다).
//
// 신호 셋(마이그 081):
//   auto_sync_reported_at  CLI 가 `autosubmit on/off` 결과를 마지막으로 보고한 시각
//   auto_sync_enabled      그 보고의 값(켬=true, 끔=false). 예약 제출이 오면 켬으로 본다
//   last_scheduled_submit_at  `submit --scheduled` 가 마지막으로 실제 제출한 시각
// 2.3.0 이하 CLI 는 셋 다 안 보내므로 "미확인".

export const AUTO_SUBMIT_STATES = ["on", "stalled", "off", "unknown"] as const;
export type AutoSubmitState = (typeof AUTO_SUBMIT_STATES)[number];

// 예약 작업은 매일 1회라 하루 이틀은 기기가 꺼져 있었을 수 있다. 3일 넘게 소식이
// 없으면 "켬·멈춤"(켰다고 보고했지만 실제론 안 도는 상태)으로 본다.
export const AUTO_SUBMIT_STALE_HOURS = 72;

export interface AutoSubmitSignals {
  auto_sync_enabled: boolean | null;
  auto_sync_reported_at: string | null;
  last_scheduled_submit_at: string | null;
}

export const AUTO_SUBMIT_LABELS: Record<AutoSubmitState, string> = {
  on: "켬",
  stalled: "켬·멈춤",
  off: "끔",
  unknown: "미확인",
};

function parseTime(iso: string | null): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : t;
}

export function deriveAutoSubmitState(signals: AutoSubmitSignals, now: Date): AutoSubmitState {
  const reportedAt = parseTime(signals.auto_sync_reported_at);
  const lastRun = parseTime(signals.last_scheduled_submit_at);

  // 한 번도 보고가 없으면(옛 CLI) 예약 제출 흔적이 있어도 판단할 근거가 없다
  if (reportedAt === null && lastRun === null) return "unknown";
  if (signals.auto_sync_enabled !== true) return "off";

  // 켰는데 아직 첫 실행 전이면 "켬": 첫 실행은 보고 뒤 최대 하루 걸린다.
  // 켠 지 3일이 지나도록 실행이 없으면 "켬·멈춤"
  const lastSignal = Math.max(
    lastRun ?? Number.NEGATIVE_INFINITY,
    reportedAt ?? Number.NEGATIVE_INFINITY
  );
  const ageMs = now.getTime() - lastSignal;
  return ageMs > AUTO_SUBMIT_STALE_HOURS * 60 * 60 * 1000 ? "stalled" : "on";
}

// 표에 붙는 짧은 경과 표시. 음수(시계 어긋남)는 "방금"
export function formatAutoSubmitAge(ageMs: number): string {
  const minutes = Math.floor(ageMs / 60_000);
  if (minutes < 1) return "방금";
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  return `${Math.floor(hours / 24)}일 전`;
}
