"use client";

import { useMemo, useState, useRef, useEffect } from "react";

interface ActivityDataPoint {
  date: string;
  tokens: number;
}

interface ActivityHeatmapProps {
  data: ActivityDataPoint[];
  periodDays?: number;
}

// Get intensity level (0-4) based on token count
function getIntensityLevel(tokens: number, maxTokens: number): number {
  if (tokens === 0) return 0;
  const ratio = tokens / maxTokens;
  if (ratio < 0.25) return 1;
  if (ratio < 0.5) return 2;
  if (ratio < 0.75) return 3;
  return 4;
}

// Format number for display
function formatTokens(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toLocaleString();
}

// Format date for display
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

// Intensity color classes (Claude coral theme)
const INTENSITY_COLORS = [
  "bg-white/5", // 0: No activity
  "bg-[#DA7756]/20", // 1: Low
  "bg-[#DA7756]/40", // 2: Medium-Low
  "bg-[#DA7756]/60", // 3: Medium-High
  "bg-[#DA7756]/90", // 4: High
];

// Tooltip position calculation
type TooltipPosition = {
  horizontal: "left" | "center" | "right";
  vertical: "top" | "bottom";
};

function getTooltipPosition(
  weekIndex: number,
  totalWeeks: number,
  dayIndex: number
): TooltipPosition {
  // Horizontal position based on week index
  let horizontal: TooltipPosition["horizontal"] = "center";
  if (weekIndex < 3) {
    horizontal = "left"; // Near left edge, tooltip goes right
  } else if (weekIndex >= totalWeeks - 3) {
    horizontal = "right"; // Near right edge, tooltip goes left
  }

  // Vertical position based on day index (0-6)
  const vertical: TooltipPosition["vertical"] = dayIndex <= 2 ? "bottom" : "top";

  return { horizontal, vertical };
}

