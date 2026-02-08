"use client";

import { useInView } from "@/hooks/use-in-view";
import { CLIButton } from "@/components/cli/CLIButton";

const STEPS = [
  {
    num: "01",
    icon: "🔐",
    title: "Sign in",
    desc: "Quick OAuth login",
  },
  {
    num: "02",
    icon: "⚡",
    title: "Install CLI",
    desc: "npx ccgather",
  },
  {
    num: "03",
    icon: "📊",
    title: "Auto sync",
    desc: "Usage tracked automatically",
  },
];

export function HowItWorks() {
  const containerRef = useInView<HTMLElement>();

  return (
    <section className="py-16 px-6" ref={containerRef}>
      <div className="max-w-2xl mx-auto">
        {/* Section header */}
        <div className="text-center mb-10">
          <p className="text-xs text-[var(--color-claude-coral)] font-medium tracking-wide uppercase mb-3">
            Start in 60 Seconds
          </p>
          <h2 className="text-xl md:text-2xl font-bold text-[var(--color-text-primary)]">
            Begin documenting your journey
          </h2>
        </div>

        {/* Steps - Horizontal on desktop, vertical on mobile */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-4 mb-10">
          {STEPS.map((step, index) => (
            <div
              key={step.num}
              className="scroll-reveal relative text-center"
              style={{ transitionDelay: `${index * 150}ms` }}
            >
              {/* Connector line (desktop only) */}
              {index < STEPS.length - 1 && (
                <div className="hidden md:block absolute top-6 left-[60%] w-[80%] h-px bg-gradient-to-r from-white/20 to-transparent" />
              )}

              {/* Step number */}
              <div className="text-[10px] text-[var(--color-claude-coral)] font-mono mb-2">
                {step.num}
              </div>

              {/* Icon */}
              <div className="text-3xl mb-2">{step.icon}</div>

              {/* Title */}
              <div className="text-sm font-semibold text-[var(--color-text-primary)] mb-1">
                {step.title}
              </div>

              {/* Description */}
              <div className="text-xs text-[var(--color-text-muted)]">{step.desc}</div>
            </div>
          ))}
        </div>

        {/* CLI Install Command */}
        <div
          className="scroll-reveal glass rounded-xl p-4 max-w-md mx-auto"
          style={{ transitionDelay: "300ms" }}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider">
              Quick Install
            </span>
            <span className="text-[10px] text-green-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
              Ready
            </span>
          </div>
          <div className="bg-[var(--color-bg-elevated)] rounded-lg p-3 font-mono text-sm">
            <span className="text-[var(--color-text-muted)]">$</span>{" "}
            <span className="text-[var(--color-claude-coral)]">npx</span>{" "}
            <span className="text-[var(--color-text-primary)]">ccgather</span>
          </div>
        </div>

        {/* CLI commands link */}
        <div className="text-center mt-4">
          <CLIButton className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-claude-coral)] transition-colors">
            View all CLI commands →
          </CLIButton>
        </div>
      </div>
    </section>
  );
}
