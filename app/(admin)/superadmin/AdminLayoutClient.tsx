"use client";

import { useUser } from "@clerk/nextjs";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useMe } from "@/hooks/use-me";
import { useQuery } from "@tanstack/react-query";
import {
  Users,
  BarChart3,
  MessageSquare,
  Bug,
  Bot,
  UserX,
  PanelLeftClose,
  PanelLeftOpen,
  ArrowLeft,
  LayoutDashboard,
  Route,
  Filter,
  ScrollText,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface NotificationCounts {
  newFeedback: number;
  newUsers: number;
  newSubmits: number;
}

// macOS Notification Center 스타일 dot — 작고 미묘, 링 효과
function NewDot({ small = false }: { small?: boolean }) {
  return (
    <span
      className={`relative inline-flex shrink-0 rounded-full bg-[var(--color-claude-coral)] shadow-[0_0_0_2px_rgba(28,28,30,0.95)] ${
        small ? "h-1.5 w-1.5" : "h-2 w-2"
      }`}
      aria-label="새 항목 있음"
    >
      <span className="absolute inset-0 rounded-full bg-[var(--color-claude-coral)] animate-ping opacity-60" />
    </span>
  );
}

type MenuItem = {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
};

type MenuSection = {
  section: string;
  items: MenuItem[];
};

// macOS Big Sur+ 스타일 사이드바 메뉴 (lucide 아이콘)
const ADMIN_MENU: MenuSection[] = [
  {
    section: "Overview",
    items: [
      { id: "users", label: "사용자", href: "/superadmin", icon: Users },
      { id: "analytics", label: "Analytics", href: "/superadmin/analytics", icon: BarChart3 },
    ],
  },
  {
    section: "Content",
    items: [
      { id: "community", label: "Community", href: "/superadmin/community", icon: MessageSquare },
      { id: "feedback", label: "Feedback", href: "/superadmin/feedback", icon: Bug },
    ],
  },
  {
    section: "System",
    items: [
      { id: "ai-usage", label: "AI 사용량", href: "/superadmin/ai-usage", icon: Bot },
      { id: "deleted-users", label: "탈퇴 사용자", href: "/superadmin/deleted-users", icon: UserX },
    ],
  },
];

type AnalyticsSubItem = {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
};

// Analytics 서브메뉴
const ANALYTICS_SUBMENU: AnalyticsSubItem[] = [
  {
    id: "analytics-overview",
    label: "Overview",
    href: "/superadmin/analytics",
    icon: LayoutDashboard,
  },
  {
    id: "analytics-users",
    label: "웹 트래픽",
    href: "/superadmin/analytics/users",
    icon: BarChart3,
  },
  {
    id: "analytics-traffic",
    label: "유입 경로",
    href: "/superadmin/analytics/traffic",
    icon: Route,
  },
  {
    id: "analytics-funnels",
    label: "퍼널 분석",
    href: "/superadmin/analytics/funnels",
    icon: Filter,
  },
  {
    id: "analytics-submit-logs",
    label: "Submit Logs",
    href: "/superadmin/analytics/submit-logs",
    icon: ScrollText,
  },
];

// macOS easing curve (Apple HIG 표준)
const MAC_EASE = "cubic-bezier(0.25, 0.46, 0.45, 0.94)";

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
    refetchInterval: 60000,
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
      <div
        className="min-h-screen flex items-center justify-center"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(218,119,86,0.08) 0%, transparent 50%), #1c1c1e",
        }}
      >
        <div className="h-7 w-7 border-2 border-[var(--color-claude-coral)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const isActive = (href: string) => {
    if (href === "/superadmin") return pathname === "/superadmin";
    return pathname.startsWith(href);
  };

  const isAnalyticsSection = pathname.startsWith("/superadmin/analytics");
  const userName = user?.firstName || "Admin";
  const userEmail = user?.primaryEmailAddress?.emailAddress ?? "";

  return (
    <div
      className="min-h-screen flex"
      style={{
        background:
          "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(218,119,86,0.06) 0%, transparent 55%), #1c1c1e",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", system-ui, sans-serif',
        fontFeatureSettings: '"ss01", "cv11", "cv03"',
      }}
    >
      {/* macOS Big Sur+ Vibrancy Sidebar */}
      <aside
        className={`${
          sidebarCollapsed ? "w-[68px]" : "w-[240px]"
        } shrink-0 flex flex-col border-r border-white/[0.06]`}
        style={{
          background: "rgba(28, 28, 30, 0.72)",
          backdropFilter: "blur(40px) saturate(180%)",
          WebkitBackdropFilter: "blur(40px) saturate(180%)",
          transition: `width 280ms ${MAC_EASE}`,
        }}
        aria-label="Admin navigation"
      >
        {/* 로고 헤더 — 56px height (4pt grid) */}
        <div className="h-14 flex items-center px-4 border-b border-white/[0.05] shrink-0">
          {!sidebarCollapsed ? (
            <>
              <Link
                href="/"
                className="flex items-center gap-2 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20 rounded-md px-1 py-0.5"
              >
                <span
                  className="text-[14px] font-semibold tracking-[-0.01em] text-white/95"
                  style={{ fontFeatureSettings: '"ss01"' }}
                >
                  CCgather
                </span>
                <span className="text-[10px] leading-none px-1.5 py-[3px] rounded-[5px] font-semibold tracking-wide uppercase bg-[var(--color-claude-coral)]/15 text-[var(--color-claude-coral)] ring-1 ring-[var(--color-claude-coral)]/25">
                  Admin
                </span>
              </Link>
              <button
                type="button"
                onClick={() => setSidebarCollapsed(true)}
                aria-label="사이드바 접기"
                className="ml-auto inline-flex h-7 w-7 items-center justify-center rounded-md text-white/40 hover:bg-white/[0.06] hover:text-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
                style={{ transition: `all 180ms ${MAC_EASE}` }}
              >
                <PanelLeftClose className="h-[15px] w-[15px]" strokeWidth={1.75} />
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setSidebarCollapsed(false)}
              aria-label="사이드바 펼치기"
              className="mx-auto inline-flex h-8 w-8 items-center justify-center rounded-md text-white/50 hover:bg-white/[0.06] hover:text-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
              style={{ transition: `all 180ms ${MAC_EASE}` }}
            >
              <PanelLeftOpen className="h-[15px] w-[15px]" strokeWidth={1.75} />
            </button>
          )}
        </div>

        {/* 네비게이션 */}
        <nav className="flex-1 overflow-y-auto py-3" aria-label="Admin sections">
          {ADMIN_MENU.map((section) => (
            <div key={section.section} className="mb-3">
              {!sidebarCollapsed && (
                <div className="px-4 mb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-white/35">
                  {section.section}
                </div>
              )}
              <ul className={`space-y-[2px] ${sidebarCollapsed ? "px-2" : "px-2"}`}>
                {section.items.map((item) => {
                  const active = isActive(item.href);
                  const showDot = hasNewItems(item.id);
                  const Icon = item.icon;
                  return (
                    <li key={item.id} className="relative">
                      {/* Active accent stripe (왼쪽 indicator) */}
                      {active && !sidebarCollapsed && (
                        <span
                          aria-hidden="true"
                          className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-[2px] rounded-r-full bg-[var(--color-claude-coral)]"
                        />
                      )}
                      <Link
                        href={item.href}
                        title={sidebarCollapsed ? item.label : undefined}
                        aria-current={active ? "page" : undefined}
                        className={`group relative flex items-center ${
                          sidebarCollapsed ? "h-9 justify-center" : "h-8 gap-2.5 px-2.5"
                        } rounded-[7px] text-[13px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25 ${
                          active
                            ? "bg-white/[0.07] text-white"
                            : "text-white/65 hover:bg-white/[0.04] hover:text-white/90"
                        }`}
                        style={{
                          transition: `background-color 160ms ${MAC_EASE}, color 160ms ${MAC_EASE}, transform 160ms ${MAC_EASE}`,
                        }}
                      >
                        <Icon
                          className="h-[15px] w-[15px] shrink-0"
                          strokeWidth={active ? 2 : 1.75}
                          style={{
                            color: active ? "var(--color-claude-coral)" : "currentColor",
                          }}
                        />
                        {!sidebarCollapsed && (
                          <>
                            <span className="flex-1 truncate tracking-[-0.005em]">
                              {item.label}
                            </span>
                            {showDot && <NewDot />}
                          </>
                        )}
                      </Link>
                      {sidebarCollapsed && showDot && (
                        <span className="pointer-events-none absolute top-1 right-2.5">
                          <NewDot small />
                        </span>
                      )}

                      {/* Analytics 서브메뉴 — Inspector pane 스타일 */}
                      {item.id === "analytics" && isAnalyticsSection && !sidebarCollapsed && (
                        <ul
                          className="ml-[26px] mt-1 mb-1 space-y-[2px] border-l border-white/[0.06] pl-2.5"
                          aria-label="Analytics 서브메뉴"
                        >
                          {ANALYTICS_SUBMENU.map((sub) => {
                            const subActive = pathname === sub.href;
                            const subShowDot = hasNewSubItems(sub.id);
                            const SubIcon = sub.icon;
                            return (
                              <li key={sub.id}>
                                <Link
                                  href={sub.href}
                                  aria-current={subActive ? "page" : undefined}
                                  className={`flex items-center gap-2 h-7 px-2 rounded-md text-[12px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20 ${
                                    subActive
                                      ? "text-[var(--color-claude-coral)] bg-[var(--color-claude-coral)]/[0.06]"
                                      : "text-white/55 hover:text-white/85 hover:bg-white/[0.03]"
                                  }`}
                                  style={{
                                    transition: `all 160ms ${MAC_EASE}`,
                                  }}
                                >
                                  <SubIcon className="h-3 w-3 shrink-0" strokeWidth={1.75} />
                                  <span className="flex-1 truncate">{sub.label}</span>
                                  {subShowDot && <NewDot small />}
                                </Link>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* 하단 유저 정보 — macOS Inspector 스타일 */}
        <div className="shrink-0 border-t border-white/[0.05] p-2.5">
          <div
            className={`flex items-center rounded-[9px] ${
              sidebarCollapsed ? "justify-center p-1.5" : "gap-2.5 p-1.5"
            } bg-white/[0.025] ring-1 ring-white/[0.04]`}
            style={{
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04), 0 1px 2px rgba(0,0,0,0.25)",
            }}
          >
            {user?.imageUrl ? (
              <Image
                src={user.imageUrl}
                alt={`${userName} 프로필`}
                width={28}
                height={28}
                className="h-7 w-7 rounded-full ring-1 ring-white/10 shrink-0"
              />
            ) : (
              <div
                className="h-7 w-7 rounded-full bg-gradient-to-br from-white/15 to-white/5 ring-1 ring-white/10 shrink-0"
                aria-hidden="true"
              />
            )}
            {!sidebarCollapsed && (
              <div className="flex-1 min-w-0">
                <div
                  className="text-[12.5px] leading-tight font-medium text-white/90 truncate tracking-[-0.005em]"
                  title={userName}
                >
                  {userName}
                </div>
                <div
                  className="text-[10.5px] leading-tight text-white/45 truncate mt-0.5"
                  title={userEmail}
                >
                  {userEmail}
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* 메인 콘텐츠 */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* 상단 바 — frosted glass */}
        <header
          className="h-12 shrink-0 flex items-center px-5 border-b border-white/[0.05]"
          style={{
            background: "rgba(28, 28, 30, 0.65)",
            backdropFilter: "blur(24px) saturate(180%)",
            WebkitBackdropFilter: "blur(24px) saturate(180%)",
          }}
        >
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-[12px] font-medium text-white/45 hover:text-white/80 rounded-md px-1.5 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
            style={{ transition: `color 180ms ${MAC_EASE}` }}
          >
            <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.75} />
            <span className="tracking-[-0.005em]">사이트로 돌아가기</span>
          </Link>
        </header>

        {/* 페이지 콘텐츠 */}
        <main
          className="flex-1 overflow-auto p-6"
          style={{
            background:
              "radial-gradient(ellipse 60% 40% at 50% 0%, rgba(218,119,86,0.04) 0%, transparent 60%)",
          }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
