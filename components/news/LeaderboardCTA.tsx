"use client";

import Link from "next/link";
import { Trophy, ArrowRight } from "lucide-react";

export default function LeaderboardCTA() {
  return (
    <section className="my-6 p-4 rounded-xl bg-gradient-to-br from-amber-500/10 to-orange-500/5 border border-amber-500/20">
      <div className="flex flex-col items-center text-center gap-3">
        <div className="flex items-center gap-1.5 text-amber-400">
          <Trophy className="w-5 h-5" />
          <h3 className="text-sm font-semibold">Prove Your Dedication</h3>
        </div>

        <p className="text-[var(--color-text-secondary)] text-[12px] leading-relaxed max-w-md">
          Submit your Claude Code usage
          <br />
          and prove your passion to the world.
        </p>

        <Link
          href="/leaderboard"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-500 text-black text-[12px] font-medium hover:bg-amber-400 transition-colors"
        >
          Submit &amp; Claim Your Rank
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </section>
  );
}
