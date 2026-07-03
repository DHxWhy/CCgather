"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { UsageHistoryPoint } from "@/lib/types";
import {
  computeStats,
  formatMonthLabel,
  getAvailableYears,
  getMonthBounds,
  getMonthPoints,
  getMonthWindow,
  getYearPoints,
  shiftMonth,
} from "@/lib/utils/usage-windowing";

const CORAL = "#DA7756";

function formatTokens(num: number): string {
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1)}B`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toLocaleString();
}

function formatShortTokens(num: number): string {
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(0)}B`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(0)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(0)}K`;
  return num.toString();
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}) {
  if (active && payload && payload.length > 0 && payload[0]) {
    return (
      <div className="bg-[var(--color-bg-secondary)] border border-[var(--border-default)] rounded-lg px-2 py-1.5 shadow-lg">
        <p className="text-[10px] text-[var(--color-text-muted)]">{label}</p>
        <p className="text-xs font-medium text-[var(--color-text-primary)]">
          {formatTokens(payload[0].value)} tokens
        </p>
      </div>
    );
  }
  return null;
}

type ViewMode = "year" | "month";

export function UsageHistoryModal({
  history,
  displayName,
  onClose,
}: {
  history: UsageHistoryPoint[];
  displayName: string;
  onClose: () => void;
}) {
  const gradientId = useMemo(() => `uhm-grad-${Math.random().toString(36).slice(2, 8)}`, []);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const [view, setView] = useState<ViewMode>("year");
  const years = useMemo(() => getAvailableYears(history), [history]);
  const monthBounds = useMemo(() => getMonthBounds(history), [history]);

  const [yearIndex, setYearIndex] = useState(0);
  const currentYear = years[yearIndex] ?? new Date().getFullYear();

  const [focusMonth, setFocusMonth] = useState<string>(() => getMonthBounds(history)?.max ?? "");

  useEffect(() => {
    if (!monthBounds) return;
    setFocusMonth((cur) =>
      cur && cur >= monthBounds.min && cur <= monthBounds.max ? cur : monthBounds.max
    );
  }, [monthBounds]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    return () => {
      window.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const yearPoints = useMemo(() => getYearPoints(history, currentYear), [history, currentYear]);
  const monthPoints = useMemo(
    () => (focusMonth ? getMonthPoints(history, focusMonth) : []),
    [history, focusMonth]
  );
  const monthWindow = useMemo(
    () => (monthBounds && focusMonth ? getMonthWindow(monthBounds, focusMonth) : []),
    [monthBounds, focusMonth]
  );

  const points = view === "year" ? yearPoints : monthPoints;
  const stats = useMemo(() => computeStats(points), [points]);

  const focusYear = focusMonth.slice(0, 4);
  const windowCrossesYear = new Set(monthWindow.map((m) => m.slice(0, 4))).size > 1;

  const canPrevMonth = !!monthBounds && !!focusMonth && focusMonth > monthBounds.min;
  const canNextMonth = !!monthBounds && !!focusMonth && focusMonth < monthBounds.max;

  const xInterval =
    view === "year"
      ? Math.max(0, Math.floor(points.length / 12) - 1)
      : Math.max(0, Math.floor(points.length / 6) - 1);

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 md:p-8"
      role="dialog"
      aria-modal="true"
      aria-label={`${displayName} Usage History`}
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <div
        className="relative w-full max-w-2xl bg-[var(--color-bg-primary)] border border-[var(--border-default)] rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--border-default)]">
          <div className="flex items-center gap-2">
            <span className="text-sm">📈</span>
            <span className="text-sm font-semibold text-[var(--color-text-primary)]">
              {displayName} — Usage History
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-md border border-[var(--border-default)] overflow-hidden">
              {(["year", "month"] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setView(mode)}
                  className={`px-2.5 py-1 text-[11px] font-medium transition-colors ${
                    view === mode
                      ? "bg-[var(--color-claude-coral)]/20 text-[var(--color-claude-coral)]"
                      : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                  }`}
                >
                  {mode === "year" ? "All" : "Monthly"}
                </button>
              ))}
            </div>
            <button
              ref={closeButtonRef}
              onClick={onClose}
              aria-label="Close"
              className="p-1.5 rounded-md text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex items-center justify-center px-5 py-2.5 border-b border-[var(--border-default)] bg-white/[0.02]">
          {view === "year" ? (
            <div className="flex items-center gap-3">
              <button
                onClick={() => setYearIndex((i) => Math.min(i + 1, years.length - 1))}
                disabled={yearIndex >= years.length - 1}
                aria-label="Previous year"
                className="p-1.5 rounded-md text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-white/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="w-36 text-center">
                <span className="text-base font-bold text-[var(--color-text-primary)]">
                  {currentYear}
                </span>
                <span className="text-xs text-[var(--color-text-muted)] ml-2">
                  ({yearPoints.length} days)
                </span>
              </div>
              <button
                onClick={() => setYearIndex((i) => Math.max(i - 1, 0))}
                disabled={yearIndex <= 0}
                aria-label="Next year"
                className="p-1.5 rounded-md text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-white/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => canPrevMonth && setFocusMonth((m) => shiftMonth(m, -1))}
                disabled={!canPrevMonth}
                aria-label="Previous month"
                className="p-1.5 rounded-md text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-white/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="flex w-60 items-center justify-center gap-1.5">
                {monthWindow.map((mo) => {
                  const isFocused = mo === focusMonth;
                  const withYear = isFocused || (windowCrossesYear && mo.slice(0, 4) !== focusYear);
                  return (
                    <button
                      key={mo}
                      onClick={() => setFocusMonth(mo)}
                      className={`px-2.5 py-1 rounded-md text-xs transition-colors ${
                        isFocused
                          ? "bg-[var(--color-claude-coral)]/20 text-[var(--color-claude-coral)] font-semibold"
                          : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-white/10"
                      }`}
                    >
                      {formatMonthLabel(mo, { withYear })}
                    </button>
                  );
                })}
              </div>
              <button
                onClick={() => canNextMonth && setFocusMonth((m) => shiftMonth(m, 1))}
                disabled={!canNextMonth}
                aria-label="Next month"
                className="p-1.5 rounded-md text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-white/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        <div className="px-5 py-4">
          {points.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-[var(--color-text-muted)] text-sm">
              No data
            </div>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={points} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CORAL} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={CORAL} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--border-default)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="label"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#71717A", fontSize: 10 }}
                    interval={xInterval}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#71717A", fontSize: 10 }}
                    tickFormatter={formatShortTokens}
                    width={45}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="tokens"
                    stroke={CORAL}
                    strokeWidth={2}
                    fill={`url(#${gradientId})`}
                    dot={false}
                    activeDot={{ r: 4, fill: CORAL, stroke: "#fff", strokeWidth: 2 }}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="flex items-center justify-around px-5 py-3 border-t border-[var(--border-default)] bg-white/[0.02]">
          <div className="text-center">
            <div className="text-[10px] text-[var(--color-text-muted)] mb-0.5">Total Tokens</div>
            <div className="text-sm font-semibold text-[var(--color-claude-coral)]">
              {formatTokens(stats.total)}
            </div>
          </div>
          <div className="w-px h-8 bg-[var(--border-default)]" />
          <div className="text-center">
            <div className="text-[10px] text-[var(--color-text-muted)] mb-0.5">Avg Daily</div>
            <div className="text-sm font-semibold text-[var(--color-text-primary)]">
              {formatTokens(stats.avgDaily)}
            </div>
          </div>
          <div className="w-px h-8 bg-[var(--border-default)]" />
          <div className="text-center">
            <div className="text-[10px] text-[var(--color-text-muted)] mb-0.5">Active Days</div>
            <div className="text-sm font-semibold text-[var(--color-text-primary)]">
              {stats.activeDays}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default UsageHistoryModal;
