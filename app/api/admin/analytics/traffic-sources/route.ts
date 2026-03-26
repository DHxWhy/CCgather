/**
 * Admin Analytics Traffic Sources API
 * Returns traffic source breakdown: Direct, Search, Social, Referral
 */

import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { posthogApi } from "@/lib/posthog/api-client";

// =====================================================
// Domain Classification
// =====================================================

const SEARCH_ENGINES = [
  "google.com",
  "google.co.kr",
  "google.co.jp",
  "bing.com",
  "duckduckgo.com",
  "yahoo.com",
  "yahoo.co.jp",
  "baidu.com",
  "naver.com",
  "daum.net",
  "yandex.ru",
  "yandex.com",
  "ecosia.org",
  "search.naver.com",
];

const SOCIAL_NETWORKS = [
  "twitter.com",
  "x.com",
  "t.co",
  "facebook.com",
  "linkedin.com",
  "reddit.com",
  "threads.net",
  "instagram.com",
  "youtube.com",
  "tiktok.com",
  "discord.com",
  "discord.gg",
  "slack.com",
];

type SourceType = "direct" | "search" | "social" | "referral";

function normalizeDomain(raw: string): string {
  try {
    const cleaned = raw.startsWith("http") ? new URL(raw).hostname : raw;
    return cleaned.replace(/^www\./, "").toLowerCase();
  } catch {
    return raw.replace(/^www\./, "").toLowerCase();
  }
}

function classifySource(domain: string | null | undefined): SourceType {
  if (!domain || domain === "" || domain === "$direct") return "direct";

  const normalized = domain.replace(/^www\./, "").toLowerCase();

  // Use domain-suffix matching to avoid false positives (e.g. "googledocs.com" matching "google")
  if (SEARCH_ENGINES.some((s) => normalized === s || normalized.endsWith(`.${s}`))) return "search";
  if (SOCIAL_NETWORKS.some((s) => normalized === s || normalized.endsWith(`.${s}`)))
    return "social";

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

    // Fetch pageviews with referring_domain breakdown AND detailed referrer URLs
    const [breakdownData, referrerData] = await Promise.all([
      posthogApi.getTrends(["$pageview"], {
        dateRange: { date_from: dateFrom, date_to: dateTo },
        interval: "day",
        breakdown: "$referring_domain",
        math: "dau",
      }),
      posthogApi.getTrends(["$pageview"], {
        dateRange: { date_from: dateFrom, date_to: dateTo },
        breakdown: "$referrer", // Full referrer URL
        math: "dau",
      }),
    ]);

    // Build URL details map grouped by domain
    const urlsByDomain = new Map<string, Map<string, number>>();
    for (const series of referrerData.results || []) {
      const fullUrl = series.label || "";
      const totalCount = (series.data || []).reduce((sum: number, v: number) => sum + (v || 0), 0);
      if (!fullUrl || totalCount === 0) continue;

      // Extract domain from URL using shared normalization
      let domain = "(direct)";
      if (fullUrl !== "$direct" && fullUrl !== "") {
        domain = normalizeDomain(
          fullUrl.startsWith("http") ? fullUrl : (fullUrl.split("/")[0] ?? fullUrl)
        );
      }

      if (!urlsByDomain.has(domain)) {
        urlsByDomain.set(domain, new Map());
      }
      const domainUrls = urlsByDomain.get(domain)!;
      domainUrls.set(fullUrl, (domainUrls.get(fullUrl) || 0) + totalCount);
    }

    // Process breakdown results
    const domainCounts = new Map<string, number>();
    const dailyBySource = new Map<string, Map<SourceType, number>>();

    // Aggregate data from all series
    for (const series of breakdownData.results || []) {
      const rawLabel = series.label || "(direct)";
      const domain =
        rawLabel === "" || rawLabel === "$direct" ? "(direct)" : normalizeDomain(rawLabel);
      const totalCount = (series.data || []).reduce((sum: number, v: number) => sum + (v || 0), 0);

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

    // Build top domains list with detailed URLs
    const topDomains = Array.from(domainCounts.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 100)
      .map(([domain, count]) => {
        // Domain keys are already normalized via normalizeDomain() during aggregation
        const displayDomain = domain === "" || domain === "$direct" ? "(direct)" : domain;

        // Get detailed URLs for this domain (keys match since both use normalizeDomain)
        const domainUrlMap = urlsByDomain.get(domain);
        const details = domainUrlMap
          ? Array.from(domainUrlMap.entries())
              .sort(([, a], [, b]) => b - a)
              .slice(0, 10) // Top 10 URLs per domain
              .map(([url, urlCount]) => ({
                url,
                count: urlCount,
                percent: count > 0 ? Math.round((urlCount / count) * 1000) / 10 : 0,
              }))
          : [];

        return {
          domain: displayDomain,
          count,
          percent: totalVisitors > 0 ? Math.round((count / totalVisitors) * 1000) / 10 : 0,
          type: classifySource(domain),
          icon: getDomainIcon(domain),
          details, // Array of { url, count, percent }
        };
      });

    return NextResponse.json({
      summary,
      trend,
      topDomains,
      totalVisitors,
      dateRange: { from: dateFrom, to: dateTo },
    });
  } catch (error) {
    console.warn("[Analytics Traffic Sources] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        error: `PostHog API error: ${errorMessage}`,
        details: posthogApi.isConfigured()
          ? "API 키가 만료되었거나 잘못되었을 수 있습니다"
          : "POSTHOG_PERSONAL_API_KEY 또는 POSTHOG_PROJECT_ID가 설정되지 않았습니다",
      },
      { status: 500 }
    );
  }
}
