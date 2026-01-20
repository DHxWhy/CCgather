"use client";

import { useState } from "react";
import { DayPicker, DateRange } from "react-day-picker";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, X } from "lucide-react";
import "react-day-picker/style.css";

interface DateRangePickerProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (startDate: string, endDate: string) => void;
  initialRange?: { start: string; end: string } | null;
}

export function DateRangePicker({
  isOpen,
  onClose,
  onApply,
  initialRange,
}: DateRangePickerProps) {
  const [range, setRange] = useState<DateRange | undefined>(() => {
    if (initialRange) {
      return {
        from: new Date(initialRange.start),
        to: new Date(initialRange.end),
      };
    }
    return undefined;
  });

  const handleApply = () => {
    if (range?.from && range?.to) {
      const startDate = format(range.from, "yyyy-MM-dd");
      const endDate = format(range.to, "yyyy-MM-dd");
      onApply(startDate, endDate);
      onClose();
    }
  };

  const handleReset = () => {
    setRange(undefined);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200]"
            onClick={onClose}
          />
          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[201] bg-[var(--color-bg-secondary)] border border-white/10 rounded-xl shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[var(--color-claude-coral)]" />
                <span className="text-sm font-medium text-[var(--color-text-primary)]">
                  Custom Date Range
                </span>
              </div>
              <button
                onClick={onClose}
                className="p-1 rounded-md hover:bg-white/10 transition-colors"
              >
                <X className="w-4 h-4 text-[var(--color-text-muted)]" />
              </button>
            </div>

            {/* Calendar */}
            <div className="p-4">
              <DayPicker
                mode="range"
                selected={range}
                onSelect={setRange}
                locale={ko}
                numberOfMonths={2}
                disabled={{ after: new Date() }}
                classNames={{
                  root: "date-range-picker",
                  months: "flex gap-4",
                  month: "space-y-2",
                  caption: "flex justify-center py-1 relative items-center",
                  caption_label: "text-sm font-medium text-[var(--color-text-primary)]",
                  nav: "space-x-1 flex items-center",
                  button_previous: "absolute left-1 p-1 rounded hover:bg-white/10 transition-colors",
                  button_next: "absolute right-1 p-1 rounded hover:bg-white/10 transition-colors",
                  table: "w-full border-collapse",
                  head_row: "flex",
                  head_cell: "text-[var(--color-text-muted)] rounded-md w-8 font-normal text-[11px]",
                  row: "flex w-full mt-1",
                  cell: "text-center text-xs p-0 relative focus-within:relative focus-within:z-20",
                  day: "h-8 w-8 p-0 font-normal rounded-md hover:bg-white/10 transition-colors text-[var(--color-text-secondary)]",
                  day_selected: "bg-[var(--color-claude-coral)] text-white hover:bg-[var(--color-claude-coral)]",
                  day_today: "ring-1 ring-[var(--color-claude-coral)] ring-inset",
                  day_outside: "text-[var(--color-text-muted)]/30",
                  day_disabled: "text-[var(--color-text-muted)]/30 cursor-not-allowed",
                  day_range_middle: "bg-[var(--color-claude-coral)]/20 rounded-none",
                  day_range_start: "rounded-l-md",
                  day_range_end: "rounded-r-md",
                }}
              />

              {/* Selected Range Display */}
              {range?.from && (
                <div className="mt-3 px-3 py-2 bg-[var(--color-filter-bg)] rounded-lg text-xs text-[var(--color-text-secondary)]">
                  <span className="text-[var(--color-text-muted)]">Selected: </span>
                  <span className="font-medium text-[var(--color-text-primary)]">
                    {format(range.from, "yyyy.MM.dd")}
                  </span>
                  {range.to && (
                    <>
                      <span className="mx-1">~</span>
                      <span className="font-medium text-[var(--color-text-primary)]">
                        {format(range.to, "yyyy.MM.dd")}
                      </span>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-white/10 bg-black/20">
              <button
                onClick={handleReset}
                className="px-3 py-1.5 text-xs font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
              >
                Reset
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={onClose}
                  className="px-3 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleApply}
                  disabled={!range?.from || !range?.to}
                  className="px-4 py-1.5 text-xs font-medium bg-[var(--color-claude-coral)] text-white rounded-md hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Apply
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// Calendar Icon Button Component
interface DateRangeButtonProps {
  onClick: () => void;
  isActive: boolean;
  dateLabel?: string;
}

export function DateRangeButton({ onClick, isActive, dateLabel }: DateRangeButtonProps) {
  return (
    <button
      onClick={onClick}
      title="Custom date range"
      className={`h-6 px-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1 ${
        isActive
          ? "bg-[var(--color-claude-coral)]/50 text-[var(--color-claude-coral)]"
          : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-filter-hover)]"
      }`}
    >
      <Calendar className="w-3.5 h-3.5" />
      {dateLabel && <span className="hidden sm:inline">{dateLabel}</span>}
    </button>
  );
}
