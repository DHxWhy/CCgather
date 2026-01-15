"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useUser, useClerk } from "@clerk/nextjs";
import Link from "next/link";
import { User, Activity, BarChart3, LogOut, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/settings", label: "Profile", icon: User },
  { href: "/settings/activity", label: "Activity", icon: Activity },
  { href: "/settings/usage", label: "Usage Heatmap", icon: BarChart3 },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const router = useRouter();
  const pathname = usePathname();

  // Redirect to home if not logged in
  useEffect(() => {
    if (isLoaded && !user) {
      router.replace("/");
    }
  }, [isLoaded, user, router]);

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

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 border-r border-[var(--border-default)] bg-[var(--color-bg-secondary)]">
        <div className="sticky top-16 p-4 flex flex-col h-[calc(100vh-4rem)]">
          {/* Back Button */}
          <Link
            href="/"
            className="flex items-center gap-2 px-3 py-2 mb-4 text-sm text-text-muted hover:text-text-primary transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Back to Home</span>
          </Link>

          {/* Title */}
          <h1 className="px-3 text-lg font-semibold text-text-primary mb-4">Settings</h1>

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
                      ? "bg-primary/10 text-primary"
                      : "text-text-muted hover:text-text-primary hover:bg-white/5"
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
