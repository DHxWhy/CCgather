"use client";

import { useState, useEffect, useRef, useMemo, useId, type ReactNode } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import {
  AlertTriangle,
  X,
  Wallet,
  Calculator,
  ArrowDownToLine,
  ArrowUpFromLine,
  Sparkles,
  CircleDollarSign,
  Activity,
  Layers,
  CheckCircle2,
  HelpCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

// =====================================================
// macOS Big Sur+ Easing — AdminLayoutClient 와 동일
// =====================================================
const MAC_EASE = "cubic-bezier(0.25, 0.46, 0.45, 0.94)";

// 환율 (CLAUDE.md 정책: 1 USD = 1,450 KRW)
const USD_KRW = 1450;

// =====================================================
// Model Configuration with Pricing & Lifecycle Info
// =====================================================

interface ModelConfig {
  name: string;
  role: string;
  input?: number; // per 1M tokens
  output?: number; // per 1M tokens
  perImage?: number; // per image
  status: "ga" | "preview";
  endDate?: string;
  note?: string;
}

// Gemini LLM Models (per 1M tokens)
const GEMINI_LLM_MODELS: Record<string, ModelConfig> = {
  "gemini-3-flash-preview": {
    name: "Gemini 3 Flash",
    role: "News Processing",
    input: 0.5,
    output: 3.0,
    status: "preview",
    endDate: undefined,
    note: "Latest model - no end date announced",
  },
  "gemini-2.0-flash": {
    name: "Gemini 2.0 Flash",
    role: "Tools Analysis / OG Vision",
    input: 0.1,
    output: 0.4,
    status: "ga",
    endDate: "2026-03-03",
    note: "Will be retired March 3, 2026",
  },
};

// Image Generation Models (per image)
const IMAGE_MODELS: Record<string, ModelConfig> = {
  "imagen-4.0-generate-001": {
    name: "Imagen 4",
    role: "Thumbnail (AI Generation)",
    perImage: 0.04,
    status: "ga",
    note: "Stable GA version",
  },
  "gemini-2.5-flash-image": {
    name: "Gemini 2.5 Flash Image",
    role: "Thumbnail (Nano Banana)",
    perImage: 0.039,
    status: "ga",
    note: "Stable GA version - successor to preview",
  },
};

// Claude API Models (reserved for future use)
const CLAUDE_MODELS: Record<string, ModelConfig> = {
  "claude-3-5-haiku-20241022": {
    name: "Haiku 3.5",
    role: "Verification",
    input: 0.8,
    output: 4.0,
    status: "ga",
  },
  "claude-opus-4-5-20250514": {
    name: "Opus 4.5",
    role: "Summary",
    input: 15.0,
    output: 75.0,
    status: "ga",
  },
  "claude-sonnet-4-20250514": {
    name: "Sonnet 4",
    role: "General",
    input: 3.0,
    output: 15.0,
    status: "ga",
  },
};

// Combined lookups
const ALL_MODELS: Record<string, ModelConfig> = {
  ...GEMINI_LLM_MODELS,
  ...IMAGE_MODELS,
  ...CLAUDE_MODELS,
};

// =====================================================
// Types
// =====================================================

interface AIUsageStats {
  totalRequests: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokensUsed: number;
  totalCost: number;
  requestsByDay: { date: string; count: number; tokens: number; cost: number }[];
  topModels: {
    model: string;
    count: number;
    tokens: number;
    inputTokens: number;
    outputTokens: number;
    cost: number;
  }[];
  byOperation: {
    operation: string;
    count: number;
    inputTokens: number;
    outputTokens: number;
    cost: number;
  }[];
  byModelAndOperation: {
    model: string;
    operation: string;
    count: number;
    inputTokens: number;
    outputTokens: number;
    cost: number;
  }[];
}

type Period = "7d" | "30d" | "all";

// =====================================================
// Formatters
// =====================================================

function formatNumber(num: number): string {
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(2) + "M";
  if (num >= 1_000) return (num / 1_000).toFixed(1) + "K";
  return num.toFixed(0);
}

function formatUSD(cost: number): string {
  if (cost >= 1) return `$${cost.toFixed(2)}`;
  if (cost >= 0.01) return `$${cost.toFixed(3)}`;
  return `$${cost.toFixed(4)}`;
}

function formatKRW(cost: number): string {
  const krw = cost * USD_KRW;
  if (krw >= 1000) return `₩${Math.round(krw).toLocaleString("ko-KR")}`;
  if (krw >= 10) return `₩${krw.toFixed(0)}`;
  if (krw >= 1) return `₩${krw.toFixed(1)}`;
  return `₩${krw.toFixed(2)}`;
}

function formatCostWithKRW(cost: number): string {
  return `${formatUSD(cost)} (${formatKRW(cost)})`;
}

// =====================================================
// Status Badge — macOS-style monochrome chip + 시멘틱 dot
// =====================================================
function StatusBadge({ config }: { config: ModelConfig }) {
  const isPreview = config.status === "preview";
  const hasEndDate = !!config.endDate;
  const endDate = config.endDate ? new Date(config.endDate) : null;
  const isEndingSoon = endDate && endDate.getTime() - Date.now() < 30 * 24 * 60 * 60 * 1000;

  if (!isPreview) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-[5px] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-white/[0.08] bg-white/[0.05] text-white/85"
        aria-label="GA (General Availability)"
      >
        <span aria-hidden="true" className="h-1 w-1 rounded-full bg-emerald-300" />
        GA
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1">
      <span
        className={`inline-flex items-center gap-1 rounded-[5px] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ${
          isEndingSoon
            ? "ring-[var(--color-claude-coral)]/30 bg-[var(--color-claude-coral)]/10 text-[var(--color-claude-coral)]"
            : "ring-amber-400/25 bg-amber-400/10 text-amber-200"
        }`}
        aria-label={`Preview${isEndingSoon ? " (deprecation soon)" : ""}`}
      >
        <span
          aria-hidden="true"
          className={`h-1 w-1 rounded-full ${
            isEndingSoon ? "bg-[var(--color-claude-coral)]" : "bg-amber-300"
          }`}
        />
        Preview
      </span>
      {hasEndDate ? (
        <span
          className={`inline-flex items-center rounded-[5px] px-1.5 py-0.5 text-[10px] font-medium tabular-nums ring-1 ${
            isEndingSoon
              ? "ring-[var(--color-claude-coral)]/30 bg-[var(--color-claude-coral)]/10 text-[var(--color-claude-coral)]"
              : "ring-white/[0.08] bg-white/[0.04] text-white/55"
          }`}
          title={`Deprecation date: ${config.endDate}`}
        >
          ~{config.endDate}
        </span>
      ) : (
        <AlertTriangle
          className="h-3 w-3 text-amber-300"
          strokeWidth={2}
          aria-label="End date not announced"
        />
      )}
    </span>
  );
}

