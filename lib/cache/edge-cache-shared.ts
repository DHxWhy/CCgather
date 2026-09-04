/**
 * Vercel CDN 엣지 캐시 태그 계약 (제출 라우트·읽기 라우트·테스트가 공유).
 * 태그는 쉼표 금지·대소문자 구분:
 *  - "leaderboard"  순위·국가·전역 통계 등 누가 제출해도 바뀌는 응답
 *  - "user-<id>"    그 사용자의 프로필·배지·사용량
 *  - "community"    커뮤니티 통계
 * 이 파일은 import 가 없어야 한다 — vitest·클라이언트에서 server-only 없이 읽기 위함.
 */
export const CACHE_TAG_LEADERBOARD = "leaderboard";
export const CACHE_TAG_COMMUNITY = "community";
export const userCacheTag = (userId: string) => `user-${userId}`;

export const EDGE_TTL_LEADERBOARD_SEC = 300;
export const EDGE_TTL_USER_SEC = 300;
export const EDGE_SWR_SEC = 60;

export function edgeCacheHeaders(ttlSec: number, tags: readonly string[]): Record<string, string> {
  return {
    "Cache-Control": `public, s-maxage=${ttlSec}, stale-while-revalidate=${EDGE_SWR_SEC}`,
    "Vercel-Cache-Tag": tags.join(","),
  };
}
