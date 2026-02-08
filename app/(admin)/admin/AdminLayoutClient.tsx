"use client";

import { useUser } from "@clerk/nextjs";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useMe } from "@/hooks/use-me";
import { useQuery } from "@tanstack/react-query";

interface NotificationCounts {
  newFeedback: number;
  newUsers: number;
  newSubmits: number;
}

// New indicator dot component
function NewDot() {
  return <span className="w-2 h-2 rounded-full bg-[var(--color-claude-coral)] animate-pulse" />;
}

// Mac 스타일 사이드바 메뉴 구조
const ADMIN_MENU = [
  {
    section: "Overview",
    items: [
      { id: "users", label: "사용자", href: "/admin", icon: "👥" },
      { id: "analytics", label: "Analytics", href: "/admin/analytics", icon: "📊" },
    ],
  },
  {
    section: "콘텐츠",
    items: [
      { id: "community", label: "Community", href: "/admin/community", icon: "💬" },
      { id: "feedback", label: "Feedback", href: "/admin/feedback", icon: "🐛" },
    ],
  },
  {
    section: "시스템",
    items: [
      { id: "ai-usage", label: "AI 사용량", href: "/admin/ai-usage", icon: "🤖" },
      { id: "deleted-users", label: "탈퇴 사용자", href: "/admin/deleted-users", icon: "🚫" },
    ],
  },
];

// Analytics 서브메뉴
const ANALYTICS_SUBMENU = [
  { id: "analytics-overview", label: "Overview", href: "/admin/analytics" },
  { id: "analytics-users", label: "웹 트래픽", href: "/admin/analytics/users" },
  { id: "analytics-traffic", label: "유입 경로", href: "/admin/analytics/traffic" },
  { id: "analytics-funnels", label: "퍼널 분석", href: "/admin/analytics/funnels" },
  { id: "analytics-submit-logs", label: "Submit Logs", href: "/admin/analytics/submit-logs" },
];

