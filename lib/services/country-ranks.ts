import type { SupabaseClient } from "@supabase/supabase-js";

// PostgREST 빌더는 PromiseLike(then 만) 라 `.catch` 가 없다. `rpc(...).catch(() => {})` 는
// "실패를 무시하는" 코드가 아니라 호출 즉시 TypeError 를 던지는 코드였고, GET /api/me 에는
// try/catch 가 없어 국가 백필 직후 첫 응답이 500 으로 떨어졌다(2026-10-17 프로덕션 로그).
// 순위 재계산은 부수 작업이라 실패해도 호출자의 응답을 막지 않고 로그만 남긴다.
export async function recalcCountryRanks(
  supabase: SupabaseClient,
  context: string
): Promise<boolean> {
  const { error } = await supabase.rpc("calculate_country_ranks");
  if (error) {
    console.error(`[${context}] calculate_country_ranks failed:`, error);
    return false;
  }
  return true;
}
