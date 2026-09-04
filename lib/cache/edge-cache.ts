import "server-only";
import { invalidateByTag } from "@vercel/functions";

export {
  CACHE_TAG_COMMUNITY,
  CACHE_TAG_LEADERBOARD,
  EDGE_SWR_SEC,
  EDGE_TTL_LEADERBOARD_SEC,
  EDGE_TTL_USER_SEC,
  edgeCacheHeaders,
  userCacheTag,
} from "./edge-cache-shared";

/**
 * 쓰기 직후 호출. Vercel 의 invalidate 는 stale 표시 후 백그라운드 재검증이라
 * 사용자 대기 없이 곧 새 값으로 바뀐다. Vercel 밖(로컬·CI)에서는 no-op 이고,
 * 실패해도 쓰기를 막지 않는다 — TTL 만료로 결국 갱신된다.
 */
export async function invalidateEdgeCache(tags: readonly string[]): Promise<void> {
  if (process.env.VERCEL !== "1") return;
  try {
    await invalidateByTag([...tags]);
  } catch (error) {
    console.error(`[edge-cache] invalidateByTag failed for tags=${tags.join(",")}:`, error);
  }
}
