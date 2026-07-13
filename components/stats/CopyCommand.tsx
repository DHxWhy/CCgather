"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CopyCommand({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.warn("[CopyCommand] clipboard write failed:", error);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={copied ? "Copied" : `Copy command ${command}`}
      className="group flex items-center gap-2 whitespace-nowrap rounded-lg border border-[var(--border-default)] bg-[var(--color-bg-elevated)] px-3 py-2 font-mono text-sm text-[var(--color-text-primary)] transition-colors hover:border-[var(--border-hover)] active:scale-[0.98]"
    >
      <span>{command}</span>
      {copied ? (
        <Check aria-hidden className="h-3.5 w-3.5 text-[var(--stats-chart-3)]" />
      ) : (
        <Copy
          aria-hidden
          className="h-3.5 w-3.5 text-[var(--color-text-muted)] transition-colors group-hover:text-[var(--color-text-secondary)]"
        />
      )}
    </button>
  );
}
