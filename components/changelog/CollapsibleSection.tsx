"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

interface CollapsibleSectionProps {
  title: string;
  count: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

export default function CollapsibleSection({
  title,
  count,
  defaultOpen = false,
  children,
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="mb-6">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between text-sm font-medium text-text-muted mb-3 uppercase tracking-wider hover:text-[var(--color-text-primary)] transition-colors group"
      >
        <span className="flex items-center gap-2">
          {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          {title} ({count})
        </span>
        <span className="text-xs normal-case text-text-muted/60 group-hover:text-text-muted">
          {isOpen ? "Click to collapse" : "Click to expand"}
        </span>
      </button>

      {isOpen && <div className="animate-in slide-in-from-top-2 duration-200">{children}</div>}
    </div>
  );
}
