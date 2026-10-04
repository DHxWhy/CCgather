import type { LeaderboardUser, PeriodFilter, ScopeFilter } from "@/lib/types";

/**
 * 리더보드 첫 화면 SSR 계약 — 서버 page.tsx 가 엣지 캐시된 API 를 읽어 HTML 에 담고,
 * 클라이언트가 같은 값을 초기 상태로 써서 마운트 시 재요청을 건너뛴다.
 * 이 파일은 런타임 import 가 없어야 한다(클라이언트·vitest 에서 server-only 없이 사용).
 */
export const LEADERBOARD_PAGE_SIZE = 50;
export const LEADERBOARD_DEFAULT_PERIOD: PeriodFilter = "30d";
export const LEADERBOARD_DEFAULT_SCOPE: ScopeFilter = "global";
export const SSR_ROW_COUNT = 30;

export function leaderboardFilterKey(
  period: PeriodFilter,
  scope: ScopeFilter,
  range: { start: string; end: string } | null
): string {
  return range ? `${period}|${scope}|${range.start}~${range.end}` : `${period}|${scope}`;
}

/**
 * 표에 깔린 데이터의 필터와 다를 때만 true — 같은 필터로 몇 번을 다시 불려도 결과가 같다.
 * "처음 한 번만 건너뛰기" 깃발은 StrictMode 재마운트·Fast Refresh 로 이펙트가 다시 돌면 SSR 행을
 * 지우고 재요청해, 개발 모드에서 부모와 가상 테이블이 서로를 다시 그리는 무한 갱신을 일으켰다(2026-10-05).
 */
export function createFilterGate(initialKey: string | null): (key: string) => boolean {
  let last = initialKey;
  return (key) => {
    if (key === last) return false;
    last = key;
    return true;
  };
}

export interface DisplayUser extends LeaderboardUser {
  rank: number;
  isCurrentUser?: boolean;
  periodTokens?: number;
  periodCost?: number;
}

export interface ServerAggregate {
  totals: { tokens: number; cost: number };
  countries: Array<{ country_code: string; tokens: number; cost: number }>;
}

export interface InitialLeaderboard {
  period: PeriodFilter;
  tz: string;
  users: LeaderboardUser[];
  pagination: { total: number; totalPages: number };
  aggregate: ServerAggregate | null;
}

export function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "UTC";
  }
}

export function toDisplayUsers(
  users: LeaderboardUser[],
  pageNum: number,
  periodFilter: PeriodFilter,
  currentUsername: string | null
): DisplayUser[] {
  const startIndex = (pageNum - 1) * LEADERBOARD_PAGE_SIZE;
  const me = currentUsername?.toLowerCase() ?? null;
  return users.map((user, index) => ({
    ...user,
    rank:
      periodFilter !== "all" ? user.period_rank || startIndex + index + 1 : startIndex + index + 1,
    periodTokens: user.period_tokens ?? user.total_tokens,
    periodCost: user.period_cost ?? user.total_cost,
    isCurrentUser: me !== null && user.username?.toLowerCase() === me,
  }));
}
