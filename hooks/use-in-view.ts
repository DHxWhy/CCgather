"use client";

import { useEffect, useRef } from "react";

/**
 * Lightweight IntersectionObserver hook that adds 'visible' class
 * to child elements with 'scroll-reveal' or 'scroll-reveal-x' classes.
 * Replaces framer-motion whileInView for simple fade-in animations.
 */
export function useInView<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const container = ref.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            (entry.target as HTMLElement).classList.add("visible");
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.1 }
    );

    const elements = container.querySelectorAll(".scroll-reveal, .scroll-reveal-x, .panel-reveal");
    elements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, []);

  return ref;
}
