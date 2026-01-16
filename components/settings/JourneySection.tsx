"use client";

interface JourneySectionProps {
  createdAt: Date;
}

export default function JourneySection({ createdAt }: JourneySectionProps) {
  const daysWithCCgather =
    Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24)) + 1;

  return (
    <section>
      <h2 className="text-sm font-medium text-[var(--color-text-secondary)] mb-3">Journey</h2>
      <div className="px-4 py-3 rounded-lg bg-[var(--color-bg-tertiary)] border border-[var(--border-default)]">
        <p className="text-sm text-[var(--color-text-primary)]">
          You&apos;ve been with CCgather for{" "}
          <span className="font-semibold text-[var(--color-claude-coral)]">
            {daysWithCCgather} {daysWithCCgather === 1 ? "day" : "days"}
          </span>
        </p>
        <p className="text-xs text-[var(--color-text-muted)] mt-1">
          Member since{" "}
          {new Date(createdAt).toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
          })}
        </p>
      </div>
    </section>
  );
}