// =====================================================
// Focus Trap Hook — macOS Sheet 표준 (WCAG 2.4.3)
// Tab cycle + Shift+Tab + Escape close + first-focus
// =====================================================
function useFocusTrap(active: boolean, onEscape: () => void) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;

    const container = containerRef.current;
    if (!container) return;

    const FOCUSABLE_SELECTOR =
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

    const getFocusables = (): HTMLElement[] =>
      Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (el) => !el.hasAttribute("aria-hidden") && el.offsetParent !== null
      );

    // Auto-focus first focusable
    const focusables = getFocusables();
    if (focusables.length > 0) {
      focusables[0]?.focus();
    } else {
      container.focus();
    }

    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onEscape();
        return;
      }
      if (e.key !== "Tab") return;

      const items = getFocusables();
      if (items.length === 0) return;

      const first = items[0];
      const last = items[items.length - 1];
      const activeEl = document.activeElement as HTMLElement | null;

      if (e.shiftKey && activeEl === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && activeEl === last) {
        e.preventDefault();
        first?.focus();
      }
    }

    document.addEventListener("keydown", handleKey);
    // Body scroll lock — macOS Sheet 표준
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = prevOverflow;
      previouslyFocused.current?.focus?.();
    };
  }, [active, onEscape]);

  return containerRef;
}

