import { X } from "lucide-react";
import { CLI_UPDATE_DISMISS_DAYS, describeCliVersion } from "@/lib/cli/update-notice";

function Command({ children }: { children: string }) {
  return (
    <code className="whitespace-nowrap rounded px-1.5 py-0.5 font-mono text-[11px] text-[var(--color-claude-coral)] bg-[var(--color-bg-elevated)] ring-1 ring-[var(--border-default)]">
      {children}
    </code>
  );
}

export function CliUpdateNotice({
  version,
  onDismiss,
}: {
  version: string;
  onDismiss: () => void;
}) {
  return (
    <div className="border-b border-[var(--color-claude-coral)]/25 bg-[var(--color-claude-coral)]/[0.08]">
      <div className="relative mx-auto max-w-[1000px] px-4 py-2.5 pr-10 text-[12px] leading-relaxed text-[var(--color-text-secondary)]">
        <p>
          <span className="font-medium text-[var(--color-text-primary)]">
            Your last sync used {describeCliVersion(version)}.
          </span>{" "}
          Update to keep your count accurate: <Command>npx ccgather@latest</Command>
        </p>
        <p className="mt-1">
          Auto-submit on? Run <Command>npx ccgather@latest autosubmit on</Command> once on each
          computer. Until then it keeps running the old version.
        </p>
        <button
          type="button"
          onClick={onDismiss}
          aria-label={`Hide for ${CLI_UPDATE_DISMISS_DAYS} days`}
          className="absolute right-3 top-2 p-1 text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-primary)]"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
