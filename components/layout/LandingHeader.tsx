"use client";

import Link from "next/link";
import Image from "next/image";
import { Menu } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { ThemeSwitcher } from "@/components/ui/theme-switcher";
import { MobileDrawer } from "./MobileDrawer";

// ============================================
// Landing Header Component (Minimal - Focus on CTA)
// ============================================

export function LandingHeader() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-[60]">
        {/* Glassmorphism Background */}
        <div
          className={cn(
            "absolute inset-0",
            "bg-[var(--color-bg-primary)]/80",
            "backdrop-blur-xl",
            "border-b border-[var(--border-default)]"
          )}
        />

        {/* Content */}
        <nav className="relative mx-auto flex h-14 md:h-16 max-w-[1000px] items-center justify-between px-4">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 md:gap-2.5 group">
            <Image
              src="/logo.png"
              alt="CCgather Logo"
              width={32}
              height={32}
              priority
              className="w-7 h-7 md:w-8 md:h-8 rounded-md transition-all duration-300 group-hover:shadow-[var(--glow-primary)]"
            />
            <span className="text-base md:text-lg font-semibold text-[var(--color-text-primary)]">
              CCgather
            </span>
          </Link>

          {/* Desktop Right Section - Theme Only */}
          <div className="hidden md:flex items-center">
            <ThemeSwitcher size="sm" />
          </div>

          {/* Mobile Menu Button */}
          <button
            className={cn(
              "md:hidden p-2 -mr-2 rounded-lg",
              "text-[var(--color-text-secondary)]",
              "hover:text-[var(--color-text-primary)]",
              "hover:bg-[var(--glass-bg)]",
              "transition-colors duration-200"
            )}
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Open menu"
          >
            <Menu size={24} />
          </button>
        </nav>
      </header>

      {/* Mobile Drawer - Theme Only */}
      <MobileDrawer open={mobileMenuOpen} onClose={closeMobileMenu} title="Settings">
        <div className="flex flex-col p-4">
          <div className="flex items-center justify-between px-4 py-2">
            <span className="text-sm text-[var(--color-text-secondary)]">Theme</span>
            <ThemeSwitcher size="sm" />
          </div>
        </div>
      </MobileDrawer>
    </>
  );
}

export default LandingHeader;
