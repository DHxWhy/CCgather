"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

export function Footer() {
  const pathname = usePathname();
  const isLeaderboard = pathname === "/leaderboard";

  return (
    <footer
      className={`border-t border-[var(--border-default)] py-4 bg-[var(--color-bg-primary)] ${isLeaderboard ? "hidden lg:block" : ""}`}
    >
      <div className="mx-auto max-w-7xl px-4 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Image
            src="/logos/logo.png"
            alt="CCgather Logo"
            width={24}
            height={24}
            className="rounded-sm opacity-70"
          />
          <span className="font-semibold text-[var(--color-text-secondary)]">CCgather</span>
          <span className="text-[var(--color-text-muted)] text-sm">
            &copy; {new Date().getFullYear()}
          </span>
        </div>

        <div className="flex items-center gap-6 text-sm text-text-secondary">
          <Link href="/privacy" className="hover:text-text-primary transition-colors">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-text-primary transition-colors">
            Terms
          </Link>
          <a
            href="https://github.com/DHxWhy/CCgather"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-text-primary transition-colors"
          >
            GitHub
          </a>
        </div>
      </div>
    </footer>
  );
}