export function ActivityHeatmap({ data, periodDays = 90 }: ActivityHeatmapProps) {
  const [hoveredCell, setHoveredCell] = useState<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Scroll to right (current date) on mount
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollLeft = scrollContainerRef.current.scrollWidth;
    }
  }, [data]);

  // Process data into a grid structure
  // Always generate the grid structure, even with no data (for consistent layout)
  const gridData = useMemo(() => {
    // Create a map of date -> tokens
    const dataMap = new Map(data.map((d) => [d.date, d.tokens]));
    const maxTokens = data.length > 0 ? Math.max(...data.map((d) => d.tokens), 1) : 1;

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - periodDays + 1);

    // Adjust start to beginning of week (Sunday)
    const startDayOfWeek = startDate.getDay();
    startDate.setDate(startDate.getDate() - startDayOfWeek);

    // Generate all cells
    const cells: {
      date: string;
      tokens: number;
      intensity: number;
      week: number;
      dayOfWeek: number;
    }[] = [];

    const monthLabels: { month: string; week: number }[] = [];
    let lastMonth = -1;

    const currentDate = new Date(startDate);
    let week = 0;

    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split("T")[0]!;
      const dayOfWeek = currentDate.getDay();

      // Track month labels
      const month = currentDate.getMonth();
      if (month !== lastMonth && dayOfWeek === 0) {
        monthLabels.push({
          month: currentDate.toLocaleDateString("en-US", { month: "short" }),
          week,
        });
        lastMonth = month;
      }

      const tokens = dataMap.get(dateStr) || 0;
      const intensity = getIntensityLevel(tokens, maxTokens);

      cells.push({
        date: dateStr,
        tokens,
        intensity,
        week,
        dayOfWeek,
      });

      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);

      // Update week when we hit Sunday
      if (currentDate.getDay() === 0) {
        week++;
      }
    }

    return {
      cells,
      weeks: week + 1,
      maxTokens,
      monthLabels,
    };
  }, [data, periodDays]);

  // Always render the grid - just with empty cells if no data

  // Group cells by week
  const cellsByWeek = gridData.cells.reduce(
    (acc, cell) => {
      if (!acc[cell.week]) acc[cell.week] = [];
      acc[cell.week]!.push(cell);
      return acc;
    },
    {} as Record<number, typeof gridData.cells>
  );

  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const totalWeeks = gridData.weeks;

  return (
    <div className="space-y-2">
      {/* Scrollable container - scrolls to right (current date) on mount */}
      <div ref={scrollContainerRef} className="overflow-x-auto pb-2">
        <div className="inline-block min-w-max">
          {/* Month labels */}
          <div className="flex text-[9px] text-[var(--color-text-muted)] pl-8 relative h-4">
            {gridData.monthLabels.map((label, i) => (
              <div
                key={i}
                className="absolute"
                style={{
                  left: `${label.week * 14 + 32}px`,
                }}
              >
                {label.month}
              </div>
            ))}
          </div>

          {/* Heatmap grid */}
          <div className="flex gap-[3px]">
            {/* Day labels */}
            <div className="flex flex-col gap-[3px] text-[8px] text-[var(--color-text-muted)] pr-1 flex-shrink-0 overflow-visible">
              {weekDays.map((day, i) => (
                <div
                  key={day}
                  className="h-[11px] leading-[11px]"
                  style={{ visibility: i % 2 === 1 ? "visible" : "hidden" }}
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Grid */}
            <div className="flex gap-[3px] overflow-visible">
              {Object.entries(cellsByWeek).map(([week, cells]) => {
                const weekIndex = parseInt(week);

                return (
                  <div key={week} className="flex flex-col gap-[3px]">
                    {Array.from({ length: 7 }, (_, dayIndex) => {
                      const cell = cells.find((c) => c.dayOfWeek === dayIndex);
                      if (!cell) {
                        return (
                          <div
                            key={`${week}-${dayIndex}`}
                            className="w-[11px] h-[11px] rounded-sm bg-transparent"
                          />
                        );
                      }

                      const isHovered = hoveredCell === cell.date;
                      const isToday = cell.date === new Date().toISOString().split("T")[0];
                      const tooltipPos = getTooltipPosition(weekIndex, totalWeeks, dayIndex);

                      // Tooltip position classes
                      const verticalClass =
                        tooltipPos.vertical === "top" ? "bottom-full mb-2" : "top-full mt-2";
                      const horizontalClass =
                        tooltipPos.horizontal === "left"
                          ? "left-0"
                          : tooltipPos.horizontal === "right"
                            ? "right-0"
                            : "left-1/2 -translate-x-1/2";

                      // Arrow position classes
                      const arrowVerticalClass =
                        tooltipPos.vertical === "top" ? "top-full -mt-px" : "bottom-full -mb-px";
                      const arrowHorizontalClass =
                        tooltipPos.horizontal === "left"
                          ? "left-[6px]"
                          : tooltipPos.horizontal === "right"
                            ? "right-[6px]"
                            : "left-1/2 -translate-x-1/2";
                      const arrowBorderClass =
                        tooltipPos.vertical === "top"
                          ? "border-t-[var(--color-bg-secondary)] border-b-transparent"
                          : "border-b-[var(--color-bg-secondary)] border-t-transparent";

                      return (
                        <div
                          key={cell.date}
                          className="relative"
                          onMouseEnter={() => setHoveredCell(cell.date)}
                          onMouseLeave={() => setHoveredCell(null)}
                        >
                          <div
                            className={`w-[11px] h-[11px] rounded-sm cursor-pointer transition-all ${
                              INTENSITY_COLORS[cell.intensity]
                            } ${isToday ? "ring-1 ring-[var(--color-claude-coral)]" : ""} ${
                              isHovered ? "ring-1 ring-white/50" : ""
                            }`}
                          />

                          {/* Tooltip */}
                          {isHovered && (
                            <div
                              className={`absolute ${verticalClass} ${horizontalClass} z-50 px-2 py-1.5 bg-[var(--color-bg-secondary)] border border-[var(--border-default)] rounded-lg shadow-xl whitespace-nowrap`}
                            >
                              <div className="text-[10px] text-[var(--color-text-muted)]">
                                {formatDate(cell.date)}
                              </div>
                              <div className="text-xs font-medium text-[var(--color-claude-coral)]">
                                {formatTokens(cell.tokens)} tokens
                              </div>
                              {/* Tooltip arrow */}
                              <div
                                className={`absolute ${arrowVerticalClass} ${arrowHorizontalClass}`}
                              >
                                <div
                                  className={`border-4 border-transparent ${arrowBorderClass}`}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-end gap-1.5 text-[9px] text-[var(--color-text-muted)]">
        <span>Less</span>
        {INTENSITY_COLORS.map((color, i) => (
          <div key={i} className={`w-[11px] h-[11px] rounded-sm ${color}`} />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}

export default ActivityHeatmap;
