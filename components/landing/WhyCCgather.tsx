"use client";

import { motion } from "framer-motion";

const FEATURES = [
  {
    icon: "🌍",
    title: "40+ Countries",
    desc: "Global leaderboard with country-based competitive leagues",
  },
  {
    icon: "🏆",
    title: "10 Levels, 27 Badges",
    desc: "Progression system from Rookie to Immortal",
  },
  {
    icon: "🌐",
    title: "3D Globe",
    desc: "3D globe and GitHub-style activity heatmap",
  },
  {
    icon: "💬",
    title: "AI Translation",
    desc: "Multilingual community posts, auto-translated",
  },
  {
    icon: "📱",
    title: "PWA & Push",
    desc: "Native-like experience with push notifications",
  },
  {
    icon: "🔓",
    title: "Open Source",
    desc: "Apache 2.0 — built as a solo side project",
  },
];

export function WhyCCgather() {
  return (
    <section className="py-16 px-6">
      <div className="max-w-2xl mx-auto">
        {/* Section header — GEO keywords preserved in HTML */}
        <div className="text-center mb-10">
          <p className="text-xs text-[var(--color-claude-coral)] font-medium tracking-wide uppercase mb-3">
            Why CCgather
          </p>
          <h2 className="text-xl md:text-2xl font-bold text-[var(--color-text-primary)]">
            What is CCgather?
          </h2>
          <p className="text-sm text-[var(--color-text-secondary)] mt-3 max-w-lg mx-auto leading-relaxed">
            A free, open-source Claude Code leaderboard and community built as a solo side project
            by a non-developer from South Korea. Track token usage, costs, and sessions across 40+
            countries in real time.
          </p>
        </div>

        {/* Feature cards grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {FEATURES.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.08, duration: 0.4 }}
              className="glass rounded-xl p-4 border border-[var(--border-default)]"
            >
              <div className="text-2xl mb-2">{feature.icon}</div>
              <div className="text-sm font-semibold text-[var(--color-text-primary)] mb-1">
                {feature.title}
              </div>
              <div className="text-xs text-[var(--color-text-muted)]">{feature.desc}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
