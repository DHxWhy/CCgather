import { NextResponse } from "next/server";
import { GLOBAL_STATS_THRESHOLDS, getGlobalStats } from "@/lib/data/global-stats";

// 집계는 getGlobalStats 하나만 쓴다. 예전에는 이 라우트가 같은 쿼리를 따로
// 구현해, 서버 렌더(lib)와 클라이언트 fetch(라우트)가 서로 다른 집계 기준을
// 쓰면 같은 화면에 다른 숫자가 나올 수 있었다.
export async function GET() {
  const stats = await getGlobalStats();

  return NextResponse.json(
    { ...stats, thresholds: GLOBAL_STATS_THRESHOLDS },
    {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60",
      },
    }
  );
}
