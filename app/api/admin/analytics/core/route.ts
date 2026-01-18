/**
 * Admin Analytics Core KPI API
 * DB 기반 핵심 성과 지표 (PostHog 독립)
 */

import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin/guard";
import { createServiceClient } from "@/lib/supabase/server";

interface MetricWithTrend {
  value: number;
  previousValue: number;
  change: number;
  changePercent: number;
  trend: "up" | "down" | "neutral";
}

function calculateTrend(current: number, previous: number): MetricWithTrend {
  const change = current - previous;
  const changePercent = previous > 0 ? (change / previous) * 100 : current > 0 ? 100 : 0;

  return {
    value: current,
    previousValue: previous,
    change,
    changePercent: Math.round(changePercent * 10) / 10,
    trend: change > 0 ? "up" : change < 0 ? "down" : "neutral",
  };
}

export async function GET(request: Request) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get("days") || "7");

    const supabase = createServiceClient();
    const now = new Date();

    // 기간 계산
    const currentStart = new Date(now);
    currentStart.setDate(currentStart.getDate() - days);
    const previousStart = new Date(currentStart);
    previousStart.setDate(previousStart.getDate() - days);

    const currentStartStr = currentStart.toISOString();
    const previousStartStr = previousStart.toISOString();
    const nowStr = now.toISOString();

    // 병렬로 모든 쿼리 실행
    const [
      // WAU (Weekly Active Submitters) - 현재 기간
      wauCurrentResult,
      // WAU - 이전 기간
      wauPreviousResult,
      // 총 제출 수 - 현재 기간
      submissionsCurrentResult,
      // 총 제출 수 - 이전 기간
      submissionsPreviousResult,
      // 신규 가입 - 현재 기간
      signupsCurrentResult,
      // 신규 가입 - 이전 기간
      signupsPreviousResult,
      // 첫 제출 완료 사용자 수 (최근 기간 가입자 중)
      firstSubmitResult,
      // 국가별 분포
      countryResult,
      // 플랜별 분포
      planResult,
      // 모델별 분포
      modelResult,
      // 전체 통계
      totalStatsResult,
    ] = await Promise.all([
      // WAU Current
      supabase
        .from("usage_stats")
        .select("user_id")
        .gte("submitted_at", currentStartStr)
        .lte("submitted_at", nowStr),

      // WAU Previous
      supabase
        .from("usage_stats")
        .select("user_id")
        .gte("submitted_at", previousStartStr)
        .lt("submitted_at", currentStartStr),

      // Submissions Current
      supabase
        .from("usage_stats")
        .select("id", { count: "exact", head: true })
        .gte("date", currentStart.toISOString().split("T")[0]),

      // Submissions Previous
      supabase
        .from("usage_stats")
        .select("id", { count: "exact", head: true })
        .gte("date", previousStart.toISOString().split("T")[0])
        .lt("date", currentStart.toISOString().split("T")[0]),

      // Signups Current
      supabase
        .from("users")
        .select("id", { count: "exact", head: true })
        .gte("created_at", currentStartStr),

      // Signups Previous
      supabase
        .from("users")
        .select("id", { count: "exact", head: true })
        .gte("created_at", previousStartStr)
        .lt("created_at", currentStartStr),

      // First Submit (가입자 중 제출 이력이 있는 사용자)
      supabase.rpc("get_first_submit_stats", { days_ago: days }).maybeSingle(),

      // Country Distribution
      supabase
        .from("users")
        .select("country_code")
        .not("country_code", "is", null)
        .gt("total_tokens", 0),

      // Plan Distribution
      supabase.from("users").select("ccplan").not("ccplan", "is", null).gt("total_tokens", 0),

      // Model Distribution
      supabase
        .from("users")
        .select("primary_model")
        .not("primary_model", "is", null)
        .gt("total_tokens", 0),

      // Total Stats
      supabase.from("users").select("id", { count: "exact", head: true }).gt("total_tokens", 0),
    ]);

    // WAU 계산 (고유 user_id 수)
    const wauCurrentUsers = new Set(
      wauCurrentResult.data?.map((r: { user_id: string }) => r.user_id) || []
    );
    const wauPreviousUsers = new Set(
      wauPreviousResult.data?.map((r: { user_id: string }) => r.user_id) || []
    );

    // 지표 계산
    const wauSubmitters = calculateTrend(wauCurrentUsers.size, wauPreviousUsers.size);
    const totalSubmissions = calculateTrend(
      submissionsCurrentResult.count || 0,
      submissionsPreviousResult.count || 0
    );
    const newSignups = calculateTrend(
      signupsCurrentResult.count || 0,
      signupsPreviousResult.count || 0
    );

    // 첫 제출 완료율 (RPC가 없으면 기본값)
    let firstSubmitRate: MetricWithTrend;
    if (firstSubmitResult.data) {
      firstSubmitRate = calculateTrend(
        firstSubmitResult.data.current_rate || 0,
        firstSubmitResult.data.previous_rate || 0
      );
    } else {
      // RPC가 없는 경우 간단히 계산
      const signupsCount = signupsCurrentResult.count || 1;
      const submittersInPeriod = wauCurrentUsers.size;
      const rate = Math.min((submittersInPeriod / signupsCount) * 100, 100);
      firstSubmitRate = calculateTrend(rate, rate);
    }

    // 국가별 분포 집계
    const countryCounts: Record<string, number> = {};
    countryResult.data?.forEach((r: { country_code: string }) => {
      const code = r.country_code || "unknown";
      countryCounts[code] = (countryCounts[code] || 0) + 1;
    });
    const totalCountryUsers = Object.values(countryCounts).reduce((a, b) => a + b, 0);
    const countryDistribution = Object.entries(countryCounts)
      .map(([code, count]) => ({
        code,
        count,
        percentage: Math.round((count / totalCountryUsers) * 1000) / 10,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // 플랜별 분포 집계
    const planCounts: Record<string, number> = {};
    planResult.data?.forEach((r: { ccplan: string }) => {
      const plan = r.ccplan || "unknown";
      planCounts[plan] = (planCounts[plan] || 0) + 1;
    });
    const totalPlanUsers = Object.values(planCounts).reduce((a, b) => a + b, 0);
    const planDistribution = Object.entries(planCounts)
      .map(([plan, count]) => ({
        plan,
        count,
        percentage: Math.round((count / totalPlanUsers) * 1000) / 10,
      }))
      .sort((a, b) => b.count - a.count);

    // 모델별 분포 집계
    const modelCounts: Record<string, number> = {};
    modelResult.data?.forEach((r: { primary_model: string }) => {
      const model = r.primary_model || "unknown";
      // 모델 이름 정규화
      const normalizedModel = model
        .replace(/^claude-/, "")
        .replace(/-\d{8}$/, "")
        .replace(/-latest$/, "");
      modelCounts[normalizedModel] = (modelCounts[normalizedModel] || 0) + 1;
    });
    const totalModelUsers = Object.values(modelCounts).reduce((a, b) => a + b, 0);
    const modelDistribution = Object.entries(modelCounts)
      .map(([model, count]) => ({
        model,
        count,
        percentage: Math.round((count / totalModelUsers) * 1000) / 10,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return NextResponse.json({
      metrics: {
        wauSubmitters,
        totalSubmissions,
        newSignups,
        firstSubmitRate,
      },
      distributions: {
        country: countryDistribution,
        plan: planDistribution,
        model: modelDistribution,
      },
      totals: {
        activeUsers: totalStatsResult.count || 0,
        periodDays: days,
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Analytics Core] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