// =====================================================
// Pricing Modal — macOS Sheet (frosted glass + Focus Trap)
// =====================================================
function PricingModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const titleId = useId();
  const containerRef = useFocusTrap(open, onClose);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="presentation">
      {/* Backdrop — heavy blur + dim */}
      <button
        type="button"
        aria-label="모달 닫기"
        onClick={onClose}
        className="absolute inset-0 bg-black/55 backdrop-blur-sm focus-visible:outline-none"
        tabIndex={-1}
      />

      {/* Sheet */}
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="relative w-[440px] max-w-[calc(100vw-2rem)] max-h-[85vh] overflow-y-auto rounded-2xl ring-1 ring-white/[0.08] focus-visible:outline-none"
        style={{
          background: "linear-gradient(180deg, rgba(40,40,42,0.92) 0%, rgba(28,28,30,0.92) 100%)",
          backdropFilter: "blur(40px) saturate(180%)",
          WebkitBackdropFilter: "blur(40px) saturate(180%)",
          boxShadow:
            "0 25px 50px -12px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.04), inset 0 1px 0 rgba(255,255,255,0.06)",
        }}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-3.5 border-b border-white/[0.06] backdrop-blur-xl bg-white/[0.02]">
          <h3
            id={titleId}
            className="text-[14px] font-semibold tracking-[-0.01em] text-white/95"
            style={{ fontFeatureSettings: '"ss01"' }}
          >
            AI API Pricing & Status
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="모달 닫기"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-white/45 hover:bg-white/[0.06] hover:text-white/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25 active:scale-[0.95]"
            style={{ transition: `all 180ms ${MAC_EASE}` }}
          >
            <X className="h-[15px] w-[15px]" strokeWidth={1.75} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Gemini LLM Section */}
          <section aria-labelledby="gemini-section">
            <header className="flex items-center gap-2 mb-2.5">
              <h4
                id="gemini-section"
                className="text-[11px] font-semibold uppercase tracking-[0.08em] text-white/40"
              >
                Gemini LLM
              </h4>
              <span className="text-[10.5px] text-white/35 tracking-[-0.005em]">per 1M tokens</span>
              <span
                className="inline-flex items-center gap-1 rounded-[5px] ml-auto px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-emerald-400/25 bg-emerald-400/10 text-emerald-200"
                aria-label="활성"
              >
                <span aria-hidden="true" className="h-1 w-1 rounded-full bg-emerald-300" />
                Active
              </span>
            </header>
            <div className="space-y-2">
              {Object.entries(GEMINI_LLM_MODELS).map(([model, config]) => (
                <PricingRow key={model} config={config} type="token" />
              ))}
            </div>
          </section>

          {/* Image Generation Section */}
          <section aria-labelledby="image-section">
            <header className="flex items-center gap-2 mb-2.5">
              <h4
                id="image-section"
                className="text-[11px] font-semibold uppercase tracking-[0.08em] text-white/40"
              >
                Image Generation
              </h4>
              <span className="text-[10.5px] text-white/35 tracking-[-0.005em]">per image</span>
              <span
                className="inline-flex items-center gap-1 rounded-[5px] ml-auto px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-emerald-400/25 bg-emerald-400/10 text-emerald-200"
                aria-label="활성"
              >
                <span aria-hidden="true" className="h-1 w-1 rounded-full bg-emerald-300" />
                Active
              </span>
            </header>
            <div className="space-y-2">
              {Object.entries(IMAGE_MODELS)
                .filter(([model]) => !model.includes("-preview"))
                .map(([model, config]) => (
                  <PricingRow key={model} config={config} type="image" />
                ))}
            </div>
          </section>

          {/* Claude API Section — Not Currently Used */}
          <section aria-labelledby="claude-section">
            <header className="flex items-center gap-2 mb-2.5">
              <h4
                id="claude-section"
                className="text-[11px] font-semibold uppercase tracking-[0.08em] text-white/40"
              >
                Claude API
              </h4>
              <span className="text-[10.5px] text-white/35 tracking-[-0.005em]">per 1M tokens</span>
              <span
                className="inline-flex items-center gap-1 rounded-[5px] ml-auto px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-white/[0.08] bg-white/[0.04] text-white/45"
                aria-label="미사용"
              >
                <span aria-hidden="true" className="h-1 w-1 rounded-full bg-white/35" />
                Not in use
              </span>
            </header>
            <div className="space-y-2 opacity-55">
              {Object.entries(CLAUDE_MODELS).map(([model, config]) => (
                <PricingRow key={model} config={config} type="token" />
              ))}
            </div>
          </section>

          {/* Footer notes */}
          <footer className="pt-3 border-t border-white/[0.06]">
            <ul className="text-[10.5px] text-white/40 space-y-1 tracking-[-0.005em]">
              <li className="flex items-start gap-1.5">
                <span
                  aria-hidden="true"
                  className="mt-1 h-1 w-1 rounded-full shrink-0 bg-white/35"
                />
                <span>News processing uses Gemini 3 Flash</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span
                  aria-hidden="true"
                  className="mt-1 h-1 w-1 rounded-full shrink-0 bg-white/35"
                />
                <span>Thumbnail generation uses Imagen 4 / Gemini Flash Image</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span
                  aria-hidden="true"
                  className="mt-1 h-1 w-1 rounded-full shrink-0 bg-white/35"
                />
                <span>Tools analysis uses Gemini 2.0 Flash</span>
              </li>
              <li className="mt-2 flex items-start gap-1.5 text-amber-200/80">
                <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" strokeWidth={2} />
                <span>Preview models may be discontinued without notice</span>
              </li>
            </ul>
          </footer>
        </div>
      </div>
    </div>
  );
}

// =====================================================
// Pricing Row — macOS Cell stack
// =====================================================
function PricingRow({ config, type }: { config: ModelConfig; type: "token" | "image" }) {
  return (
    <div
      className="rounded-[9px] p-3 ring-1 ring-white/[0.06]"
      style={{
        background: "rgba(255,255,255,0.025)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03)",
      }}
    >
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[12.5px] font-medium text-white/95 tracking-[-0.005em] truncate">
            {config.name}
          </span>
          <StatusBadge config={config} />
        </div>
        {type === "image" && config.perImage !== undefined && (
          <span
            className="text-[12px] font-medium tabular-nums text-white/90"
            style={{ fontFeatureSettings: '"tnum"' }}
            title={formatCostWithKRW(config.perImage)}
          >
            {formatUSD(config.perImage)}
          </span>
        )}
      </div>
      <div className="text-[10.5px] text-white/45 mb-1.5 tracking-[-0.005em]">{config.role}</div>
      {type === "token" && (
        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <div className="flex items-center justify-between rounded-md px-2 py-1 bg-white/[0.025] ring-1 ring-white/[0.04]">
            <span className="text-white/45 tracking-[-0.005em]">Input</span>
            <span
              className="font-medium tabular-nums text-white/85"
              style={{ fontFeatureSettings: '"tnum"' }}
            >
              ${config.input?.toFixed(2)}
            </span>
          </div>
          <div className="flex items-center justify-between rounded-md px-2 py-1 bg-white/[0.025] ring-1 ring-white/[0.04]">
            <span className="text-white/45 tracking-[-0.005em]">Output</span>
            <span
              className="font-medium tabular-nums text-[var(--color-claude-coral)]"
              style={{ fontFeatureSettings: '"tnum"' }}
            >
              ${config.output?.toFixed(2)}
            </span>
          </div>
        </div>
      )}
      {config.note && (
        <div className="mt-2 text-[10px] text-white/35 tracking-[-0.005em]">{config.note}</div>
      )}
    </div>
  );
}