export function AdminLayoutClient({ children }: { children: React.ReactNode }) {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // React Query: Cached /api/me call with admin check
  const {
    data: meData,
    isLoading: isMeLoading,
    error: meError,
  } = useMe({
    enabled: isLoaded && !!user,
  });

  // Fetch notification counts
  const { data: notifications } = useQuery<NotificationCounts>({
    queryKey: ["admin-notifications"],
    queryFn: async () => {
      const res = await fetch("/api/admin/notifications");
      if (!res.ok) throw new Error("Failed to fetch notifications");
      return res.json();
    },
    enabled: !!meData?.is_admin,
    refetchInterval: 60000, // Refresh every minute
  });

  // Helper to check if menu item has new items
  const hasNewItems = (itemId: string): boolean => {
    if (!notifications) return false;
    switch (itemId) {
      case "users":
        return notifications.newUsers > 0;
      case "feedback":
        return notifications.newFeedback > 0;
      default:
        return false;
    }
  };

  // Helper to check if submenu item has new items
  const hasNewSubItems = (subId: string): boolean => {
    if (!notifications) return false;
    if (subId === "analytics-submit-logs") {
      return notifications.newSubmits > 0;
    }
    return false;
  };

  // Derive admin status from cached data
  const isAdmin = meData?.is_admin ?? null;

  useEffect(() => {
    if (isLoaded && !user) {
      router.push("/sign-in");
      return;
    }

    // Handle non-admin redirect
    if (isLoaded && user && meData !== undefined && !isMeLoading) {
      if (!meData?.is_admin) {
        if (process.env.NODE_ENV !== "development") {
          router.push("/");
        }
      }
    }

    // Handle fetch error
    if (meError) {
      router.push("/");
    }
  }, [isLoaded, user, router, meData, isMeLoading, meError]);

  if (!isLoaded || isMeLoading || isAdmin === null) {
    return (
      <div className="min-h-screen bg-[#0d0d0d] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[var(--color-claude-coral)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const isActive = (href: string) => {
    if (href === "/admin") return pathname === "/admin";
    return pathname.startsWith(href);
  };

  const isAnalyticsSection = pathname.startsWith("/admin/analytics");

  return (
    <div className="min-h-screen bg-[#0d0d0d] flex">
      {/* Mac 스타일 사이드바 */}
      <aside
        className={`${
          sidebarCollapsed ? "w-16" : "w-56"
        } bg-[#161616] border-r border-white/[0.06] flex flex-col transition-all duration-200 shrink-0`}
      >
        {/* 로고 헤더 */}
        <div className="h-12 flex items-center px-4 border-b border-white/[0.06]">
          {!sidebarCollapsed && (
            <Link href="/" className="flex items-center gap-2 group">
              <span className="text-sm font-semibold text-white/90">CCgather</span>
              <span className="text-[10px] px-1.5 py-0.5 bg-[var(--color-claude-coral)]/20 text-[var(--color-claude-coral)] rounded font-medium">
                Admin
              </span>
            </Link>
          )}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className={`${sidebarCollapsed ? "mx-auto" : "ml-auto"} p-1 rounded hover:bg-white/5 text-white/40 hover:text-white/60 transition-colors`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {sidebarCollapsed ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M13 5l7 7-7 7M5 5l7 7-7 7"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M11 19l-7-7 7-7M19 19l-7-7 7-7"
                />
              )}
            </svg>
          </button>
        </div>

        {/* 네비게이션 */}
        <nav className="flex-1 py-3 overflow-y-auto">
          {ADMIN_MENU.map((section) => (
            <div key={section.section} className="mb-4">
              {!sidebarCollapsed && (
                <div className="px-4 mb-1.5 text-[10px] font-medium text-white/30 uppercase tracking-wider">
                  {section.section}
                </div>
              )}
              <div className="space-y-0.5 px-2">
                {section.items.map((item) => {
                  const active = isActive(item.href);
                  const showDot = hasNewItems(item.id);
                  return (
                    <div key={item.id} className="relative">
                      <Link
                        href={item.href}
                        className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[13px] transition-colors ${
                          active
                            ? "bg-white/[0.08] text-white"
                            : "text-white/60 hover:bg-white/[0.04] hover:text-white/80"
                        }`}
                        title={sidebarCollapsed ? item.label : undefined}
                      >
                        <span className="text-sm shrink-0">{item.icon}</span>
                        {!sidebarCollapsed && (
                          <>
                            <span className="flex-1">{item.label}</span>
                            {showDot && <NewDot />}
                          </>
                        )}
                      </Link>
                      {sidebarCollapsed && showDot && (
                        <span className="absolute top-0 right-0">
                          <NewDot />
                        </span>
                      )}

                      {/* Analytics 서브메뉴 */}
                      {item.id === "analytics" && isAnalyticsSection && !sidebarCollapsed && (
                        <div className="ml-6 mt-1 space-y-0.5 border-l border-white/[0.06] pl-2.5">
                          {ANALYTICS_SUBMENU.map((sub) => {
                            const subActive = pathname === sub.href;
                            const subShowDot = hasNewSubItems(sub.id);
                            return (
                              <Link
                                key={sub.id}
                                href={sub.href}
                                className={`flex items-center gap-2 px-2 py-1 rounded text-[12px] transition-colors ${
                                  subActive
                                    ? "text-[var(--color-claude-coral)]"
                                    : "text-white/50 hover:text-white/70"
                                }`}
                              >
                                <span className="flex-1">{sub.label}</span>
                                {subShowDot && <NewDot />}
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* 하단 유저 정보 */}
        <div className="border-t border-white/[0.06] p-3">
          {!sidebarCollapsed ? (
            <div className="flex items-center gap-2.5">
              {user?.imageUrl ? (
                <Image src={user.imageUrl} alt="" width={28} height={28} className="rounded-full" />
              ) : (
                <div className="w-7 h-7 rounded-full bg-white/10" />
              )}
              <div className="flex-1 min-w-0">
                <div className="text-[12px] text-white/80 truncate">
                  {user?.firstName || "Admin"}
                </div>
                <div className="text-[10px] text-white/40 truncate">
                  {user?.primaryEmailAddress?.emailAddress}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex justify-center">
              {user?.imageUrl ? (
                <Image src={user.imageUrl} alt="" width={28} height={28} className="rounded-full" />
              ) : (
                <div className="w-7 h-7 rounded-full bg-white/10" />
              )}
            </div>
          )}
        </div>
      </aside>

      {/* 메인 콘텐츠 */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* 상단 바 */}
        <header className="h-12 border-b border-white/[0.06] bg-[#0d0d0d] flex items-center px-5 shrink-0">
          <Link
            href="/"
            className="text-[12px] text-white/40 hover:text-white/60 transition-colors flex items-center gap-1"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
            사이트로 돌아가기
          </Link>
        </header>

        {/* 페이지 콘텐츠 */}
        <main className="flex-1 overflow-auto p-5">{children}</main>
      </div>
    </div>
  );
}
