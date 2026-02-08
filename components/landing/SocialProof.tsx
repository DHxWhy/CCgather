"use client";

import { useInView } from "@/hooks/use-in-view";
import { GetStartedLink } from "@/components/landing/GetStartedLink";

const REVIEWS = [
  {
    text: "This solves a real problem. I\u2019ve been using Claude Code heavily and didn\u2019t realize how much context I was losing as sessions expired. Props for going from zero CS background to shipping this in 3 weeks.",
    author: "Davis",
    color: "border-[var(--color-claude-coral)]/30",
  },
  {
    text: "I\u2019ve burned through so many Claude Code tokens and didn\u2019t even realize the history was being deleted. This is a perfect example of scratching your own itch.",
    author: "Philip S.",
    color: "border-emerald-500/30",
  },
  {
    text: "Love how tokens are treated as exploration, not skill points. That mindset feels honest and refreshing.",
    author: "Yosun Negi",
    color: "border-amber-500/30",
  },
];

export function SocialProof() {
  const containerRef = useInView<HTMLElement>();

  return (
    <section className="pb-12 px-6" ref={containerRef}>
      <div className="scroll-reveal max-w-2xl mx-auto">
        {/* Product Hunt badge */}
        <div className="flex items-center justify-center mb-6">
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-[var(--color-text-muted)]">
            <span className="text-[var(--color-claude-coral)]">&#9650;</span>
            <span>
              Featured on{" "}
              <span className="text-[var(--color-text-secondary)] font-medium">Product Hunt</span>{" "}
              &mdash; 116 upvotes on launch day
            </span>
          </span>
        </div>

        {/* Reviews */}
        <div className="space-y-3">
          {REVIEWS.map((review, index) => (
            <blockquote
              key={review.author}
              className={`scroll-reveal border-l-2 ${review.color} pl-4 text-xs text-[var(--color-text-muted)] italic`}
              style={{ transitionDelay: `${index * 100}ms` }}
            >
              &quot;{review.text}&quot;
              <span className="block mt-1 not-italic">&mdash; {review.author}, Product Hunt</span>
            </blockquote>
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="scroll-reveal mt-10 text-center" style={{ transitionDelay: "300ms" }}>
          <p className="text-sm text-[var(--color-text-secondary)] mb-4">
            Ready to track your Claude Code journey?
          </p>
          <GetStartedLink className="inline-block px-5 py-2.5 rounded-xl bg-[#b84c30] text-white text-sm font-semibold hover:opacity-90 hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-[var(--color-claude-coral)]/20">
            Get Started
          </GetStartedLink>
        </div>
      </div>
    </section>
  );
}
