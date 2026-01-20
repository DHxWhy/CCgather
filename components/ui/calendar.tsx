"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import * as React from "react";
import { DayPicker } from "react-day-picker";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/Button";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  components: userComponents,
  ...props
}: CalendarProps) {
  const defaultClassNames = {
    months: "relative flex flex-col sm:flex-row gap-4",
    month: "w-full",
    month_caption: "relative mx-10 mb-1 flex h-9 items-center justify-center z-20",
    caption_label: "text-sm font-medium text-[var(--color-text-primary)]",
    nav: "absolute top-0 flex w-full justify-between z-10",
    button_previous: cn(
      buttonVariants({ variant: "ghost" }),
      "size-9 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] p-0"
    ),
    button_next: cn(
      buttonVariants({ variant: "ghost" }),
      "size-9 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] p-0"
    ),
    weekday: "size-9 p-0 text-xs font-medium text-[var(--color-text-muted)]",
    day_button:
      "relative flex size-9 items-center justify-center whitespace-nowrap rounded-lg p-0 text-[var(--color-text-primary)] outline-offset-2 group-[[data-selected]:not(.range-middle)]:[transition-property:color,background-color,border-radius,box-shadow] group-[[data-selected]:not(.range-middle)]:duration-150 focus:outline-none group-data-[disabled]:pointer-events-none focus-visible:z-10 hover:bg-white/10 group-data-[selected]:bg-[var(--color-claude-coral)] hover:text-[var(--color-text-primary)] group-data-[selected]:text-white group-data-[disabled]:text-[var(--color-text-muted)]/30 group-data-[disabled]:line-through group-data-[outside]:text-[var(--color-text-muted)]/30 group-data-[outside]:group-data-[selected]:text-white/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-claude-coral)]/70 group-[.range-start:not(.range-end)]:rounded-e-none group-[.range-end:not(.range-start)]:rounded-s-none group-[.range-middle]:rounded-none group-data-[selected]:group-[.range-middle]:bg-[var(--color-claude-coral)]/20 group-data-[selected]:group-[.range-middle]:text-[var(--color-text-primary)]",
    day: "group size-9 px-0 text-sm",
    range_start: "range-start",
    range_end: "range-end",
    range_middle: "range-middle",
    today:
      "*:after:pointer-events-none *:after:absolute *:after:bottom-1 *:after:start-1/2 *:after:z-10 *:after:size-[5px] *:after:-translate-x-1/2 *:after:rounded-full *:after:bg-[var(--color-claude-coral)] [&[data-selected]:not(.range-middle)>*]:after:bg-white [&[data-disabled]>*]:after:bg-[var(--color-text-muted)]/30 *:after:transition-colors",
    outside:
      "text-[var(--color-text-muted)] data-selected:bg-[var(--color-claude-coral)]/30 data-selected:text-[var(--color-text-muted)]",
    hidden: "invisible",
    week_number: "size-9 p-0 text-xs font-medium text-[var(--color-text-muted)]",
  };

  const mergedClassNames: typeof defaultClassNames = Object.keys(defaultClassNames).reduce(
    (acc, key) => ({
      ...acc,
      [key]: classNames?.[key as keyof typeof classNames]
        ? cn(
            defaultClassNames[key as keyof typeof defaultClassNames],
            classNames[key as keyof typeof classNames]
          )
        : defaultClassNames[key as keyof typeof defaultClassNames],
    }),
    {} as typeof defaultClassNames
  );

  const mergedComponents = {
    Chevron: ({ orientation }: { orientation?: "left" | "right" | "up" | "down" }) => {
      if (orientation === "left") {
        return <ChevronLeft size={16} strokeWidth={2} aria-hidden="true" />;
      }
      return <ChevronRight size={16} strokeWidth={2} aria-hidden="true" />;
    },
    ...userComponents,
  };

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("w-fit p-3", className)}
      classNames={mergedClassNames}
      components={mergedComponents}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar };
