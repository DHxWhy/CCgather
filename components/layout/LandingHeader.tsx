"use client";

import Link from "next/link";
import Image from "next/image";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { ThemeSwitcher } from "@/components/ui/theme-switcher";
import { MobileDrawer } from "./MobileDrawer";
import { Button } from "@/components/ui/Button";

// Lazy load modals to defer JS loading until user interaction
const CLIModal = dynamic(() => import("@/components/cli/CLIModal").then((mod) => mod.CLIModal), {
  ssr: false,
});
const AuthModal = dynamic(
  () => import("@/components/auth/AuthModal").then((mod) => mod.AuthModal),
  {
    ssr: false,
  }
);

// ============================================
// Navigation Links
// ============================================

const navLinks = [
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/news", label: "News" },
  { href: "/tools", label: "Tools" },
];

// ============================================
// NavLink Component
// ============================================

interface NavLinkProps {
  href: string;
  label: string;
  isActive: boolean;
  onClick?: () => void;
  className?: string;
}

function NavLink({ href, label, isActive, onClick, className }: NavLinkProps) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "relative text-sm font-medium transition-colors duration-200",
        "group",
        isActive
          ? "text-[var(--color-text-primary)]"
          : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]",
        className
      )}
    >
      {label}
      {/* Underline animation */}
      <span
        className={cn(
          "absolute -bottom-1 left-0 h-0.5 rounded-full",
          "bg-gradient-to-r from-[var(--color-claude-coral)] to-[var(--color-claude-rust)]",
          "transition-all duration-300",
          isActive ? "w-full" : "w-0 group-hover:w-full"
        )}
      />
    </Link>
  );
}

// ============================================
// Mobile NavLink Component
// ============================================

function MobileNavLink({ href, label, isActive, onClick }: NavLinkProps) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "flex items-center px-4 py-3 rounded-xl",
        "text-base font-medium transition-all duration-200",
        "touch-target",
        isActive
          ? "text-[var(--color-text-primary)] bg-[var(--glass-bg)]"
          : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--glass-bg)]"
      )}
    >
      {label}
    </Link>
  );
}

// ============================================
// Landing Header Component (No Clerk)
// ============================================

export function LandingHeader() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [cliModalOpen, setCLIModalOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);

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
            {/* Logo Image */}
            <Image
              src="/logo.png"
              alt="CCgather Logo"
              width={32}
              height={32}
              priority
              className="w-7 h-7 md:w-8 md:h-8 rounded-md transition-all duration-300 group-hover:shadow-[var(--glow-primary)]"
            />
            {/* Logo Text */}
            <span className="text-base md:text-lg font-semibold text-[var(--color-text-primary)]">
              CCgather
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-6 xl:gap-8">
            {navLinks.map((link) => (
              <NavLink
                key={link.href}
                href={link.href}
                label={link.label}
                isActive={pathname === link.href}
              />
            ))}
            {/* CLI Button */}
            <button
              onClick={() => setCLIModalOpen(true)}
              className={cn(
                "relative text-sm font-medium transition-colors duration-200",
                "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]",
                "group"
              )}
            >
              CLI
              <span
                className={cn(
                  "absolute -bottom-1 left-0 h-0.5 rounded-full",
                  "bg-gradient-to-r from-[var(--color-claude-coral)] to-[var(--color-claude-rust)]",
                  "transition-all duration-300",
                  "w-0 group-hover:w-full"
                )}
              />
            </button>
          </div>

          {/* Desktop Right Section */}
          <div className="hidden md:flex items-center gap-3">
            <ThemeSwitcher size="sm" />
            <Button variant="primary" size="sm" onClick={() => setAuthModalOpen(true)}>
              Sign In
            </Button>
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

      {/* Mobile Drawer */}
      <MobileDrawer open={mobileMenuOpen} onClose={closeMobileMenu} title="Menu">
        <div className="flex flex-col p-4 gap-2">
          {/* Navigation Links */}
          {navLinks.map((link) => (
            <MobileNavLink
              key={link.href}
              href={link.href}
              label={link.label}
              isActive={pathname === link.href}
              onClick={closeMobileMenu}
            />
          ))}

          {/* CLI Button */}
          <button
            onClick={() => {
              closeMobileMenu();
              setCLIModalOpen(true);
            }}
            className={cn(
              "flex items-center px-4 py-3 rounded-xl",
              "text-base font-medium transition-all duration-200",
              "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--glass-bg)]"
            )}
          >
            CLI
          </button>

          {/* Divider */}
          <div className="my-4 border-t border-[var(--border-default)]" />

          {/* Theme Switcher */}
          <div className="flex items-center justify-between px-4 py-2">
            <span className="text-sm text-[var(--color-text-secondary)]">Theme</span>
            <ThemeSwitcher size="sm" />
          </div>

          {/* Auth Section */}
          <div className="px-4 pt-4">
            <Button
              variant="primary"
              size="lg"
              fullWidth
              onClick={() => {
                closeMobileMenu();
                setAuthModalOpen(true);
              }}
            >
              Sign In
            </Button>
          </div>
        </div>
      </MobileDrawer>

      {/* CLI Modal */}
      <CLIModal isOpen={cliModalOpen} onClose={() => setCLIModalOpen(false)} />

      {/* Auth Modal - only render when open to defer Clerk loading */}
      {authModalOpen && (
        <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />
      )}
    </>
  );
}

export default LandingHeader;
