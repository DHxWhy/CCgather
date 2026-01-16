"use client";

import { Check, Trash2, CornerDownLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface SocialLinkInputProps {
  icon: ReactNode;
  prefix?: string;
  prefixMobile?: string;
  placeholder: string;
  value: string;
  savedValue?: string;
  error?: string;
  isReadOnly?: boolean;
  isConnected?: boolean;
  onChange?: (value: string) => void;
  onSave: () => void;
  onDelete?: () => void;
}

export default function SocialLinkInput({
  icon,
  prefix,
  prefixMobile,
  placeholder,
  value,
  savedValue,
  error,
  isReadOnly,
  isConnected,
  onChange,
  onSave,
  onDelete,
}: SocialLinkInputProps) {
  const isSaved = value && savedValue === value;
  const hasValue = Boolean(value);

  const getBgClass = () => {
    if (error) return "bg-red-500/5 border-red-500/30";
    if (isSaved || isConnected) return "bg-green-500/5 border-green-500/20";
    return "bg-[var(--color-bg-tertiary)] border-[var(--border-default)]";
  };

  return (
    <div>
      <div className={cn("flex items-center gap-2 px-3 py-2.5 rounded-lg border", getBgClass())}>
        <span
          className={cn(
            "flex-shrink-0",
            error
              ? "text-red-500"
              : isSaved || isConnected
                ? "text-green-500"
                : "text-[var(--color-text-muted)]"
          )}
        >
          {icon}
        </span>

        {prefix && (
          <span className="hidden sm:inline text-xs text-[var(--color-text-muted)]">{prefix}</span>
        )}
        {prefixMobile && (
          <span className="sm:hidden text-xs text-[var(--color-text-muted)]">{prefixMobile}</span>
        )}

        <input
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={onChange ? (e) => onChange(e.target.value) : undefined}
          readOnly={isReadOnly}
          onKeyDown={(e) => e.key === "Enter" && !error && hasValue && onSave()}
          className={cn(
            "flex-1 min-w-0 bg-transparent text-sm focus:outline-none",
            isReadOnly ? "cursor-default" : "",
            "text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]"
          )}
        />

        {isConnected ? (
          <span className="text-[10px] text-green-500 flex items-center gap-1 whitespace-nowrap">
            <Check className="w-3 h-3" />
            <span className="hidden xs:inline">Connected</span>
          </span>
        ) : hasValue && !error ? (
          isSaved ? (
            <div className="flex items-center gap-1 group/saved">
              <Check className="w-4 h-4 text-green-500" />
              {onDelete && (
                <button
                  onClick={onDelete}
                  className="p-1 rounded opacity-0 group-hover/saved:opacity-100 hover:bg-red-500/20 transition-all"
                >
                  <Trash2 className="w-3 h-3 text-red-500" />
                </button>
              )}
            </div>
          ) : (
            <button onClick={onSave} className="p-1 rounded hover:bg-white/10 transition-colors">
              <CornerDownLeft className="w-4 h-4 text-[var(--color-text-muted)]" />
            </button>
          )
        ) : null}
      </div>
      {error && <p className="text-[10px] text-red-500 mt-1 ml-1">{error}</p>}
    </div>
  );
}
