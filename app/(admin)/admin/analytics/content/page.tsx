"use client";

import { useState } from "react";
import { useAnalyticsContent } from "@/hooks/useAdminAnalytics";
import type { MetricWithTrend } from "@/types/analytics";

const DATE_RANGES = [
  { label: "7일", value: "-7d" },
  { label: "14일", value: "-14d" },
  { label: "30일", value: "-30d" },
  { label: "90일", value: "-90d" },
];

function MetricCard({
  title,
  metric,
  format = "number",
}: {
  title: string;
  metric: MetricWithTrend;
  format?: "number" | "percent";
}) {
  const formatValue = (value: number) => {
    if (format === "percent") return `${value.toFixed(1)}%`;
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
    return value.toLocaleString();
  };

  const trendColor = {
    up: "text-emerald-400",
    down: "text-red-400",
    neutral: "text-white/40",
  }[metric.trend];

  const trendIcon = { up: "↑", down: "↓", neutral: "→" }[metric.trend];

  return (
    <div className="bg-[#161616] rounded-lg p-4 border border-white/[0.06]">
      <div className="text-[11px] text-white/50 uppercase tracking-wide mb-1">{title}</div>
      <div className="text-xl font-semibold text-white">{formatValue(metric.value)}</div>
      <div className={`text-[11px] flex items-center gap-1 mt-1 ${trendColor}`}>
        <span>{trendIcon}</span>
        <span>{Math.abs(metric.changePercent).toFixed(1)}%</span>
        <span className="text-white/30">vs 이전</span>
      </div>
    </div>
  );
}

function CategoryTable({
  categories,
}: {
  categories: Array<{ category: string; views: number; clicks: number; ctr: number }>;
}) {
  if (!categories?.length) {
    return (
      <div className="text-center py-6 text-[12px] text-white/30">카테고리 데이터가 없습니다</div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-white/[0.06]">
            <th className="px-3 py-2 text-left text-[11px] font-medium text-white/40 uppercase">
              카테고리
            </th>
            <th className="px-3 py-2 text-right text-[11px] font-medium text-white/40 uppercase">
              조회수
            </th>
            <th className="px-3 py-2 text-right text-[11px] font-medium text-white/40 uppercase">
              클릭수
            </th>
            <th className="px-3 py-2 text-right text-[11px] font-medium text-white/40 uppercase">
              CTR
            </th>
          </tr>
        </thead>
        <tbody>
          {categories.map((category) => (
            <tr
              key={category.category}
              className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors"
            >
              <td className="px-3 py-2 text-[13px] text-white capitalize">{category.category}</td>
              <td className="px-3 py-2 text-right text-[12px] text-white font-mono">
                {category.views.toLocaleString()}
              </td>
              <td className="px-3 py-2 text-right text-[12px] text-white font-mono">
                {category.clicks.toLocaleString()}
              </td>
              <td className="px-3 py-2 text-right text-[12px] text-[var(--color-claude-coral)] font-medium">
                {category.ctr.toFixed(1)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ArticleTable({
  articles,
}: {
  articles: Array<{
    id: string;
    title: string;
    category: string;
    views: number;
    clicks: number;
    ctr: number;
    avgTime: string;
  }>;
}) {
  if (!articles?.length) {
    return (
      <div className="text-center py-6 text-[12px] text-white/30">아티클 데이터가 없습니다</div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-white/[0.06]">
            <th className="px-3 py-2 text-left text-[11px] font-medium text-white/40 uppercase">
              제목
            </th>
            <th className="px-3 py-2 text-left text-[11px] font-medium text-white/40 uppercase">
              카테고리
            </th>
            <th className="px-3 py-2 text-right text-[11px] font-medium text-white/40 uppercase">
              클릭
            </th>
            <th className="px-3 py-2 text-right text-[11px] font-medium text-white/40 uppercase">
              CTR
            </th>
          </tr>
        </thead>
        <tbody>
          {articles.map((article) => (
            <tr
              key={article.id}
              className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors"
            >
              <td className="px-3 py-2 text-[13px] text-white max-w-xs truncate">
                {article.title}
              </td>
              <td className="px-3 py-2 text-[12px] text-white/50 capitalize">{article.category}</td>
              <td className="px-3 py-2 text-right text-[12px] text-white font-mono">
                {article.clicks.toLocaleString()}
              </td>
              <td className="px-3 py-2 text-right text-[12px] text-[var(--color-claude-coral)] font-medium">
                {article.ctr.toFixed(1)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ContentAnalyticsPage() {
  const [dateRange, setDateRange] = useState("-7d");
  const { data: contentData, isLoading } = useAnalyticsContent({ dateFrom: dateRange });

  return (
    <div className="space-y-4 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-white">콘텐츠 분석</h1>
          <p className="text-[12px] text-white/50 mt-0.5">뉴스 조회수 및 클릭률 분석</p>
        </div>
        <select
          value={dateRange}
          onChange={(e) => setDateRange(e.target.value)}
          className="bg-[#161616] text-white/80 border border-white/[0.06] rounded px-2.5 py-1.5 text-[12px] focus:outline-none focus:border-white/20"
        >
          {DATE_RANGES.map((r) => (
            <option key={r.value} value={r.value}>
              최근 {r.label}
            </option>
          ))}
        </select>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <div className="w-5 h-5 border-2 border-[var(--color-claude-coral)] border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Content */}
      {!isLoading && contentData && (
        <>
          {/* Metrics Grid */}
          <div className="grid grid-cols-3 gap-3">
            <MetricCard title="총 조회수" metric={contentData.metrics.totalViews} />
            <MetricCard title="평균 체류시간" metric={contentData.metrics.avgTime} />
            <MetricCard title="CTR (클릭률)" metric={contentData.metrics.ctr} format="percent" />
          </div>

          {/* Category Breakdown */}
          <div className="bg-[#161616] rounded-lg p-4 border border-white/[0.06]">
            <div className="text-[12px] text-white/50 mb-3">카테고리별 성과</div>
            <CategoryTable categories={contentData.byCategory} />
          </div>

          {/* Top Articles */}
          <div className="bg-[#161616] rounded-lg p-4 border border-white/[0.06]">
            <div className="text-[12px] text-white/50 mb-3">인기 아티클</div>
            <ArticleTable articles={contentData.topArticles} />
          </div>
        </>
      )}
    </div>
  );
}
