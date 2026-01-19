"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { Menu, Settings } from "lucide-react";
import { useState, useEffect, lazy, Suspense } from "react";
import { cn } from "@/lib/utils";
import { ThemeSwitcher } from "@/components/ui/theme-switcher";
import { MobileDrawer } from "./MobileDrawer";
import { Button } from "@/components/ui/Button";

// Modal 컴포넌트 지연 로딩 - 초기 번들 크기 감소
const CLIModal = lazy(() =>
  import("@/components/cli/CLIModal").then((mod) => ({ default: mod.CLIModal }))
);
const AuthModal = lazy(() =>
  import("@/components/auth/AuthModal").then((mod) => ({ default: mod.AuthModal }))
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
// Header Component
// ============================================

export function Header() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [cliModalOpen, setCLIModalOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [clerkFailed, setClerkFailed] = useState(false);

  // Clerk 로드 상태 체크
  const { isLoaded, isSignedIn } = useAuth();

  // Clerk 로드 타임아웃 체크 (10초 후에도 로드 안되면 실패로 간주)
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!isLoaded) {
        setClerkFailed(true);
      }
    }, 10000);

    if (isLoaded) {
      clearTimeout(timeout);
      setClerkFailed(false);
    }

    return () => clearTimeout(timeout);
  }, [isLoaded]);

  const closeMobileMenu = () => setMobileMenuOpen(false);

  // Sign In 버튼을 보여줄지 결정
  // Clerk 로드 전, 로드 실패, 또는 로그아웃 상태일 때 표시
  const showSignInButton = !isLoaded || clerkFailed || !isSignedIn;

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

            {/* Sign In 버튼: Clerk 로드 전/실패/로그아웃 상태에서 표시 */}
            {showSignInButton && (
              <Button variant="primary" size="sm" onClick={() => setAuthModalOpen(true)}>
                Sign In
              </Button>
            )}

            {/* 로그인 상태: Clerk 로드 완료 + 로그인됨 */}
            {isLoaded && isSignedIn && !clerkFailed && (
              <Link
                href="/settings"
                className="flex items-center justify-center w-8 h-8 rounded-full border border-[var(--border-default)] hover:border-[var(--color-text-muted)] transition-colors group"
                aria-label="Settings"
              >
                <Settings
                  size={14}
                  className="text-[var(--color-text-muted)] group-hover:text-[var(--color-text-secondary)] transition-colors"
                />
              </Link>
            )}
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
            {showSignInButton ? (
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
            ) : (
              <Link
                href="/settings"
                onClick={closeMobileMenu}
                className={cn(
                  "w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl",
                  "text-base font-medium transition-all duration-200",
                  "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]",
                  "border border-[var(--border-default)] hover:border-[var(--color-text-muted)]"
                )}
              >
                <Settings size={18} />
                Settings
              </Link>
            )}
          </div>
        </div>
      </MobileDrawer>

      {/* CLI Modal - 지연 로딩 */}
      {cliModalOpen && (
        <Suspense fallback={null}>
          <CLIModal isOpen={cliModalOpen} onClose={() => setCLIModalOpen(false)} />
        </Suspense>
      )}

      {/* Auth Modal - 지연 로딩 */}
      {authModalOpen && (
        <Suspense fallback={null}>
          <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />
        </Suspense>
      )}
    </>
  );
}

export default Header;
