"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { Menu, Settings, Github, Bug, HelpCircle } from "lucide-react";
import { useState, useEffect, lazy, Suspense } from "react";
import { cn } from "@/lib/utils";
import { ThemeSwitcher } from "@/components/ui/theme-switcher";
import { MobileDrawer } from "./MobileDrawer";
import { Button } from "@/components/ui/Button";
import NotificationBell from "@/components/community/NotificationBell";
import { useMe } from "@/hooks/use-me";

// Modal 컴포넌트 지연 로딩 - 초기 번들 크기 감소
const CLIModal = lazy(() =>
  import("@/components/cli/CLIModal").then((mod) => ({ default: mod.CLIModal }))
);
const FAQModal = lazy(() =>
  import("@/components/cli/FAQModal").then((mod) => ({ default: mod.FAQModal }))
);
const AuthModal = lazy(() =>
  import("@/components/auth/AuthModal").then((mod) => ({ default: mod.AuthModal }))
);
const FeedbackModal = lazy(() =>
  import("@/components/feedback/FeedbackModal").then((mod) => ({ default: mod.FeedbackModal }))
);

// ============================================
// Navigation Links
// ============================================

const navLinks = [
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/community", label: "Community" },
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
        "relative text-[13px] font-medium transition-colors duration-200",
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
          "absolute -bottom-0.5 left-0 h-0.5 rounded-full",
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
  const [faqModalOpen, setFaqModalOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);
  const [clerkFailed, setClerkFailed] = useState(false);

  // Clerk 로드 상태 체크
  const { isLoaded, isSignedIn } = useAuth();

  // 사용자 데이터 (CLI 미제출 상태 확인용)
  const { data: me } = useMe({ enabled: isSignedIn === true });
  const hasNeverSubmitted = isSignedIn && me && !me.last_submission_at;
  // 온보딩 완료 여부 (Settings, NotificationBell, FeedbackButton은 온보딩 완료 후에만 표시)
  const isOnboardingDone = isSignedIn && me?.onboarding_completed === true;

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
  // Clerk 로드 완료 후 로그아웃 상태이거나, 로드 실패 시에만 표시
  // (로드 중에는 표시하지 않아 깜빡임 방지)
  const showSignInButton = (isLoaded && !isSignedIn) || clerkFailed;

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-[60]">
        {/* Glassmorphism Background */}
        <div
          className={cn(
            "absolute inset-0",
            "bg-[var(--color-bg-primary)]/80",
            "backdrop-blur-xl",
            "border-b border-white/10"
          )}
        />

        {/* Content */}
        <nav className="relative mx-auto flex h-12 max-w-[1000px] items-center justify-between px-4">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            {/* Logo Image */}
            <Image
              src="/logos/logo.png"
              alt="CCgather Logo"
              width={24}
              height={24}
              priority
              className="w-6 h-6 rounded-md transition-all duration-300 group-hover:shadow-[var(--glow-primary)]"
            />
            {/* Logo Text - Space Grotesk */}
            <span
              className="text-sm font-semibold text-[var(--color-text-primary)]"
              style={{ fontFamily: "var(--font-logo)" }}
            >
              CCgather
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-5">
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
              onClick={() => {
                setFaqModalOpen(false);
                setCLIModalOpen(true);
              }}
              className={cn(
                "relative text-[13px] font-medium transition-colors duration-200",
                "group",
                hasNeverSubmitted
                  ? "shimmer-text" // 미제출 회원: 쉬머 효과
                  : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              )}
            >
              CLI
              <span
                className={cn(
                  "absolute -bottom-0.5 left-0 h-0.5 rounded-full",
                  "bg-gradient-to-r from-[var(--color-claude-coral)] to-[var(--color-claude-rust)]",
                  "transition-all duration-300",
                  hasNeverSubmitted ? "w-full" : "w-0 group-hover:w-full"
                )}
              />
            </button>
            {/* FAQ Button */}
            <button
              onClick={() => {
                setCLIModalOpen(false);
                setFaqModalOpen(true);
              }}
              className={cn(
                "relative text-[13px] font-medium transition-colors duration-200",
                "group",
                "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              )}
            >
              FAQ
              <span
                className={cn(
                  "absolute -bottom-0.5 left-0 h-0.5 rounded-full",
                  "bg-gradient-to-r from-[var(--color-claude-coral)] to-[var(--color-claude-rust)]",
                  "transition-all duration-300",
                  "w-0 group-hover:w-full"
                )}
              />
            </button>
          </div>

          {/* Desktop Right Section */}
          <div className="hidden md:flex items-center gap-3">
            {/* Sign In 버튼: Clerk 로드 완료 + 로그아웃 상태 또는 로드 실패 시 */}
            {showSignInButton && (
              <Button variant="primary" size="sm" onClick={() => setAuthModalOpen(true)}>
                Sign In
              </Button>
            )}

            {/* 로그인 상태 + 온보딩 완료: Notification Bell */}
            {isOnboardingDone && (
              <div className={cn("transition-opacity", isLoaded ? "opacity-100" : "opacity-0")}>
                <NotificationBell />
              </div>
            )}

            <ThemeSwitcher size="sm" />

            {/* Feedback Button - 온보딩 완료 사용자만 */}
            {isOnboardingDone && (
              <button
                onClick={() => setFeedbackModalOpen(true)}
                className={cn(
                  "flex items-center justify-center w-8 h-8 rounded-full border transition-all group",
                  isLoaded ? "opacity-100" : "opacity-0",
                  "border-[var(--border-default)] hover:border-[var(--color-text-muted)]"
                )}
                aria-label="Send Feedback"
              >
                <Bug
                  size={14}
                  className="text-[var(--color-text-muted)] group-hover:text-[var(--color-text-secondary)] transition-colors"
                />
              </button>
            )}

            {/* GitHub Link */}
            <a
              href="https://github.com/DHxWhy/CCgather"
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "flex items-center justify-center w-8 h-8 rounded-full border transition-all group",
                "border-[var(--border-default)] hover:border-[var(--color-text-muted)]"
              )}
              aria-label="GitHub Repository"
            >
              <Github
                size={14}
                className="text-[var(--color-text-muted)] group-hover:text-[var(--color-text-secondary)] transition-colors"
              />
            </a>

            {/* 온보딩 완료 후: Settings */}
            {isOnboardingDone && (
              <Link
                href="/settings"
                className={cn(
                  "flex items-center justify-center w-8 h-8 rounded-full border transition-all group",
                  isLoaded ? "opacity-100" : "opacity-0",
                  pathname.startsWith("/settings")
                    ? "border-[var(--color-claude-coral)] bg-[var(--color-claude-coral)]/10"
                    : "border-[var(--border-default)] hover:border-[var(--color-text-muted)]"
                )}
                aria-label="Settings"
              >
                <Settings
                  size={14}
                  className={cn(
                    "transition-colors",
                    pathname.startsWith("/settings")
                      ? "text-[var(--color-claude-coral)]"
                      : "text-[var(--color-text-muted)] group-hover:text-[var(--color-text-secondary)]"
                  )}
                />
              </Link>
            )}
          </div>

          {/* Mobile Right Section */}
          <div className="flex md:hidden items-center gap-1">
            {/* Notification Bell - Mobile (온보딩 완료 후에만) */}
            {isOnboardingDone && <NotificationBell />}

            {/* Mobile Menu Button */}
            <button
              className={cn(
                "p-2 -mr-2 rounded-lg",
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
          </div>
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
              hasNeverSubmitted
                ? "shimmer-text hover:bg-[var(--glass-bg)]" // 미제출 회원: 쉬머 효과
                : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--glass-bg)]"
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

          {/* FAQ Button */}
          <button
            onClick={() => {
              closeMobileMenu();
              setFaqModalOpen(true);
            }}
            className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-xl",
              "text-base font-medium transition-all duration-200",
              "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--glass-bg)]"
            )}
          >
            <HelpCircle size={18} />
            FAQ
          </button>

          {/* GitHub Link */}
          <a
            href="https://github.com/DHxWhy/CCgather"
            target="_blank"
            rel="noopener noreferrer"
            onClick={closeMobileMenu}
            className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-xl",
              "text-base font-medium transition-all duration-200",
              "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--glass-bg)]"
            )}
          >
            <Github size={18} />
            GitHub
          </a>

          {/* Feedback Button - 온보딩 완료 사용자만 (모바일) */}
          {isOnboardingDone && (
            <button
              onClick={() => {
                closeMobileMenu();
                setFeedbackModalOpen(true);
              }}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl",
                "text-base font-medium transition-all duration-200",
                "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--glass-bg)]"
              )}
            >
              <Bug size={18} />
              Send Feedback
            </button>
          )}

          {/* Auth Section */}
          <div className="px-4 pt-4 space-y-2">
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
            ) : isOnboardingDone ? (
              <Link
                href="/settings"
                onClick={closeMobileMenu}
                className={cn(
                  "w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl",
                  "text-base font-medium transition-all duration-200",
                  pathname.startsWith("/settings")
                    ? "text-[var(--color-claude-coral)] bg-[var(--color-claude-coral)]/10 border border-[var(--color-claude-coral)]"
                    : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] border border-[var(--border-default)] hover:border-[var(--color-text-muted)]"
                )}
              >
                <Settings size={18} />
                Settings
              </Link>
            ) : null}
          </div>
        </div>
      </MobileDrawer>

      {/* CLI Modal - 지연 로딩 */}
      {cliModalOpen && (
        <Suspense fallback={null}>
          <CLIModal isOpen={cliModalOpen} onClose={() => setCLIModalOpen(false)} />
        </Suspense>
      )}

      {/* FAQ Modal - 지연 로딩 */}
      {faqModalOpen && (
        <Suspense fallback={null}>
          <FAQModal isOpen={faqModalOpen} onClose={() => setFaqModalOpen(false)} />
        </Suspense>
      )}

      {/* Auth Modal - 지연 로딩 */}
      {authModalOpen && (
        <Suspense fallback={null}>
          <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />
        </Suspense>
      )}

      {/* Feedback Modal - 지연 로딩 */}
      {feedbackModalOpen && (
        <Suspense fallback={null}>
          <FeedbackModal isOpen={feedbackModalOpen} onClose={() => setFeedbackModalOpen(false)} />
        </Suspense>
      )}
    </>
  );
}

export default Header;
