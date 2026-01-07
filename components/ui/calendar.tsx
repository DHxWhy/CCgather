"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker } from "react-day-picker"
import { cn } from "@/lib/utils"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col sm:flex-row gap-2",
        month: "flex flex-col gap-4",
        month_caption: "flex justify-center pt-1 relative items-center w-full",
        caption_label: "text-sm font-medium text-[var(--color-text-primary)]",
        nav: "flex items-center gap-1",
        button_previous: "absolute left-1 top-0 inline-flex items-center justify-center rounded-md text-sm font-medium h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 text-[var(--color-text-primary)]",
        button_next: "absolute right-1 top-0 inline-flex items-center justify-center rounded-md text-sm font-medium h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 text-[var(--color-text-primary)]",
        month_grid: "w-full border-collapse",
        weekdays: "flex",
        weekday: "text-[var(--color-text-muted)] rounded-md w-8 font-normal text-[0.8rem]",
        week: "flex w-full mt-2",
        day: "h-8 w-8 text-center text-sm p-0 relative focus-within:relative focus-within:z-20 [&:has([aria-selected])]:bg-[var(--color-claude-coral)]/10 [&:has([aria-selected].day-outside)]:bg-[var(--color-claude-coral)]/50 [&:has([aria-selected].day-range-end)]:rounded-r-md first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md",
        day_button: cn(
          "inline-flex items-center justify-center rounded-md text-sm font-medium h-8 w-8 p-0 font-normal",
          "text-[var(--color-text-primary)] hover:bg-white/10 focus:bg-white/10",
          "aria-selected:opacity-100"
        ),
        range_end: "day-range-end",
        selected: "bg-[var(--color-claude-coral)] text-white hover:bg-[var(--color-claude-coral)] hover:text-white focus:bg-[var(--color-claude-coral)] focus:text-white",
        today: "bg-white/10 text-[var(--color-text-primary)]",
        outside: "day-outside text-[var(--color-text-muted)] opacity-50 aria-selected:bg-[var(--color-claude-coral)]/50 aria-selected:text-[var(--color-text-muted)] aria-selected:opacity-30",
        disabled: "text-[var(--color-text-muted)] opacity-50",
        range_middle: "aria-selected:bg-[var(--color-claude-coral)]/20 aria-selected:text-[var(--color-text-primary)]",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) => {
          const Icon = orientation === "left" ? ChevronLeft : ChevronRight
          return <Icon className="h-4 w-4" />
        },
      }}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
