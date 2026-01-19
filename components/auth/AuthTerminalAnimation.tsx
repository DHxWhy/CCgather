"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface TerminalLine {
  text: string;
  type:
    | "command"
    | "header"
    | "success"
    | "muted"
    | "box"
    | "stat"
    | "empty"
    | "rank"
    | "link"
    | "logo-primary"
    | "logo-secondary";
  delay: number;
}

// CLI submit flow animation
// Flow: command → auth → scan → measure → rank/level → submit
const TERMINAL_LINES: TerminalLine[] = [
  // 1. Command
  { text: "$ npx ccgather", type: "command", delay: 0 },
  { text: "", type: "empty", delay: 500 },

  // 2. Auth verification
  { text: "🔐 Verifying authentication...", type: "muted", delay: 800 },
  { text: "✓ Authenticated as DHxYoon", type: "success", delay: 1400 },
  { text: "", type: "empty", delay: 1700 },

  // 3. Session scan
  { text: "📁 Scanning Claude Code sessions...", type: "muted", delay: 2000 },
  { text: "   Found 127 sessions in 3 projects", type: "muted", delay: 2600 },
  { text: "✓ Scan complete", type: "success", delay: 3000 },
  { text: "", type: "empty", delay: 3300 },

  // 4. Usage measurement
  { text: "📊 Calculating usage metrics...", type: "muted", delay: 3600 },
  { text: "┌─────────────────────────────────┐", type: "box", delay: 4000 },
  { text: "│  Total Tokens    12,847,291    │", type: "stat", delay: 4200 },
  { text: "│  Total Cost      $384.52       │", type: "stat", delay: 4400 },
  { text: "│  Active Days     89 days       │", type: "stat", delay: 4600 },
  { text: "└─────────────────────────────────┘", type: "box", delay: 4800 },
  { text: "", type: "empty", delay: 5100 },

  // 5. Rank & Level calculation
  { text: "🏆 Calculating rank & level...", type: "muted", delay: 5400 },
  { text: "┌─────────────────────────────────┐", type: "box", delay: 5800 },
  { text: "│  👑 Level 6 · Grandmaster       │", type: "logo-primary", delay: 6000 },
  { text: "│  🌍 Global Rank: #1             │", type: "rank", delay: 6200 },
  { text: "│  🇰🇷 Country Rank: #1           │", type: "rank", delay: 6400 },
  { text: "└─────────────────────────────────┘", type: "box", delay: 6600 },
  { text: "", type: "empty", delay: 6900 },

  // 6. Submit
  { text: "📤 Submitting to leaderboard...", type: "muted", delay: 7200 },
  { text: "✓ Successfully submitted!", type: "success", delay: 7800 },
  { text: "", type: "empty", delay: 8100 },
  { text: "🔗 View: ccgather.com/u/DHxYoon", type: "logo-primary", delay: 8400 },
];

const MAX_VISIBLE_LINES = 14;

export function AuthTerminalAnimation() {
  const [visibleLines, setVisibleLines] = useState<number>(0);
  const [isTyping, setIsTyping] = useState(true);
  const [cycleCount, setCycleCount] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);

  const resetAnimation = useCallback(() => {
    setVisibleLines(0);
    setIsTyping(true);
    setCycleCount((c) => c + 1);
  }, []);

  useEffect(() => {
    const timers: NodeJS.Timeout[] = [];

    TERMINAL_LINES.forEach((line, index) => {
      const timer = setTimeout(() => {
        setVisibleLines(index + 1);
        if (index === TERMINAL_LINES.length - 1) {
          setIsTyping(false);
        }
      }, line.delay);
      timers.push(timer);
    });

    const resetTimer = setTimeout(() => {
      resetAnimation();
    }, 10000);
    timers.push(resetTimer);

    return () => {
      timers.forEach((timer) => clearTimeout(timer));
    };
  }, [cycleCount, resetAnimation]);

  // Auto scroll to bottom
  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [visibleLines]);

  const getLineStyle = (type: TerminalLine["type"]) => {
    switch (type) {
      case "command":
        return "text-white font-medium";
      case "header":
        return "text-white font-semibold";
      case "success":
        return "text-emerald-400";
      case "muted":
        return "text-zinc-500";
      case "box":
        return "text-zinc-600";
      case "stat":
        return "text-[var(--color-claude-coral)]";
      case "rank":
        return "text-white font-semibold";
      case "link":
        return "text-[var(--color-claude-coral)] underline";
      case "logo-primary":
        return "text-[var(--color-claude-coral)] font-bold";
      case "logo-secondary":
        return "text-orange-400";
      default:
        return "";
    }
  };

  // Calculate which lines to show (sliding window)
  const startIndex = Math.max(0, visibleLines - MAX_VISIBLE_LINES);
  const displayLines = TERMINAL_LINES.slice(startIndex, visibleLines);

  return (
    <div className="w-full max-w-md">
      {/* Terminal window */}
      <div className="rounded-xl overflow-hidden border border-white/10 bg-[#0a0a0b] shadow-2xl">
        {/* Title bar */}
        <div className="flex items-center gap-2 px-4 py-2 bg-white/5 border-b border-white/10">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-[#FF5F56]" />
            <div className="w-2.5 h-2.5 rounded-full bg-[#FFBD2E]" />
            <div className="w-2.5 h-2.5 rounded-full bg-[#27C93F]" />
          </div>
          <span className="flex-1 text-center text-[10px] text-zinc-500 font-mono">Terminal</span>
        </div>

        {/* Terminal content - fixed height with scroll effect */}
        <div
          ref={contentRef}
          className="p-5 font-mono text-[12px] h-[420px] leading-[1.8] overflow-hidden"
        >
          {displayLines.map((line, displayIndex) => {
            const actualIndex = startIndex + displayIndex;
            return (
              <div
                key={`${cycleCount}-${actualIndex}`}
                className={`${getLineStyle(line.type)} ${line.type === "empty" ? "h-2.5" : ""} transition-opacity duration-200`}
                style={{
                  opacity: displayIndex < 2 && startIndex > 0 ? 0.4 : 1,
                }}
              >
                {line.text}
                {actualIndex === visibleLines - 1 && isTyping && line.type === "command" && (
                  <span className="inline-block w-1.5 h-3 bg-white/80 ml-0.5 animate-pulse" />
                )}
              </div>
            );
          })}
          {visibleLines === 0 && (
            <div className="text-white">
              $ <span className="inline-block w-1.5 h-3 bg-white/80 animate-pulse" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
