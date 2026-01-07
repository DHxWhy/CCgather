"use client"

import * as React from "react"
import { format } from "date-fns"
import { Calendar as CalendarIcon } from "lucide-react"
import { DateRange } from "react-day-picker"
import { cn } from "@/lib/utils"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface DateRangePickerProps {
  dateRange: { start: string; end: string } | null
  onDateRangeChange: (range: { start: string; end: string } | null) => void
  onApply: () => void
  isActive?: boolean
  className?: string
}

export function DateRangePicker({
  dateRange,
  onDateRangeChange,
  onApply,
  isActive,
  className,
}: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false)

  // Convert string dates to Date objects for the calendar
  const selectedRange: DateRange | undefined = dateRange
    ? {
        from: new Date(dateRange.start),
        to: new Date(dateRange.end),
      }
    : undefined

  const handleSelect = (range: DateRange | undefined) => {
    if (range?.from && range?.to) {
      onDateRangeChange({
        start: format(range.from, "yyyy-MM-dd"),
        end: format(range.to, "yyyy-MM-dd"),
      })
    } else if (range?.from) {
      onDateRangeChange({
        start: format(range.from, "yyyy-MM-dd"),
        end: format(range.from, "yyyy-MM-dd"),
      })
    } else {
      onDateRangeChange(null)
    }
  }

  const handleApply = () => {
    if (dateRange?.start && dateRange?.end) {
      onApply()
      setOpen(false)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "px-2.5 md:px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1",
            isActive
              ? "bg-[var(--color-filter-active)] text-[var(--color-text-primary)]"
              : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-filter-hover)]",
            className
          )}
        >
          <CalendarIcon className="w-3 h-3" />
          <span className="hidden md:inline">
            {isActive && dateRange
              ? `${dateRange.start.slice(5)} ~ ${dateRange.end.slice(5)}`
              : "Custom"}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="end">
        <div className="p-3 border-b border-[var(--border-default)]">
          <div className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide">
            Select Date Range
          </div>
        </div>
        <Calendar
          mode="range"
          defaultMonth={selectedRange?.from}
          selected={selectedRange}
          onSelect={handleSelect}
          numberOfMonths={1}
        />
        <div className="p-3 border-t border-[var(--border-default)]">
          <button
            onClick={handleApply}
            disabled={!dateRange?.start || !dateRange?.end}
            className="w-full px-3 py-1.5 text-xs font-medium rounded bg-[var(--color-claude-coral)] text-white hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Apply
          </button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
