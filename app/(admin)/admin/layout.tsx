"use client";

import { useUser } from "@clerk/nextjs";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";

const ADMIN_TABS = [
  { id: "users", label: "사용자 관리", href: "/admin", icon: "👥" },
  { id: "ai-usage", label: "AI 사용량", href: "/admin/ai-usage", icon: "🤖" },
  { id: "contents", label: "콘텐츠 관리", href: "/admin/contents", icon: "📰" },
  { id: "automation", label: "뉴스 자동화", href: "/admin/automation", icon: "⚡" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    if (isLoaded && !user) {
      router.push("/sign-in");
      return;
    }

    // DB에서 관리자 권한 체크
    if (isLoaded && user) {
      fetch("/api/me")
        .then((res) => res.json())
        .then((data) => {
          if (data.user?.is_admin) {
            setIsAdmin(true);
          } else {
            setIsAdmin(false);
            if (process.env.NODE_ENV !== "development") {
              router.push("/");
            }
          }
        })
        .catch(() => {
          setIsAdmin(false);
          router.push("/");
        });
    }
  }, [isLoaded, user, router]);

  if (!isLoaded || isAdmin === null) {
    return (
      <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[var(--color-claude-coral)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const currentTab = ADMIN_TABS.find((tab) => {
    if (tab.href === "/admin") {
      return pathname === "/admin";
    }
    return pathname.startsWith(tab.href);
  });

  return (
    <div className="min-h-screen bg-[#0d0d0d]">
      {/* Admin Header */}
      <header className="border-b border-white/10 bg-[#1a1a1a]">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/" className="text-white/60 hover:text-white transition-colors">
                ← 사이트로 돌아가기
              </Link>
              <span className="text-white/20">|</span>
              <h1 className="text-xl font-bold text-white">🔧 CCgather Admin</h1>
            </div>
            <div className="text-sm text-white/60">{user?.primaryEmailAddress?.emailAddress}</div>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <nav className="border-b border-white/10 bg-[#1a1a1a]/50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-1">
            {ADMIN_TABS.map((tab) => {
              const isActive = currentTab?.id === tab.id;
              return (
                <Link
                  key={tab.id}
                  href={tab.href}
                  className={`
                    px-6 py-4 text-sm font-medium transition-colors relative
                    ${
                      isActive
                        ? "text-[var(--color-claude-coral)]"
                        : "text-white/60 hover:text-white"
                    }
                  `}
                >
                  <span className="flex items-center gap-2">
                    <span>{tab.icon}</span>
                    <span>{tab.label}</span>
                  </span>
                  {isActive && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--color-claude-coral)]" />
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
