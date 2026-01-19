/**
 * Admin Analytics Traffic Sources API
 * Returns traffic source breakdown: Direct, Search, Social, Referral
 */

import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin/guard";
import { posthogApi } from "@/lib/posthog/api-client";

// =====================================================
// Domain Classification
// =====================================================

const SEARCH_ENGINES = [
  "google",
  "bing",
  "duckduckgo",
  "yahoo",
  "baidu",
  "naver",
  "daum",
  "yandex",
  "ecosia",
];

const SOCIAL_NETWORKS = [
  "twitter",
  "x.com",
  "facebook",
  "linkedin",
  "reddit",
  "threads",
  "instagram",
  "youtube",
  "tiktok",
  "discord",
  "slack",
];

type SourceType = "direct" | "search" | "social" | "referral";

function classifySource(domain: string | null | undefined): SourceType {
  if (!domain || domain === "" || domain === "$direct") return "direct";

  const normalized = domain.replace(/^www\./, "").toLowerCase();

  if (SEARCH_ENGINES.some((s) => normalized.includes(s))) return "search";
  if (SOCIAL_NETWORKS.some((s) => normalized.includes(s))) return "social";

  return "referral";
}

function getSourceIcon(type: SourceType): string {
  const icons: Record<SourceType, string> = {
    direct: "📍",
    search: "🔍",
    social: "🐦",
    referral: "🔗",
  };
  return icons[type];
}

function getDomainIcon(domain: string): string {
  const normalized = domain.toLowerCase();
  if (normalized.includes("google")) return "🔍";
  if (normalized.includes("bing")) return "🔍";
  if (normalized.includes("twitter") || normalized.includes("x.com")) return "🐦";
  if (normalized.includes("reddit")) return "🤖";
  if (normalized.includes("github")) return "💻";
  if (normalized.includes("linkedin")) return "💼";
  if (normalized.includes("facebook")) return "📘";
  if (normalized.includes("youtube")) return "▶️";
  if (normalized.includes("naver")) return "🇰🇷";
  if (normalized.includes("discord")) return "💬";
  if (!domain || domain === "(direct)") return "📍";
  return "🔗";
}

// =====================================================
// API Handler
// =====================================================

export async function GET(request: Request) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const dateFrom = searchParams.get("date_from") || "-7d";
    const dateTo = searchParams.get("date_to") || undefined;

    if (!posthogApi.isConfigured()) {
      return NextResponse.json(
        {
          summary: {
            direct: { count: 0, percent: 0 },
            search: { count: 0, percent: 0 },
            social: { count: 0, percent: 0 },
            referral: { count: 0, percent: 0 },
          },
          trend: [],
          topDomains: [],
          dateRange: { from: dateFrom, to: dateTo },
          error: "PostHog not configured",
        },
        { status: 200 }
      );
    }

    // Fetch pageviews with referring_domain breakdown
    const breakdownData = await posthogApi.getTrends(["$pageview"], {
      dateRange: { date_from: dateFrom, date_to: dateTo },
      interval: "day",
      breakdown: "$referring_domain",
      math: "dau",
    });

    // Process breakdown results
    const domainCounts = new Map<string, number>();
    const dailyBySource = new Map<string, Map<SourceType, number>>();

    // Aggregate data from all series
    for (const series of breakdownData.results || []) {
      const domain = series.label || "(direct)";
      const totalCount = series.count || 0;

      // Aggregate domain counts
      const existing = domainCounts.get(domain) || 0;
      domainCounts.set(domain, existing + totalCount);

      // Daily breakdown by source type
      const sourceType = classifySource(domain);
      if (series.days && series.data) {
        for (let i = 0; i < series.days.length; i++) {
          const day = series.days[i];
          if (!day) continue;
          const count = series.data[i] || 0;

          if (!dailyBySource.has(day)) {
            dailyBySource.set(
              day,
              new Map([
                ["direct", 0],
                ["search", 0],
                ["social", 0],
                ["referral", 0],
              ])
            );
          }

          const dayMap = dailyBySource.get(day)!;
          dayMap.set(sourceType, (dayMap.get(sourceType) || 0) + count);
        }
      }
    }

    // Calculate summary by source type
    const sourceTotals: Record<SourceType, number> = {
      direct: 0,
      search: 0,
      social: 0,
      referral: 0,
    };

    for (const [domain, count] of domainCounts) {
      const sourceType = classifySource(domain);
      sourceTotals[sourceType] += count;
    }

    const totalVisitors = Object.values(sourceTotals).reduce((a, b) => a + b, 0);

    const summary = {
      direct: {
        count: sourceTotals.direct,
        percent:
          totalVisitors > 0 ? Math.round((sourceTotals.direct / totalVisitors) * 1000) / 10 : 0,
        icon: getSourceIcon("direct"),
      },
      search: {
        count: sourceTotals.search,
        percent:
          totalVisitors > 0 ? Math.round((sourceTotals.search / totalVisitors) * 1000) / 10 : 0,
        icon: getSourceIcon("search"),
      },
      social: {
        count: sourceTotals.social,
        percent:
          totalVisitors > 0 ? Math.round((sourceTotals.social / totalVisitors) * 1000) / 10 : 0,
        icon: getSourceIcon("social"),
      },
      referral: {
        count: sourceTotals.referral,
        percent:
          totalVisitors > 0 ? Math.round((sourceTotals.referral / totalVisitors) * 1000) / 10 : 0,
        icon: getSourceIcon("referral"),
      },
    };

    // Build trend data
    const trend = Array.from(dailyBySource.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, sourceMap]) => ({
        date,
        direct: sourceMap.get("direct") || 0,
        search: sourceMap.get("search") || 0,
        social: sourceMap.get("social") || 0,
        referral: sourceMap.get("referral") || 0,
      }));

    // Build top domains list
    const topDomains = Array.from(domainCounts.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 15)
      .map(([domain, count]) => ({
        domain: domain === "" || domain === "$direct" ? "(direct)" : domain,
        count,
        percent: totalVisitors > 0 ? Math.round((count / totalVisitors) * 1000) / 10 : 0,
        type: classifySource(domain),
        icon: getDomainIcon(domain),
      }));

    return NextResponse.json({
      summary,
      trend,
      topDomains,
      totalVisitors,
      dateRange: { from: dateFrom, to: dateTo },
    });
  } catch (error) {
    console.error("[Analytics Traffic Sources] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