// =====================================================
// Chart Tooltip — macOS popover
// =====================================================
function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number; dataKey: string; payload?: { cost?: number } }>;
  label?: string;
}) {
  if (!active || !payload?.length || !payload[0]) return null;
  const tokens = payload[0].value;
  const cost = payload[0].payload?.cost ?? 0;
  return (
    <div
      className="rounded-[7px] px-2.5 py-2 ring-1 ring-white/[0.08] text-[11px] tracking-[-0.005em]"
      style={{
        background: "rgba(28,28,30,0.92)",
        backdropFilter: "blur(20px) saturate(180%)",
        WebkitBackdropFilter: "blur(20px) saturate(180%)",
        boxShadow: "0 4px 12px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.05)",
      }}
    >
      <div className="text-white/50 mb-0.5">{label}</div>
      <div
        className="text-white font-medium tabular-nums"
        style={{ fontFeatureSettings: '"tnum"' }}
      >
        {tokens.toLocaleString("en-US")} tokens
      </div>
      {cost > 0 && (
        <div
          className="text-[10.5px] text-white/50 tabular-nums mt-0.5"
          style={{ fontFeatureSettings: '"tnum"' }}
        >
          {formatCostWithKRW(cost)}
        </div>
      )}
    </div>
  );
}

// =====================================================
// StatCard — macOS Widget (/superadmin 패턴 재사용)
// =====================================================
interface StatCardProps {
  label: string;
  value: string;
  subValue?: string;
  icon: LucideIcon;
  accent?: "neutral" | "coral" | "success" | "warning";
}

