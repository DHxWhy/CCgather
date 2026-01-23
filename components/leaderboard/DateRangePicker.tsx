"use client";

import { useState } from "react";
import { DateRange } from "react-day-picker";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar as CalendarIcon, X } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";

interface DateRangePickerProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (startDate: string, endDate: string) => void;
  initialRange?: { start: string; end: string } | null;
}

export function DateRangePicker({ isOpen, onClose, onApply, initialRange }: DateRangePickerProps) {
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
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[201] glass rounded-xl shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-text-muted)]/30">
              <div className="flex items-center gap-2">
                <CalendarIcon className="w-4 h-4 text-[var(--color-claude-coral)]" />
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

            {/* Calendar - Single Month */}
            <div className="p-4">
              <Calendar
                mode="range"
                selected={range}
                onSelect={setRange}
                locale={ko}
                numberOfMonths={1}
                disabled={{ after: new Date() }}
                defaultMonth={range?.from || new Date()}
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
            <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--color-text-muted)]/30">
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
      className={`w-[34px] lg:w-auto lg:px-2 rounded-lg text-[11px] leading-none font-medium transition-colors flex items-center justify-center gap-0.5 glass ${
        isActive
          ? "bg-[var(--color-claude-coral)]/50 text-[var(--color-claude-coral)]"
          : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-filter-hover)]"
      }`}
      style={{ height: 34 }}
    >
      <CalendarIcon className="w-3.5 h-3.5" />
      {dateLabel && <span className="hidden lg:inline">{dateLabel}</span>}
    </button>
  );
}
