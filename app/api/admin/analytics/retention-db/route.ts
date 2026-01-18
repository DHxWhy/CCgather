/**
 * Admin Analytics Retention API (DB 기반)
 * 제출 기준 리텐션 코호트 분석
 */

import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin/guard";
import { createServiceClient } from "@/lib/supabase/server";

interface CohortRetention {
  cohortWeek: string;
  cohortSize: number;
  retentionByWeek: number[]; // W0, W1, W2, W3, W4
}

export async function GET(request: Request) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const weeks = parseInt(searchParams.get("weeks") || "8");

    const supabase = createServiceClient();

    // 최근 N주간의 첫 제출 사용자 코호트 가져오기
    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - weeks * 7);

    // 모든 제출 기록 가져오기 (첫 제출 기준 코호트 분석용)
    const { data: allSubmissions, error } = await supabase
      .from("usage_stats")
      .select("user_id, date, submitted_at")
      .gte("date", startDate.toISOString().split("T")[0])
      .order("date", { ascending: true });

    if (error) {
      console.error("[Retention DB] Query error:", error);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    if (!allSubmissions || allSubmissions.length === 0) {
      return NextResponse.json({
        cohorts: [],
        summary: {
          w1Retention: 0,
          w4Retention: 0,
          avgRetention: 0,
        },
        generatedAt: new Date().toISOString(),
      });
    }

    // 사용자별 첫 제출일 찾기
    const userFirstSubmit: Record<string, Date> = {};
    const userSubmitDates: Record<string, Set<string>> = {};

    for (const submission of allSubmissions) {
      const userId = submission.user_id;
      const date = new Date(submission.date);

      if (!userFirstSubmit[userId] || date < userFirstSubmit[userId]) {
        userFirstSubmit[userId] = date;
      }

      if (!userSubmitDates[userId]) {
        userSubmitDates[userId] = new Set();
      }
      userSubmitDates[userId].add(submission.date);
    }

    // 주차별 코호트 생성
    const getWeekStart = (date: Date): string => {
      const d = new Date(date);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1); // 월요일 시작
      d.setDate(diff);
      return d.toISOString().split("T")[0] ?? "";
    };

    const cohortMap: Record<
      string,
      { users: string[]; retentionWeeks: Record<number, Set<string>> }
    > = {};

    // 각 사용자를 첫 제출 주차 코호트에 배치
    for (const [userId, firstDate] of Object.entries(userFirstSubmit)) {
      const cohortWeek = getWeekStart(firstDate);

      if (!cohortMap[cohortWeek]) {
        cohortMap[cohortWeek] = { users: [], retentionWeeks: {} };
      }
      cohortMap[cohortWeek].users.push(userId);

      // 이후 주차별 활동 체크
      const submitDates = userSubmitDates[userId];
      if (submitDates) {
        for (const dateStr of submitDates) {
          const submitDate = new Date(dateStr);
          const weeksDiff = Math.floor(
            (submitDate.getTime() - firstDate.getTime()) / (7 * 24 * 60 * 60 * 1000)
          );

          if (weeksDiff >= 0 && weeksDiff <= 4) {
            if (!cohortMap[cohortWeek].retentionWeeks[weeksDiff]) {
              cohortMap[cohortWeek].retentionWeeks[weeksDiff] = new Set();
            }
            cohortMap[cohortWeek].retentionWeeks[weeksDiff].add(userId);
          }
        }
      }
    }

    // 코호트 데이터 정리
    const cohorts: CohortRetention[] = Object.entries(cohortMap)
      .map(([week, data]) => {
        const cohortSize = data.users.length;
        const retentionByWeek = [0, 1, 2, 3, 4].map((w) => {
          const activeInWeek = data.retentionWeeks[w]?.size || 0;
          return cohortSize > 0 ? Math.round((activeInWeek / cohortSize) * 100) : 0;
        });

        return {
          cohortWeek: week,
          cohortSize,
          retentionByWeek,
        };
      })
      .sort((a, b) => b.cohortWeek.localeCompare(a.cohortWeek))
      .slice(0, weeks);

    // 요약 통계 계산 (가장 최근 완전한 코호트 기준)
    const validCohorts = cohorts.filter((c) => c.cohortSize >= 3); // 최소 3명 이상
    const w1Retentions = validCohorts
      .filter((c) => c.retentionByWeek[1] !== undefined)
      .map((c) => c.retentionByWeek[1]);
    const w4Retentions = validCohorts
      .filter((c) => c.retentionByWeek[4] !== undefined)
      .map((c) => c.retentionByWeek[4]);

    const sumW1 = w1Retentions
      .filter((v): v is number => v !== undefined)
      .reduce((a, b) => a + b, 0);
    const avgW1 = w1Retentions.length > 0 ? Math.round(sumW1 / w1Retentions.length) : 0;

    const sumW4 = w4Retentions
      .filter((v): v is number => v !== undefined)
      .reduce((a, b) => a + b, 0);
    const avgW4 = w4Retentions.length > 0 ? Math.round(sumW4 / w4Retentions.length) : 0;

    return NextResponse.json({
      cohorts,
      summary: {
        w1Retention: avgW1,
        w4Retention: avgW4,
        avgRetention: Math.round((avgW1 + avgW4) / 2),
        totalCohorts: cohorts.length,
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Retention DB] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
