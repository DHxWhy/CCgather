"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FlagIcon } from "@/components/ui/FlagIcon";
import { formatCompact, formatCompactCurrency } from "@/lib/utils/format";
import {
  monthKeyToDate,
  seasonLabel,
  seasonEndAt,
  seasonFinalizeAt,
  currentSeasonStart,
  toMonthKey,
} from "@/lib/constants/season";
import type { PublicStats, SeasonBoard, SeasonBoardRow } from "@/lib/services/publicStats";

interface Position {
  myUsername: string | null;
  myRank: number;
  totalParticipants: number;
  myTokens: number;
  myCost: number;
  aboveUsername: string | null;
  aboveTokens: number | null;
  belowUsername: string | null;
  belowTokens: number | null;
  firstUsername: string | null;
  firstTokens: number | null;
  cutRank: number;
  cutTokens: number | null;
}

type PositionState =
  | { status: "loading" }
  | { status: "anonymous" }
  | { status: "not-submitted" }
  | { status: "error" }
  | { status: "ranked"; position: Position };

const CARD =
  "min-w-0 rounded-xl border border-[var(--stats-chart-1)]/40 bg-[var(--color-bg-secondary)] p-4";

// 박제되는 인원. 074 snapshot_monthly_hof 의 LIMIT / get_season_position 의
// cut_rank / publicStats 의 SEASON_BOARD_SIZE 와 반드시 같아야 한다.
const CARVED_COUNT = 20;
const COLUMN_SPLIT = CARVED_COUNT / 2;

function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

