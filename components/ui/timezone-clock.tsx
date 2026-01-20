"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface TimezoneClockProps {
  className?: string;
  showDate?: boolean;
  layout?: "horizontal" | "vertical";
}

/**
 * Get UTC offset string like "UTC+9" or "UTC-5"
 */
function getUtcOffset(): string {
  const offset = -new Date().getTimezoneOffset(); // in minutes, positive for east
  const hours = Math.floor(Math.abs(offset) / 60);
  const minutes = Math.abs(offset) % 60;
  const sign = offset >= 0 ? "+" : "-";

  if (minutes === 0) {
    return `UTC${sign}${hours}`;
  }
  return `UTC${sign}${hours}:${minutes.toString().padStart(2, "0")}`;
}

/**
 * Compact timezone clock component
 * Shows current time with user's detected timezone
 * Features blinking colon animation
 */
export function TimezoneClock({
  className = "",
  showDate = false,
  layout = "horizontal",
}: TimezoneClockProps) {
  const [hours, setHours] = useState<string>("--");
  const [minutes, setMinutes] = useState<string>("--");
  const [date, setDate] = useState<string>("");
  const [timezone, setTimezone] = useState<string>("UTC");
  const [utcOffset, setUtcOffset] = useState<string>("UTC+0");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    // Detect timezone
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      setTimezone(tz);
    } catch {
      setTimezone("UTC");
    }

    // Get UTC offset
    setUtcOffset(getUtcOffset());

    // Update time every second
    const updateTime = () => {
      const now = new Date();
      const h = now.getHours().toString().padStart(2, "0");
      const m = now.getMinutes().toString().padStart(2, "0");
      setHours(h);
      setMinutes(m);
      setDate(
        now.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        })
      );
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);

    return () => clearInterval(interval);
  }, []);

  // Get readable timezone name
  const shortTimezone = timezone.split("/").pop()?.replace(/_/g, " ") || timezone;

  // Prevent hydration mismatch
  if (!mounted) {
    return (
      <div className={`inline-flex items-center gap-1.5 text-[10px] ${className}`}>
        <span className="opacity-60">🕐</span>
        <span className="text-[var(--color-text-muted)]">--:--</span>
      </div>
    );
  }

  if (layout === "vertical") {
    return (
      <div
        className={cn("flex-col items-end gap-0.5", className || "inline-flex")}
        title={`Your timezone: ${timezone} (${utcOffset})`}
      >
        <span className="text-[9px] text-[var(--color-text-muted)] truncate max-w-[100px]">
          ({utcOffset}) {shortTimezone}
        </span>
        <div className="flex items-center gap-0.5">
          <span className="text-[11px] opacity-50">🕐</span>
          <span className="font-mono text-xs text-[var(--color-text-primary)] tabular-nums">
            {hours}
          </span>
          <span className="font-mono text-xs text-[var(--color-text-primary)] animate-blink">
            :
          </span>
          <span className="font-mono text-xs text-[var(--color-text-primary)] tabular-nums">
            {minutes}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "items-center gap-1.5 px-2 py-1 rounded-lg bg-white/5 text-[10px]",
        className || "inline-flex"
      )}
      title={`Your timezone: ${timezone} (${utcOffset})`}
    >
      <span className="text-[var(--color-text-muted)]">({utcOffset})</span>
      <span className="text-[var(--color-text-muted)] truncate max-w-[70px]">{shortTimezone}</span>
      <span className="opacity-50">🕐</span>
      <span className="font-mono text-[var(--color-text-primary)] tabular-nums">{hours}</span>
      <span className="font-mono text-[var(--color-text-primary)] animate-blink">:</span>
      <span className="font-mono text-[var(--color-text-primary)] tabular-nums">{minutes}</span>
      {showDate && (
        <>
          <span className="text-[var(--color-text-muted)]/40">•</span>
          <span className="text-[var(--color-text-muted)]">{date}</span>
        </>
      )}
    </div>
  );
}

export default TimezoneClock;