function StatCard({ label, value, subValue, icon: Icon, accent = "neutral" }: StatCardProps) {
  const accentColor =
    accent === "coral"
      ? "text-[var(--color-claude-coral)]"
      : accent === "success"
        ? "text-emerald-300"
        : accent === "warning"
          ? "text-amber-200"
          : "text-white";

  const iconBg =
    accent === "coral"
      ? "bg-[var(--color-claude-coral)]/12 text-[var(--color-claude-coral)] ring-[var(--color-claude-coral)]/20"
      : accent === "success"
        ? "bg-emerald-400/10 text-emerald-300 ring-emerald-400/20"
        : accent === "warning"
          ? "bg-amber-400/10 text-amber-200 ring-amber-400/20"
          : "bg-white/[0.06] text-white/75 ring-white/[0.08]";

  return (
    <div
      className="relative overflow-hidden rounded-[9px] p-4 ring-1 ring-white/[0.08]"
      style={{
        background: "rgba(255,255,255,0.04)",
        backdropFilter: "blur(20px) saturate(180%)",
        WebkitBackdropFilter: "blur(20px) saturate(180%)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05), 0 1px 2px rgba(0,0,0,0.18)",
      }}
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <div
            className={`text-[26px] font-semibold leading-none tabular-nums tracking-[-0.02em] ${accentColor}`}
            style={{ fontFeatureSettings: '"ss01", "tnum", "cv11"' }}
            title={subValue}
          >
            {value}
          </div>
          <div className="mt-2 text-[11px] font-medium uppercase tracking-[0.08em] text-white/45">
            {label}
          </div>
          {subValue && (
            <div
              className="mt-0.5 text-[10.5px] text-white/40 tracking-[-0.005em] tabular-nums truncate"
              style={{ fontFeatureSettings: '"tnum"' }}
            >
              {subValue}
            </div>
          )}
        </div>
        <div
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] ring-1 ${iconBg}`}
        >
          <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
        </div>
      </div>
    </div>
  );
}

// =====================================================
// Helpers — Model + Operation display
// =====================================================
function getModelInfo(modelId: string): {
  name: string;
  role: string;
  config?: ModelConfig;
} {
  const config = ALL_MODELS[modelId];
  if (config) {
    return { name: config.name, role: config.role, config };
  }
  return {
    name: modelId.split("-").slice(-2).join(" ") || modelId,
    role: "Unknown",
  };
}

function getOperationDisplayName(operation: string): string {
  const names: Record<string, string> = {
    gemini_pipeline: "News Pipeline",
    thumbnail_imagen: "Thumbnail (Imagen)",
    thumbnail_gemini: "Thumbnail (Gemini Flash)",
    thumbnail_style_transfer: "Thumbnail (Style Transfer)",
    thumbnail_og_fusion: "Thumbnail (OG+AI Fusion)",
    thumbnail_generate: "Thumbnail (AI)",
    tool_analysis: "Tool Analysis",
    validate: "Validation",
    summarize: "Summarize",
    image_generation: "Image Generation",
    unknown: "Other",
  };
  return names[operation] || operation;
}

// =====================================================
// Card — frosted glass container (재사용 wrapper)
// =====================================================
function GlassCard({
  children,
  className = "",
  title,
  trailing,
}: {
  children: ReactNode;
  className?: string;
  title?: string;
  trailing?: ReactNode;
}) {
  return (
    <div
      className={`rounded-[9px] p-4 ring-1 ring-white/[0.08] ${className}`}
      style={{
        background: "rgba(255,255,255,0.04)",
        backdropFilter: "blur(20px) saturate(180%)",
        WebkitBackdropFilter: "blur(20px) saturate(180%)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05), 0 1px 2px rgba(0,0,0,0.18)",
      }}
    >
      {(title || trailing) && (
        <div className="mb-3 flex items-center justify-between">
          {title && (
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-white/45">
              {title}
            </h3>
          )}
          {trailing}
        </div>
      )}
      {children}
    </div>
  );
}

// =====================================================
// Segmented Control — macOS NSSegmentedControl
// =====================================================
function PeriodSegmented({ value, onChange }: { value: Period; onChange: (v: Period) => void }) {
  const periods: { id: Period; label: string }[] = [
    { id: "7d", label: "7D" },
    { id: "30d", label: "30D" },
    { id: "all", label: "All" },
  ];
  return (
    <div
      role="radiogroup"
      aria-label="기간 선택"
      className="inline-flex items-center rounded-[7px] p-0.5 ring-1 ring-white/[0.08]"
      style={{
        background: "rgba(255,255,255,0.04)",
        backdropFilter: "blur(20px) saturate(180%)",
        WebkitBackdropFilter: "blur(20px) saturate(180%)",
      }}
    >
      {periods.map((p) => {
        const active = value === p.id;
        return (
          <button
            key={p.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(p.id)}
            className={`relative inline-flex h-7 items-center px-3 text-[11.5px] font-medium tracking-[-0.005em] rounded-[5px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25 active:scale-[0.98] ${
              active
                ? "bg-white/[0.1] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                : "text-white/55 hover:text-white/85"
            }`}
            style={{
              transition: `all 180ms ${MAC_EASE}`,
            }}
          >
            {p.label}
          </button>
        );
      })}
    </div>
  );
}

// =====================================================
// Main
// =====================================================

export default function AdminAIUsagePage() {
  const [stats, setStats] = useState<AIUsageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>("7d");
  const [showPricing, setShowPricing] = useState(false);
  const [lastFetchedAt, setLastFetchedAt] = useState<Date | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchStats() {
      setLoading(true);
      try {
        const response = await fetch(`/api/admin/ai-usage?period=${period}`);
        if (response.ok && !cancelled) {
          const data: AIUsageStats = await response.json();
          setStats(data);
          setLastFetchedAt(new Date());
        }
      } catch (error) {
        console.error("Failed to fetch AI usage stats:", error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchStats();
    return () => {
      cancelled = true;
    };
  }, [period]);

  const chartData = useMemo(
    () =>
      stats?.requestsByDay?.map((d) => ({
        date: d.date?.split("-").slice(1).join("/") || "",
        tokens: d.tokens || 0,
        cost: d.cost || 0,
      })) || [],
    [stats?.requestsByDay]
  );

  return (
    <div
      className="space-y-5 max-w-6xl"
      style={{
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", system-ui, sans-serif',
        fontFeatureSettings: '"ss01", "cv11", "cv03"',
      }}
    >
      {/* Header */}
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h1
            className="text-[20px] font-semibold leading-none tracking-[-0.01em] text-white/95"
            style={{ fontFeatureSettings: '"ss01"' }}
          >
            AI 사용량
          </h1>
          <p className="mt-1.5 text-[12px] text-white/45 tracking-[-0.005em]">
            Gemini · Imagen API 사용량 및 비용 모니터링
            {lastFetchedAt && (
              <>
                <span aria-hidden="true" className="mx-1.5 text-white/20">
                  ·
                </span>
                <span
                  className="tabular-nums"
                  title={lastFetchedAt.toLocaleString("ko-KR")}
                  style={{ fontFeatureSettings: '"tnum"' }}
                >
                  업데이트{" "}
                  {lastFetchedAt.toLocaleTimeString("ko-KR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Pricing Button */}
          <button
            type="button"
            onClick={() => setShowPricing(true)}
            aria-label="가격표 열기"
            className="inline-flex h-8 items-center gap-1.5 rounded-[7px] px-3 text-[11.5px] font-medium text-white/75 bg-white/[0.04] ring-1 ring-white/[0.08] hover:bg-white/[0.07] hover:text-white/95 hover:ring-white/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25 active:scale-[0.98]"
            style={{ transition: `all 180ms ${MAC_EASE}` }}
          >
            <CircleDollarSign className="h-3.5 w-3.5" strokeWidth={1.75} />
            <span>Pricing</span>
          </button>
          <PeriodSegmented value={period} onChange={setPeriod} />
        </div>
      </div>

      {/* Pricing Modal */}
      <PricingModal open={showPricing} onClose={() => setShowPricing(false)} />

      {/* Loading */}
      {loading && (
        <div
          className="flex items-center justify-center py-12 rounded-[9px] ring-1 ring-white/[0.06]"
          style={{
            background: "rgba(255,255,255,0.02)",
          }}
        >
          <div className="inline-flex items-center gap-2 text-[12px] text-white/55 tracking-[-0.005em]">
            <span
              className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/15 border-t-[var(--color-claude-coral)]"
              aria-hidden="true"
            />
            로딩 중...
          </div>
        </div>
      )}

      {!loading && (
        <>
          {/* Summary StatCards — macOS Widget */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard
              label="Total Cost"
              value={formatUSD(stats?.totalCost || 0)}
              subValue={`${formatKRW(stats?.totalCost || 0)} · ${stats?.totalRequests || 0} requests`}
              icon={Wallet}
              accent="success"
            />
            <StatCard
              label="Total Tokens"
              value={formatNumber(stats?.totalTokensUsed || 0)}
              subValue="Input + Output"
              icon={Calculator}
              accent="neutral"
            />
            <StatCard
              label="Input Tokens"
              value={formatNumber(stats?.totalInputTokens || 0)}
              subValue="Prompt cost"
              icon={ArrowDownToLine}
              accent="neutral"
            />
            <StatCard
              label="Output Tokens"
              value={formatNumber(stats?.totalOutputTokens || 0)}
              subValue="Response cost (higher)"
              icon={ArrowUpFromLine}
              accent="coral"
            />
          </div>

          {/* Usage Chart */}
          {chartData.length > 0 && (
            <GlassCard title="Daily Token Usage">
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="colorTokens" x1="0" y1="0" x2="0" y2="1">
                        <stop
                          offset="0%"
                          stopColor="var(--color-claude-coral)"
                          stopOpacity={0.32}
                        />
                        <stop offset="100%" stopColor="var(--color-claude-coral)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="date"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "rgba(255,255,255,0.32)", fontSize: 10 }}
                      dy={8}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "rgba(255,255,255,0.32)", fontSize: 10 }}
                      width={38}
                      tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v)}
                    />
                    <Tooltip
                      content={<ChartTooltip />}
                      cursor={{ stroke: "rgba(255,255,255,0.12)", strokeWidth: 1 }}
                    />
                    <Area
                      type="monotone"
                      dataKey="tokens"
                      stroke="var(--color-claude-coral)"
                      strokeWidth={2}
                      fill="url(#colorTokens)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </GlassCard>
          )}

          {/* Two Column: Models + Operations */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {/* Cost by Model — macOS Cell stack */}
            <GlassCard
              title="Cost by Model"
              trailing={<Layers className="h-3.5 w-3.5 text-white/35" strokeWidth={1.75} />}
            >
              {stats?.topModels && stats.topModels.length > 0 ? (
                <ul className="space-y-1.5">
                  {stats.topModels.map((model) => {
                    const costPercent =
                      stats.totalCost > 0 ? (model.cost / stats.totalCost) * 100 : 0;
                    const modelInfo = getModelInfo(model.model);
                    return (
                      <li
                        key={model.model}
                        className="rounded-[7px] p-2.5 ring-1 ring-white/[0.04] hover:ring-white/[0.08] hover:bg-white/[0.025]"
                        style={{
                          background: "rgba(255,255,255,0.02)",
                          transition: `all 160ms ${MAC_EASE}`,
                        }}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-[12.5px] text-white/95 font-medium tracking-[-0.005em] truncate">
                              {modelInfo.name}
                            </span>
                            {modelInfo.config && <StatusBadge config={modelInfo.config} />}
                          </div>
                          <span
                            className="text-[12px] font-medium tabular-nums text-white/95 shrink-0"
                            style={{ fontFeatureSettings: '"tnum"' }}
                            title={formatCostWithKRW(model.cost)}
                          >
                            {formatUSD(model.cost)}
                          </span>
                        </div>
                        <div className="text-[10.5px] text-white/45 mb-1.5 tracking-[-0.005em]">
                          {modelInfo.role}
                          <span aria-hidden="true" className="mx-1.5 text-white/20">
                            ·
                          </span>
                          <span
                            className="tabular-nums text-white/40"
                            style={{ fontFeatureSettings: '"tnum"' }}
                          >
                            {formatKRW(model.cost)}
                          </span>
                        </div>
                        {/* Progress bar */}
                        <div
                          className="h-1 bg-white/[0.04] rounded-full overflow-hidden ring-1 ring-white/[0.03]"
                          role="meter"
                          aria-valuenow={Math.round(costPercent)}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-label={`전체 비용의 ${costPercent.toFixed(1)}%`}
                        >
                          <div
                            className="h-full bg-[var(--color-claude-coral)] rounded-full"
                            style={{
                              width: `${Math.min(100, Math.max(2, costPercent))}%`,
                              transition: `width 320ms ${MAC_EASE}`,
                            }}
                          />
                        </div>
                        <div className="mt-1.5 flex items-center justify-between text-[10.5px] text-white/40 tabular-nums tracking-[-0.005em]">
                          <span style={{ fontFeatureSettings: '"tnum"' }}>
                            {model.count} requests
                          </span>
                          {modelInfo.config?.perImage ? (
                            <span className="text-white/30">per-image pricing</span>
                          ) : (
                            <span style={{ fontFeatureSettings: '"tnum"' }} className="font-mono">
                              In: {formatNumber(model.inputTokens)}
                              <span aria-hidden="true" className="mx-1 text-white/20">
                                /
                              </span>
                              Out: {formatNumber(model.outputTokens)}
                            </span>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <EmptyState />
              )}
            </GlassCard>

            {/* Cost by Operation */}
            <GlassCard
              title="Cost by Operation"
              trailing={<Activity className="h-3.5 w-3.5 text-white/35" strokeWidth={1.75} />}
            >
              {stats?.byOperation && stats.byOperation.length > 0 ? (
                <ul className="space-y-1.5">
                  {stats.byOperation.map((op) => {
                    const costPercent = stats.totalCost > 0 ? (op.cost / stats.totalCost) * 100 : 0;
                    const isImage =
                      op.operation.startsWith("thumbnail_") || op.operation === "image_generation";
                    return (
                      <li
                        key={op.operation}
                        className="rounded-[7px] p-2.5 ring-1 ring-white/[0.04] hover:ring-white/[0.08] hover:bg-white/[0.025]"
                        style={{
                          background: "rgba(255,255,255,0.02)",
                          transition: `all 160ms ${MAC_EASE}`,
                        }}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[12.5px] text-white/95 font-medium tracking-[-0.005em] truncate">
                            {getOperationDisplayName(op.operation)}
                          </span>
                          <span
                            className="text-[12px] font-medium tabular-nums text-white/95 shrink-0"
                            style={{ fontFeatureSettings: '"tnum"' }}
                            title={formatCostWithKRW(op.cost)}
                          >
                            {formatUSD(op.cost)}
                          </span>
                        </div>
                        <div
                          className="text-[10.5px] text-white/40 mb-1.5 tabular-nums tracking-[-0.005em]"
                          style={{ fontFeatureSettings: '"tnum"' }}
                        >
                          {formatKRW(op.cost)}
                        </div>
                        <div
                          className="h-1 bg-white/[0.04] rounded-full overflow-hidden ring-1 ring-white/[0.03]"
                          role="meter"
                          aria-valuenow={Math.round(costPercent)}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-label={`전체 비용의 ${costPercent.toFixed(1)}%`}
                        >
                          <div
                            className="h-full bg-white/55 rounded-full"
                            style={{
                              width: `${Math.min(100, Math.max(2, costPercent))}%`,
                              transition: `width 320ms ${MAC_EASE}`,
                            }}
                          />
                        </div>
                        <div className="mt-1.5 flex items-center justify-between text-[10.5px] text-white/40 tabular-nums tracking-[-0.005em]">
                          <span style={{ fontFeatureSettings: '"tnum"' }}>{op.count} calls</span>
                          {isImage ? (
                            <span className="text-white/30">per-image pricing</span>
                          ) : (
                            <span style={{ fontFeatureSettings: '"tnum"' }} className="font-mono">
                              In: {formatNumber(op.inputTokens)}
                              <span aria-hidden="true" className="mx-1 text-white/20">
                                /
                              </span>
                              Out: {formatNumber(op.outputTokens)}
                            </span>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <EmptyState />
              )}
            </GlassCard>
          </div>

          {/* Detailed Breakdown — Finder column header style */}
          {stats?.byModelAndOperation && stats.byModelAndOperation.length > 0 && (
            <div
              className="rounded-[9px] ring-1 ring-white/[0.08] overflow-hidden"
              style={{
                background: "rgba(255,255,255,0.04)",
                backdropFilter: "blur(20px) saturate(180%)",
                WebkitBackdropFilter: "blur(20px) saturate(180%)",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05), 0 1px 2px rgba(0,0,0,0.18)",
              }}
            >
              <div className="px-4 pt-3.5 pb-2 flex items-center justify-between">
                <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-white/45">
                  Detailed Breakdown
                  <span className="ml-2 text-white/30 normal-case tracking-[-0.005em] text-[10.5px]">
                    Model · Operation
                  </span>
                </h3>
                <Sparkles
                  className="h-3.5 w-3.5 text-white/35"
                  strokeWidth={1.75}
                  aria-hidden="true"
                />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr
                      className="sticky top-0 border-y border-white/[0.06] backdrop-blur-md"
                      style={{ background: "rgba(28,28,30,0.55)" }}
                    >
                      <th
                        scope="col"
                        className="px-3 py-2 text-left text-[10.5px] font-semibold uppercase tracking-[0.08em] text-white/45"
                      >
                        Model
                      </th>
                      <th
                        scope="col"
                        className="px-3 py-2 text-left text-[10.5px] font-semibold uppercase tracking-[0.08em] text-white/45"
                      >
                        Role
                      </th>
                      <th
                        scope="col"
                        className="px-3 py-2 text-left text-[10.5px] font-semibold uppercase tracking-[0.08em] text-white/45"
                      >
                        Operation
                      </th>
                      <th
                        scope="col"
                        className="px-3 py-2 text-right text-[10.5px] font-semibold uppercase tracking-[0.08em] text-white/45"
                      >
                        Requests
                      </th>
                      <th
                        scope="col"
                        className="px-3 py-2 text-right text-[10.5px] font-semibold uppercase tracking-[0.08em] text-white/45"
                      >
                        Input
                      </th>
                      <th
                        scope="col"
                        className="px-3 py-2 text-right text-[10.5px] font-semibold uppercase tracking-[0.08em] text-white/45"
                      >
                        Output
                      </th>
                      <th
                        scope="col"
                        className="px-3 py-2 text-right text-[10.5px] font-semibold uppercase tracking-[0.08em] text-white/45"
                      >
                        Cost
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.byModelAndOperation.map((item, idx) => {
                      const modelInfo = getModelInfo(item.model);
                      return (
                        <tr
                          key={idx}
                          className="group border-b border-white/[0.04] last:border-b-0 hover:bg-white/[0.025]"
                          style={{
                            transition: `background-color 160ms ${MAC_EASE}`,
                          }}
                        >
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[12px] text-white/90 tracking-[-0.005em]">
                                {modelInfo.name}
                              </span>
                              {modelInfo.config?.status === "preview" && (
                                <span
                                  className="inline-flex items-center rounded-[4px] px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide ring-1 ring-amber-400/25 bg-amber-400/10 text-amber-200"
                                  title="Preview"
                                  aria-label="Preview model"
                                >
                                  P
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-[11.5px] text-white/45 tracking-[-0.005em]">
                            {modelInfo.role}
                          </td>
                          <td className="px-3 py-2.5 text-[11.5px] text-white/70 tracking-[-0.005em]">
                            {getOperationDisplayName(item.operation)}
                          </td>
                          <td
                            className="px-3 py-2.5 text-right text-[12px] tabular-nums text-white/65"
                            style={{ fontFeatureSettings: '"tnum"' }}
                          >
                            {item.count}
                          </td>
                          <td
                            className="px-3 py-2.5 text-right text-[12px] tabular-nums text-white/65 font-mono"
                            style={{ fontFeatureSettings: '"tnum"' }}
                          >
                            {modelInfo.config?.perImage ? (
                              <span className="text-white/25">—</span>
                            ) : (
                              formatNumber(item.inputTokens)
                            )}
                          </td>
                          <td
                            className="px-3 py-2.5 text-right text-[12px] tabular-nums text-[var(--color-claude-coral)] font-mono"
                            style={{ fontFeatureSettings: '"tnum"' }}
                          >
                            {modelInfo.config?.perImage ? (
                              <span className="text-white/25">—</span>
                            ) : (
                              formatNumber(item.outputTokens)
                            )}
                          </td>
                          <td
                            className="px-3 py-2.5 text-right text-[12px] font-medium tabular-nums text-white/95"
                            style={{ fontFeatureSettings: '"tnum"' }}
                            title={formatCostWithKRW(item.cost)}
                          >
                            {formatUSD(item.cost)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr
                      className="border-t border-white/[0.1]"
                      style={{ background: "rgba(255,255,255,0.025)" }}
                    >
                      <td
                        colSpan={3}
                        className="px-3 py-2.5 text-[12px] text-white/85 font-medium tracking-[-0.005em]"
                      >
                        Total
                      </td>
                      <td
                        className="px-3 py-2.5 text-right text-[12px] tabular-nums font-medium text-white/85"
                        style={{ fontFeatureSettings: '"tnum"' }}
                      >
                        {stats.totalRequests}
                      </td>
                      <td
                        className="px-3 py-2.5 text-right text-[12px] tabular-nums font-medium text-white/80 font-mono"
                        style={{ fontFeatureSettings: '"tnum"' }}
                      >
                        {formatNumber(stats.totalInputTokens)}
                      </td>
                      <td
                        className="px-3 py-2.5 text-right text-[12px] tabular-nums font-medium text-[var(--color-claude-coral)] font-mono"
                        style={{ fontFeatureSettings: '"tnum"' }}
                      >
                        {formatNumber(stats.totalOutputTokens)}
                      </td>
                      <td
                        className="px-3 py-2.5 text-right text-[12px] font-semibold tabular-nums text-white/95"
                        style={{ fontFeatureSettings: '"tnum"' }}
                        title={formatCostWithKRW(stats.totalCost)}
                      >
                        {formatUSD(stats.totalCost)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* Info note — coral subtle accent */}
          <div
            className="rounded-[9px] px-4 py-3 ring-1 ring-white/[0.06]"
            style={{
              background: "rgba(218,119,86,0.04)",
              backdropFilter: "blur(20px) saturate(180%)",
              WebkitBackdropFilter: "blur(20px) saturate(180%)",
            }}
          >
            <p className="flex items-start gap-2 text-[11.5px] text-white/70 tracking-[-0.005em]">
              <CheckCircle2
                className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--color-claude-coral)]/85"
                strokeWidth={1.75}
                aria-hidden="true"
              />
              <span>
                News processing · tool analysis · thumbnail generation 에 사용된 Gemini API 사용량을
                추적합니다.
                <span className="text-[var(--color-claude-coral)]/85">
                  {" "}
                  Output 토큰은 Input 보다 비싸므로
                </span>{" "}
                응답 길이를 최적화하면 비용을 절감할 수 있습니다.
              </span>
            </p>
          </div>
        </>
      )}
    </div>
  );
}

// =====================================================
// Empty State
// =====================================================
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <HelpCircle className="h-5 w-5 text-white/25 mb-2" strokeWidth={1.75} aria-hidden="true" />
      <div className="text-[12px] text-white/40 tracking-[-0.005em]">데이터 없음</div>
    </div>
  );
}