function useCountdown(targetMs: number | null): string | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    if (targetMs === null) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [targetMs]);

  if (targetMs === null || now === null) return null;
  const diff = targetMs - now;
  if (diff <= 0) return "0d 00:00:00";
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  const mins = Math.floor((diff % 3_600_000) / 60_000);
  const secs = Math.floor((diff % 60_000) / 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${days}d ${pad(hours)}:${pad(mins)}:${pad(secs)}`;
}

function useSeasonPosition(month: string, enabled: boolean): PositionState {
  const [state, setState] = useState<PositionState>({ status: "loading" });
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setState({ status: "loading" });
    fetch(`/api/stats/season-position?month=${month}`)
      .then((res) => {
        if (!res.ok) throw new Error(`season-position ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        if (!data.authenticated) return setState({ status: "anonymous" });
        if (!data.submitted) return setState({ status: "not-submitted" });
        setState({ status: "ranked", position: data.position as Position });
      })
      .catch((err) => {
        console.error("[SeasonSprint] position fetch failed:", err);
        if (!cancelled) setState({ status: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [month, enabled]);
  return enabled ? state : { status: "loading" };
}

function Avatar({ url, size }: { url: string | null; size: number }) {
  const cls = "shrink-0 rounded-full border border-[var(--border-default)] object-cover";
  const style = { width: size, height: size };
  if (!url) {
    return <span className={`${cls} bg-[var(--color-bg-elevated)]`} style={style} aria-hidden />;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" width={size} height={size} className={cls} style={style} />
  );
}

function SprintRow({
  row,
  topTokens,
  isMe,
}: {
  row: SeasonBoardRow;
  topTokens: number;
  isMe: boolean;
}) {
  const fillPct = topTokens > 0 ? Math.max((row.tokens / topTokens) * 100, 1.5) : 0;
  const accent =
    row.rank <= 3 ? ["opacity-100", "opacity-60", "opacity-35"][row.rank - 1] : "opacity-0";
  return (
    <li
      className={`relative flex min-h-11 items-center gap-2 overflow-hidden rounded-lg px-2 py-2 sm:min-h-0 sm:gap-3 sm:px-3 sm:py-2.5 ${
        isMe ? "bg-[var(--stats-chart-1)]/[0.07] ring-1 ring-[var(--stats-chart-1)]/40" : ""
      }`}
    >
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 bg-[var(--stats-chart-1)]"
        style={{
          width: `${fillPct}%`,
          opacity: 0.16,
          maskImage: "linear-gradient(90deg, rgba(0,0,0,0.9) 0%, transparent 100%)",
          WebkitMaskImage: "linear-gradient(90deg, rgba(0,0,0,0.9) 0%, transparent 100%)",
        }}
      />
      <span
        aria-hidden
        className={`absolute inset-y-1 left-0 w-[2px] rounded-full bg-[var(--stats-chart-1)] ${accent}`}
      />
      <span className="relative w-5 shrink-0 text-right font-mono text-[11px] tabular-nums text-[var(--color-text-muted)] sm:w-6 sm:text-xs">
        <span className="sr-only">Rank </span>
        {row.rank}
      </span>
      <Avatar url={row.avatarUrl} size={24} />
      <span className="relative min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-xs font-semibold text-[var(--color-text-primary)] sm:text-sm">
            {row.displayName || row.username}
            {isMe && (
              <span className="ml-1.5 rounded-full border border-[var(--stats-chart-1)]/50 px-1.5 text-[9px] uppercase tracking-widest text-[var(--stats-chart-1)]">
                you
              </span>
            )}
          </span>
          {row.countryCode && (
            <span aria-hidden className="shrink-0">
              <FlagIcon countryCode={row.countryCode} size="xs" />
            </span>
          )}
        </span>
        <span className="hidden truncate text-[10px] text-[var(--color-text-muted)] sm:block">
          @{row.username}
          {row.currentLevel != null && ` · Lv.${row.currentLevel}`}
        </span>
      </span>
      <span className="relative hidden w-12 shrink-0 text-right font-mono text-[10px] tabular-nums text-[var(--color-text-muted)] sm:block">
        {formatCompactCurrency(row.cost)}
      </span>
      <span className="relative w-14 shrink-0 text-right font-mono text-xs font-bold tabular-nums text-[var(--stats-chart-1)] sm:w-16 sm:text-sm">
        {formatCompact(row.tokens)}
      </span>
    </li>
  );
}

function PinBody({ state, countdown }: { state: PositionState; countdown: string | null }) {
  if (state.status === "loading" || state.status === "error") {
    return null;
  }
  if (state.status === "anonymous") {
    return (
      <div className="text-[11px] text-[var(--color-text-muted)]">
        <Link
          href="/sign-in"
          className="rounded font-semibold text-[var(--stats-chart-1)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--stats-chart-1)]"
        >
          Log in
        </Link>{" "}
        to see your rank, your gap to the cut, and the daily pace to reach it.
      </div>
    );
  }
  if (state.status === "not-submitted") {
    return (
      <div className="text-[11px] text-[var(--color-text-muted)]">
        You&apos;re not on the board yet — sync this month to enter the race.
      </div>
    );
  }

  const p = state.position;
  const daysLeft = countdown ? Number(countdown.split("d")[0]) : 0;
  const pace = (gap: number) =>
    daysLeft > 0 ? ` · ≈${formatCompact(Math.ceil(gap / daysLeft))}/day` : "";

  if (p.myRank === 1) {
    const lead = p.belowTokens === null ? 0 : p.myTokens - p.belowTokens;
    return (
      <div className="text-[11px] text-[var(--color-text-secondary)]">
        👑 You lead by{" "}
        <span className="font-mono font-semibold tabular-nums text-[var(--stats-chart-1)]">
          {formatCompact(lead)}
        </span>
        {p.belowUsername ? ` over @${p.belowUsername}` : ""} — hold the throne until the season
        locks.
      </div>
    );
  }

  const toPass = p.aboveTokens === null ? 0 : p.aboveTokens - p.myTokens + 1;
  const toCut = p.cutTokens === null || p.myRank <= p.cutRank ? null : p.cutTokens - p.myTokens + 1;
  const toFirst = p.firstTokens === null ? null : p.firstTokens - p.myTokens + 1;

  return (
    <div className="space-y-1 text-[11px] text-[var(--color-text-secondary)]">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="font-mono font-semibold text-[var(--color-text-primary)]">
          #{p.myRank}
        </span>
        <span>
          ↑{" "}
          <span className="font-mono font-semibold tabular-nums text-[var(--stats-chart-1)]">
            {formatCompact(toPass)}
          </span>{" "}
          to pass {p.aboveUsername ? `@${p.aboveUsername}` : `#${p.myRank - 1}`}
        </span>
        <span className="text-[var(--stats-chart-3)]">{pace(toPass)}</span>
        {toFirst !== null && toFirst > 0 && (
          <>
            <span className="text-[var(--color-text-muted)]">·</span>
            <span className="text-[var(--color-text-muted)]">
              <span className="font-mono font-semibold tabular-nums">{formatCompact(toFirst)}</span>{" "}
              to #1
            </span>
          </>
        )}
      </div>
      {toCut !== null && (
        <div className="text-[var(--color-text-muted)]">
          <span className="font-mono font-semibold tabular-nums text-[var(--color-text-secondary)]">
            {formatCompact(toCut)}
          </span>{" "}
          to reach #{p.cutRank} — the last name carved
        </div>
      )}
      <div className="text-[10px] text-[var(--color-text-muted)]">
        of {p.totalParticipants} developers racing
      </div>
    </div>
  );
}

function Board({ board, myUsername }: { board: SeasonBoard; myUsername: string | null }) {
  if (board.rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-[var(--border-default)] px-4 py-8 text-center text-[11px] text-[var(--color-text-muted)]">
        This season starts with whoever syncs first.
      </div>
    );
  }
  const topTokens = board.rows[0]!.tokens;
  const left = board.rows.slice(0, COLUMN_SPLIT);
  const right = board.rows.slice(COLUMN_SPLIT, CARVED_COUNT);
  const renderRow = (row: SeasonBoardRow) => (
    <SprintRow
      key={row.username}
      row={row}
      topTokens={topTokens}
      isMe={myUsername != null && row.username === myUsername}
    />
  );
  return (
    <div className="lg:grid lg:grid-cols-2 lg:gap-x-8">
      <ol aria-label={`Ranks 1 to ${COLUMN_SPLIT}`} className="space-y-1">
        {left.map(renderRow)}
      </ol>
      {right.length > 0 && (
        <ol
          start={11}
          aria-label={`Ranks ${COLUMN_SPLIT + 1} to ${CARVED_COUNT}`}
          className="mt-1 space-y-1 lg:mt-0 lg:border-l lg:border-[var(--border-default)] lg:pl-8"
        >
          {right.map(renderRow)}
        </ol>
      )}
    </div>
  );
}

export function SeasonSprint({ seasons }: { seasons: PublicStats["seasons"] }) {
  const mounted = useMounted();
  const { current, previous } = seasons;

  const defaultTab: "current" | "previous" =
    previous && !previous.finalized ? "previous" : "current";
  const [tab, setTab] = useState<"current" | "previous">(defaultTab);

  const active: SeasonBoard = tab === "previous" && previous ? previous : current;
  const activeStart = monthKeyToDate(active.month);

  const countdownTarget =
    tab === "current"
      ? seasonEndAt(activeStart)
      : active.finalized
        ? null
        : seasonFinalizeAt(activeStart);
  const countdown = useCountdown(countdownTarget ? countdownTarget.getTime() : null);

  const raceActive = !active.finalized;
  const position = useSeasonPosition(active.month, raceActive);
  // 보드는 ISR(최대 1시간 stale), 개인 위치는 no-store 라이브다. 순위로 매칭하면
  // 그 사이 순위가 밀렸을 때 남의 행에 "you" 배지가 붙는다. username 으로만 매칭한다.
  const myUsername =
    raceActive && position.status === "ranked" ? position.position.myUsername : null;

  const isCurrentKey = active.month === toMonthKey(currentSeasonStart());

  return (
    <section aria-labelledby="season-sprint-title" className={CARD}>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2">
          <h2
            id="season-sprint-title"
            className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted)]"
          >
            Season Sprint · {seasonLabel(activeStart)}
          </h2>
          {active.finalized ? (
            <span className="rounded-full border border-[var(--stats-chart-3)]/50 px-1.5 text-[9px] uppercase tracking-widest text-[var(--stats-chart-3)]">
              carved
            </span>
          ) : (
            !isCurrentKey && (
              <span className="rounded-full border border-[var(--color-text-muted)]/50 px-1.5 text-[9px] uppercase tracking-widest text-[var(--color-text-muted)]">
                provisional
              </span>
            )
          )}
        </div>
        {mounted && countdown && (
          <span className="font-mono text-[11px] tabular-nums text-[var(--stats-chart-1)]">
            {tab === "current" ? "ends in " : "locks in "}
            {countdown}
          </span>
        )}
      </div>

      {previous && (
        <div className="mb-3 flex gap-1 text-[11px]">
          {(["previous", "current"] as const).map((t) => {
            const label =
              t === "current"
                ? seasonLabel(monthKeyToDate(current.month))
                : seasonLabel(monthKeyToDate(previous.month));
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`rounded-md px-2 py-1 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--stats-chart-1)] ${
                  tab === t
                    ? "bg-[var(--stats-chart-1)]/15 text-[var(--stats-chart-1)]"
                    : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}

      <p className="mb-3 text-[11px] text-[var(--color-text-secondary)]">
        The top 20 are carved into the Hall of Fame forever. Beyond #20, climb onto the board.
      </p>

      <Board board={active} myUsername={myUsername} />

      {raceActive ? (
        <div
          aria-live="polite"
          aria-atomic="true"
          className="mt-3 min-h-[68px] border-t border-[var(--border-default)] pt-3"
        >
          <PinBody state={position} countdown={countdown} />
        </div>
      ) : (
        <div className="mt-3 border-t border-[var(--border-default)] pt-3 text-[11px] text-[var(--color-text-muted)]">
          This season is carved and final. These 20 names stay up forever.
        </div>
      )}
    </section>
  );
}
