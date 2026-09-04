import "server-only";
import type { LeaderboardResponse } from "@/lib/types";
import {
  LEADERBOARD_DEFAULT_PERIOD,
  LEADERBOARD_PAGE_SIZE,
  type InitialLeaderboard,
} from "@/lib/leaderboard/initial-shared";

const FETCH_TIMEOUT_MS = 3000;

function appOrigin(): string {
  if (process.env.VERCEL_ENV === "production" && process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

/**
 * 서버 컴포넌트에서 자기 배포의 /api/leaderboard 를 HTTP 로 읽는다 — DB 를 직접 치지 않고
 * 엣지 캐시(HIT ≈ 수십 ms)를 그대로 재사용하기 위해서다. 실패·지연 시 null 을 돌려주면
 * 클라이언트가 종전처럼 마운트 후 직접 요청하므로 화면이 깨지지 않는다.
 */
export async function fetchInitialLeaderboard(tz: string): Promise<InitialLeaderboard | null> {
  const params = new URLSearchParams({
    page: "1",
    limit: String(LEADERBOARD_PAGE_SIZE),
    period: LEADERBOARD_DEFAULT_PERIOD,
    tz,
  });
  const url = `${appOrigin()}/api/leaderboard?${params}`;
  try {
    const res = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.error(`[leaderboard-ssr] ${url} -> ${res.status}`);
      return null;
    }
    const data = (await res.json()) as LeaderboardResponse & {
      totals?: { tokens: number; cost: number } | null;
      countries?: Array<{ country_code: string; tokens: number; cost: number }> | null;
    };
    return {
      period: LEADERBOARD_DEFAULT_PERIOD,
      tz,
      users: data.users ?? [],
      pagination: {
        total: data.pagination?.total ?? 0,
        totalPages: data.pagination?.totalPages ?? 1,
      },
      aggregate:
        data.totals && data.countries ? { totals: data.totals, countries: data.countries } : null,
    };
  } catch (error) {
    console.error(`[leaderboard-ssr] fetch failed for ${url}:`, error);
    return null;
  }
}
