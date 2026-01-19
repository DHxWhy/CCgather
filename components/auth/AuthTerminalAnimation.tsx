"use client";

import { useState, useEffect, useCallback } from "react";

interface TerminalLine {
  text: string;
  type: "command" | "info" | "success" | "stat" | "empty";
  delay: number;
}

const TERMINAL_LINES: TerminalLine[] = [
  { text: "$ npx ccgather submit", type: "command", delay: 0 },
  { text: "", type: "empty", delay: 800 },
  { text: "\u25b8 Scanning Claude Code usage...", type: "info", delay: 1200 },
  { text: "\u25b8 Found 1,234,567 tokens", type: "info", delay: 2000 },
  { text: "\u25b8 Calculating global rank...", type: "info", delay: 2800 },
  { text: "", type: "empty", delay: 3400 },
  { text: "\u2713 Success! You're now #42 globally", type: "success", delay: 3800 },
  { text: "", type: "empty", delay: 4400 },
  { text: "  Tokens:    1,234,567  (+125,432)", type: "stat", delay: 4800 },
  { text: "  Cost:      $45.67", type: "stat", delay: 5200 },
  { text: "  Rank:      #42 \u2191 from #58", type: "stat", delay: 5600 },
];

export function AuthTerminalAnimation() {
  const [visibleLines, setVisibleLines] = useState<number>(0);
  const [isTyping, setIsTyping] = useState(true);
  const [cycleCount, setCycleCount] = useState(0);

  const resetAnimation = useCallback(() => {
    setVisibleLines(0);
    setIsTyping(true);
    setCycleCount((c) => c + 1);
  }, []);

  useEffect(() => {
    const timers: NodeJS.Timeout[] = [];

    // Show lines progressively
    TERMINAL_LINES.forEach((line, index) => {
      const timer = setTimeout(() => {
        setVisibleLines(index + 1);
        if (index === TERMINAL_LINES.length - 1) {
          setIsTyping(false);
        }
      }, line.delay);
      timers.push(timer);
    });

    // Reset animation after completion
    const resetTimer = setTimeout(() => {
      resetAnimation();
    }, 8000);
    timers.push(resetTimer);

    return () => {
      timers.forEach((timer) => clearTimeout(timer));
    };
  }, [cycleCount, resetAnimation]);

  const getLineStyle = (type: TerminalLine["type"]) => {
    switch (type) {
      case "command":
        return "text-white font-medium";
      case "info":
        return "text-[var(--color-text-muted)]";
      case "success":
        return "text-emerald-400 font-medium";
      case "stat":
        return "text-[var(--color-text-secondary)] font-mono text-sm";
      default:
        return "";
    }
  };

  return (
    <div className="w-full max-w-md">
      {/* Terminal window */}
      <div className="rounded-xl overflow-hidden border border-white/10 bg-[#0D0D0F] shadow-2xl">
        {/* Title bar */}
        <div className="flex items-center gap-2 px-4 py-3 bg-white/5 border-b border-white/10">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-[#FF5F56]" />
            <div className="w-3 h-3 rounded-full bg-[#FFBD2E]" />
            <div className="w-3 h-3 rounded-full bg-[#27C93F]" />
          </div>
          <span className="flex-1 text-center text-xs text-[var(--color-text-muted)] font-mono">
            terminal
          </span>
        </div>

        {/* Terminal content */}
        <div className="p-4 font-mono text-sm min-h-[280px]">
          {TERMINAL_LINES.slice(0, visibleLines).map((line, index) => (
            <div
              key={`${cycleCount}-${index}`}
              className={`${getLineStyle(line.type)} ${line.type === "empty" ? "h-4" : ""} animate-fade-in-up`}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              {line.text}
              {index === visibleLines - 1 && isTyping && line.type === "command" && (
                <span className="inline-block w-2 h-4 bg-white/80 ml-0.5 animate-pulse" />
              )}
            </div>
          ))}
          {visibleLines === 0 && (
            <div className="text-white">
              ${" "}
              <span className="inline-block w-2 h-4 bg-white/80 animate-pulse" />
            </div>
          )}
        </div>
      </div>

      {/* Stats badges below terminal */}
      <div className="flex items-center justify-center gap-4 mt-6">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span className="text-xs text-[var(--color-text-muted)]">70+ Countries</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
          <span className="w-2 h-2 rounded-full bg-[var(--color-claude-coral)]" />
          <span className="text-xs text-[var(--color-text-muted)]">500+ Developers</span>
        </div>
      </div>
    </div>
  );
}
