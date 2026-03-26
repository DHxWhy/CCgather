"use client";

import { useState, useEffect } from "react";
import { AdminStatCard, AdminCard, AdminBadge, AdminButton } from "@/components/admin";

interface SystemStatus {
  database: {
    status: "healthy" | "error";
    responseTime: number;
  };
  stats: {
    users: number;
    contents: number;
  };
  crawler: {
    newsMode: "on" | "confirm" | "off";
    youtubeMode: "on" | "confirm" | "off";
    lastNewsCrawl: string | null;
    lastYoutubeCrawl: string | null;
  };
  timestamp: string;
}

export default function SystemStatusPage() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSystemStatus();
  }, []);

  async function fetchSystemStatus() {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/admin/system");

      if (!response.ok) {
        throw new Error("Failed to fetch system status");
      }

      const data = await response.json();
      setStatus(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error occurred");
      console.error("Failed to fetch system status:", err);
    } finally {
      setLoading(false);
    }
  }

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
    if (num >= 1000) return (num / 1000).toFixed(1) + "K";
    return num.toString();
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "방금 전";
    if (diffMins < 60) return `${diffMins}분 전`;
    if (diffHours < 24) return `${diffHours}시간 전`;
    if (diffDays < 7) return `${diffDays}일 전`;

    return date.toLocaleDateString("ko-KR", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getModeVariant = (mode: string): "success" | "warning" | "neutral" => {
    if (mode === "on") return "success";
    if (mode === "confirm") return "warning";
    return "neutral";
  };

  const getModeLabel = (mode: string): string => {
    if (mode === "on") return "자동 실행";
    if (mode === "confirm") return "수동 확인";
    return "비활성화";
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">시스템 상태</h2>
          <p className="text-white/60">시스템의 현재 상태를 모니터링합니다.</p>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="text-white/40">로딩 중...</div>
        </div>
      </div>
    );
  }

  if (error || !status) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">시스템 상태</h2>
          <p className="text-white/60">시스템의 현재 상태를 모니터링합니다.</p>
        </div>
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-3xl">⚠️</span>
            <div>
              <h3 className="text-red-400 font-semibold text-lg">
                시스템 상태를 불러올 수 없습니다
              </h3>
              <p className="text-white/60 text-sm">{error || "알 수 없는 오류가 발생했습니다."}</p>
            </div>
          </div>
          <AdminButton variant="secondary" onClick={fetchSystemStatus}>
            다시 시도
          </AdminButton>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">시스템 상태</h2>
          <p className="text-white/60">시스템의 현재 상태를 모니터링합니다.</p>
        </div>
        <AdminButton variant="secondary" onClick={fetchSystemStatus}>
          🔄 새로고침
        </AdminButton>
      </div>

      {/* Status Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <AdminStatCard
          title="데이터베이스"
          value={status.database.status === "healthy" ? "Healthy" : "Error"}
          icon={
            <span className="text-2xl">{status.database.status === "healthy" ? "🟢" : "🔴"}</span>
          }
          color={status.database.status === "healthy" ? "success" : "error"}
        />
        <AdminStatCard
          title="사용자 수"
          value={formatNumber(status.stats.users)}
          icon={<span className="text-2xl">👥</span>}
          color="default"
        />
        <AdminStatCard
          title="콘텐츠 수"
          value={formatNumber(status.stats.contents)}
          icon={<span className="text-2xl">📄</span>}
          color="primary"
        />
        <AdminStatCard
          title="마지막 업데이트"
          value={formatDate(status.timestamp)}
          icon={<span className="text-2xl">⏰</span>}
          color="default"
        />
      </div>

      {/* Database Details */}
      <AdminCard>
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <span className="text-2xl">💾</span>
          데이터베이스 상세
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white/5 rounded-lg p-4 border border-white/10">
            <div className="text-sm text-white/60 mb-2">연결 상태</div>
            <div className="flex items-center gap-2">
              <AdminBadge variant={status.database.status === "healthy" ? "success" : "error"}>
                {status.database.status === "healthy" ? "Healthy" : "Error"}
              </AdminBadge>
            </div>
          </div>
          <div className="bg-white/5 rounded-lg p-4 border border-white/10">
            <div className="text-sm text-white/60 mb-2">응답 시간</div>
            <div className="text-xl font-bold text-white font-mono">
              {status.database.responseTime}ms
            </div>
          </div>
        </div>
      </AdminCard>

      {/* Crawler Status */}
      <AdminCard>
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <span className="text-2xl">🤖</span>
          크롤러 상태
        </h3>
        <div className="space-y-4">
          {/* News Crawler */}
          <div className="bg-white/5 rounded-lg p-4 border border-white/10">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <span className="text-2xl">📰</span>
                <div>
                  <h4 className="text-white font-medium">News Crawler</h4>
                  <p className="text-sm text-white/60">Anthropic 뉴스 수집</p>
                </div>
              </div>
              <AdminBadge variant={getModeVariant(status.crawler.newsMode)}>
                {getModeLabel(status.crawler.newsMode)}
              </AdminBadge>
            </div>
            <div className="text-sm text-white/60">
              마지막 크롤:{" "}
              <span className="text-white">{formatDate(status.crawler.lastNewsCrawl)}</span>
            </div>
          </div>

          {/* YouTube Crawler */}
          <div className="bg-white/5 rounded-lg p-4 border border-white/10">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🎥</span>
                <div>
                  <h4 className="text-white font-medium">YouTube Crawler</h4>
                  <p className="text-sm text-white/60">YouTube 동영상 수집</p>
                </div>
              </div>
              <AdminBadge variant={getModeVariant(status.crawler.youtubeMode)}>
                {getModeLabel(status.crawler.youtubeMode)}
              </AdminBadge>
            </div>
            <div className="text-sm text-white/60">
              마지막 크롤:{" "}
              <span className="text-white">{formatDate(status.crawler.lastYoutubeCrawl)}</span>
            </div>
          </div>
        </div>
      </AdminCard>

      {/* Environment Info (Optional) */}
      <AdminCard>
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <span className="text-2xl">⚙️</span>
          환경 정보
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white/5 rounded-lg p-4 border border-white/10">
            <div className="text-sm text-white/60 mb-2">런타임</div>
            <div className="text-white font-mono">Node.js</div>
          </div>
          <div className="bg-white/5 rounded-lg p-4 border border-white/10">
            <div className="text-sm text-white/60 mb-2">프레임워크</div>
            <div className="text-white font-mono">Next.js</div>
          </div>
          <div className="bg-white/5 rounded-lg p-4 border border-white/10">
            <div className="text-sm text-white/60 mb-2">환경</div>
            <div className="text-white font-mono">{process.env.NODE_ENV || "production"}</div>
          </div>
        </div>
      </AdminCard>
    </div>
  );
}
