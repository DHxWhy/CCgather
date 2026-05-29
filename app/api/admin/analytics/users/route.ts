/**
 * Admin Analytics Users API
 * Returns user metrics: DAU, WAU, MAU with country breakdown
 */

import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { posthogApi } from "@/lib/posthog/api-client";
import { calculateMetricWithTrend, calculateTotalWithTrend } from "@/lib/posthog/utils";
import { createServiceClient } from "@/lib/supabase/server";
import type { AnalyticsUsersResponse } from "@/lib/types/analytics";

export async function GET(request: Request) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const dateFrom = searchParams.get("date_from") || "-30d";
    const dateTo = searchParams.get("date_to") || undefined;

    if (!posthogApi.isConfigured()) {
      return NextResponse.json(
        {
          metrics: {
            dau: { value: 0, previousValue: 0, change: 0, changePercent: 0, trend: "neutral" },
            wau: { value: 0, previousValue: 0, change: 0, changePercent: 0, trend: "neutral" },
            mau: { value: 0, previousValue: 0, change: 0, changePercent: 0, trend: "neutral" },
          },
          byCountry: [],
          byModel: [],
          dateRange: { from: dateFrom, to: dateTo },
          error: "PostHog not configured",
        },
        { status: 200 }
      );
    }

    // Fetch unique user counts for DAU/WAU/MAU
    // Use user-selected dateFrom for all queries
    // calculateMetricWithTrend/calculateTotalWithTrend handle trend comparison internally
    const [dailyResult, weeklyResult, monthlyResult] = await Promise.allSettled([
      posthogApi.getTrends(["$pageview"], {
        dateRange: { date_from: dateFrom, date_to: dateTo },
        interval: "day",
        math: "dau",
      }),
      posthogApi.getTrends(["$pageview"], {
        dateRange: { date_from: dateFrom, date_to: dateTo },
        interval: "week",
        math: "weekly_active",
      }),
      posthogApi.getTrends(["$pageview"], {
        dateRange: { date_from: dateFrom, date_to: dateTo },
        interval: "month",
        math: "monthly_active",
      }),
    ]);

    const dailyTrends = dailyResult.status === "fulfilled" ? dailyResult.value : null;
    const weeklyTrends = weeklyResult.status === "fulfilled" ? weeklyResult.value : null;
    const monthlyTrends = monthlyResult.status === "fulfilled" ? monthlyResult.value : null;

    if (dailyResult.status === "rejected") {
      console.warn("[Analytics Users] DAU fetch failed:", dailyResult.reason);
    }
    if (weeklyResult.status === "rejected") {
      console.warn("[Analytics Users] WAU fetch failed:", weeklyResult.reason);
    }
    if (monthlyResult.status === "rejected") {
      console.warn("[Analytics Users] MAU fetch failed:", monthlyResult.reason);
    }

    // Calculate DAU (single day value), WAU and MAU (aggregated totals)
    const dau = calculateMetricWithTrend(dailyTrends, 0);
    const wau = calculateTotalWithTrend(weeklyTrends, 0);
    const mau = calculateTotalWithTrend(monthlyTrends, 0);

    // NOTE: This queries registered users from DB, not PostHog web visitors.
    // Shows "가입 사용자 국가 분포" (registered user country distribution).
    const supabase = createServiceClient();
    const regionNames = new Intl.DisplayNames(["ko"], { type: "region" });
    const { data: countryData } = await supabase
      .from("users")
      .select("country_code")
      .not("country_code", "is", null);

    // Count users by country
    const countryCounts = new Map<string, number>();
    let totalUsers = 0;

    if (countryData) {
      for (const user of countryData) {
        if (user.country_code) {
          const count = countryCounts.get(user.country_code) || 0;
          countryCounts.set(user.country_code, count + 1);
          totalUsers++;
        }
      }
    }

    // Convert to sorted array with resolved country names
    const byCountry = Array.from(countryCounts.entries())
      .map(([code, count]) => ({
        country: regionNames.of(code) ?? code,
        countryCode: code,
        users: count,
        percentage: totalUsers > 0 ? Math.round((count / totalUsers) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.users - a.users)
      .slice(0, 10); // Top 10 countries

    // ─── 모델 사용 분포 (primary_model 토큰 집계, 근사) ───
    // usage_stats 는 per-model 분해를 저장 안 하고 primary_model(그날 최다 모델)
    // 1개만 저장 → "그날 전체 토큰 = primary_model" 근사로 family 별 토큰 비중 집계.
    //
    // ⚠️ Supabase 프로젝트가 db-max-rows=1000 hard cap → .limit()/.range() 으로도
    // 단일 요청은 1000 행까지만. 전체(현재 1154행) 정확 집계 위해 1000씩 페이지네이션.
    // 정밀/확장 버전: model_breakdown 컬럼 + GROUP BY RPC (4행 반환, 무제한). Pluto 권장.
    const families = { Opus: 0, Sonnet: 0, Haiku: 0, Other: 0 };
    let totalTok = 0;
    const PAGE = 1000;
    const MAX_PAGES = 200; // 200K행 안전 상한 (초과 시 부분 집계 경고)
    let modelQueryFailed = false;
    let page = 0;
    for (; page < MAX_PAGES; page++) {
      const from = page * PAGE;
      const { data: modelRows, error: modelErr } = await supabase
        .from("usage_stats")
        .select("primary_model, total_tokens")
        .not("primary_model", "is", null)
        .order("id", { ascending: true }) // OFFSET 페이지네이션 결정화 — 동시 upsert 중 행 중복/누락 방지 (Diana 권장)
        .range(from, from + PAGE - 1);

      if (modelErr) {
        console.warn("[Analytics Users] model distribution query failed:", modelErr.message);
        modelQueryFailed = true;
        break;
      }
      if (!modelRows || modelRows.length === 0) break;

      for (const row of modelRows as {
        primary_model: string | null;
        total_tokens: number | null;
      }[]) {
        const m = (row.primary_model || "").toLowerCase();
        const t = row.total_tokens || 0;
        totalTok += t;
        if (m.includes("opus")) families.Opus += t;
        else if (m.includes("sonnet")) families.Sonnet += t;
        else if (m.includes("haiku")) families.Haiku += t;
        else families.Other += t;
      }

      if (modelRows.length < PAGE) break; // 마지막 페이지
    }
    if (page >= MAX_PAGES) {
      console.warn("[Analytics Users] model rows hit MAX_PAGES cap — distribution may be partial");
    }

    const byModel: { model: string; tokens: number; percentage: number }[] = modelQueryFailed
      ? []
      : Object.entries(families)
          .filter(([, tok]) => tok > 0)
          .map(([model, tokens]) => ({
            model,
            tokens,
            percentage: totalTok > 0 ? Math.round((tokens / totalTok) * 1000) / 10 : 0,
          }))
          .sort((a, b) => b.tokens - a.tokens);

    const response: AnalyticsUsersResponse = {
      metrics: {
        dau,
        wau,
        mau,
      },
      byCountry,
      byModel,
      dateRange: { from: dateFrom, to: dateTo },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("[Analytics Users] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
