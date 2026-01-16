"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface AdminTableColumn<T = Record<string, unknown>> {
  key: string;
  label: string;
  width?: string;
  align?: "left" | "center" | "right";
  render?: (value: unknown, row: T) => ReactNode;
}

interface AdminTableProps<T = Record<string, unknown>> {
  columns: AdminTableColumn<T>[];
  data: T[];
  loading?: boolean;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
  className?: string;
}

export function AdminTable<T extends Record<string, unknown>>({
  columns,
  data,
  loading = false,
  emptyMessage = "No data available",
  onRowClick,
  className,
}: AdminTableProps<T>) {
  const alignClasses = {
    left: "text-left",
    center: "text-center",
    right: "text-right",
  };

  if (loading) {
    return (
      <div className={cn("w-full overflow-x-auto", className)}>
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-4 border-[var(--color-claude-coral)] border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-[var(--color-text-secondary)]">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className={cn("w-full overflow-x-auto", className)}>
        <div className="flex items-center justify-center py-12">
          <p className="text-[var(--color-text-muted)]">{emptyMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("w-full overflow-x-auto", className)}>
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-[var(--border-default)]">
            {columns.map((column) => (
              <th
                key={column.key}
                className={cn(
                  "px-4 py-3 text-sm font-semibold",
                  "text-[var(--color-text-secondary)]",
                  alignClasses[column.align || "left"]
                )}
                style={{ width: column.width }}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, rowIndex) => (
            <tr
              key={rowIndex}
              className={cn(
                "border-b border-[var(--border-default)]",
                "transition-colors duration-200",
                rowIndex % 2 === 0 && "bg-[var(--color-table-row-even)]",
                onRowClick && "cursor-pointer hover:bg-[var(--color-table-row-hover)]"
              )}
              onClick={() => onRowClick?.(row)}
            >
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={cn(
                    "px-4 py-3 text-sm",
                    "text-[var(--color-text-primary)]",
                    alignClasses[column.align || "left"]
                  )}
                >
                  {column.render
                    ? column.render(row[column.key], row)
                    : String(row[column.key] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
