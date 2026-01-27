"use client";

import { useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useUser, useClerk } from "@clerk/nextjs";
import Link from "next/link";
import { User, BarChart3, Bell, LogOut, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/settings", label: "Profile", icon: User },
  { href: "/settings/notifications", label: "Notifications", icon: Bell },
  { href: "/settings/usage", label: "Heatmap", icon: BarChart3 },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const router = useRouter();
  const pathname = usePathname();
  const tabsRef = useRef<HTMLDivElement>(null);
  const activeTabRef = useRef<HTMLAnchorElement>(null);

  // Redirect to home if not logged in
  useEffect(() => {
    if (isLoaded && !user) {
      router.replace("/");
    }
  }, [isLoaded, user, router]);

  // Scroll active tab into view on mobile
  useEffect(() => {
    if (activeTabRef.current && tabsRef.current) {
      const container = tabsRef.current;
      const element = activeTabRef.current;
      const containerRect = container.getBoundingClientRect();
      const elementRect = element.getBoundingClientRect();

      if (elementRect.left < containerRect.left || elementRect.right > containerRect.right) {
        element.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
      }
    }
  }, [pathname]);

  // Show loading while checking auth
  if (!isLoaded) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Don't render if not logged in
  if (!user) {
    return null;
  }

  const handleSignOut = () => {
    signOut({ redirectUrl: "/" });
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] md:flex md:h-[calc(100vh-4rem)] md:overflow-hidden">
      {/* Mobile Header - Top Tabs */}
      <div className="md:hidden sticky top-16 z-40 bg-[var(--color-bg-primary)] border-b border-[var(--border-default)]">
        {/* Back + Title Row */}
        <div className="flex items-center justify-between px-4 py-2">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Back</span>
          </Link>
          <h1 className="text-base font-semibold text-[var(--color-text-primary)]">Settings</h1>
          <button
            onClick={handleSignOut}
            className="p-2 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
            aria-label="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div
          ref={tabsRef}
          className="flex items-center gap-1 px-4 pb-3 overflow-x-auto scrollbar-hide"
        >
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                ref={isActive ? activeTabRef : undefined}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors",
                  isActive
                    ? "bg-[var(--color-claude-coral)]/15 text-[var(--color-claude-coral)]"
                    : "bg-[var(--color-section-bg)] text-[var(--color-text-secondary)] hover:bg-[var(--color-section-bg-hover)]"
                )}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Desktop Sidebar - Hidden on Mobile */}
      <aside className="hidden md:block w-56 flex-shrink-0 border-r border-[var(--border-default)] bg-[var(--color-bg-secondary)]">
        <div className="sticky top-16 p-4 flex flex-col h-[calc(100vh-4rem)]">
          {/* Back Button */}
          <Link
            href="/"
            className="flex items-center gap-2 px-3 py-2 mb-4 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Back to Home</span>
          </Link>

          {/* Title */}
          <h1 className="px-3 text-lg font-semibold text-[var(--color-text-primary)] mb-4">
            Settings
          </h1>

          {/* Navigation */}
          <nav className="flex-1 space-y-1">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                    isActive
                      ? "bg-[var(--color-claude-coral)]/10 text-[var(--color-claude-coral)]"
                      : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-white/5"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Sign Out */}
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all mt-auto"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
