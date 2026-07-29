"use client";

import { useEffect, useRef, useState } from "react";

interface CountUpProps {
  value: number;
  format: (n: number) => string;
  durationMs?: number;
  className?: string;
}

const DEFAULT_DURATION_MS = 1400;

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * SEO: 서버 렌더와 첫 클라이언트 렌더는 항상 최종 값을 그린다. 애니메이션은
 * 마운트 뒤에만 시작하므로 크롤러가 보는 HTML 에는 실제 숫자가 들어 있고,
 * 하이드레이션 불일치도 생기지 않는다. prefers-reduced-motion 이면 건너뛴다.
 */
export function CountUp({
  value,
  format,
  durationMs = DEFAULT_DURATION_MS,
  className,
}: CountUpProps) {
  const [display, setDisplay] = useState(value);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) {
      setDisplay(value);
      return;
    }
    startedRef.current = true;

    if (
      typeof window === "undefined" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      value <= 0
    ) {
      setDisplay(value);
      return;
    }

    let frame = 0;
    let start: number | null = null;

    const tick = (now: number) => {
      if (start === null) start = now;
      const progress = Math.min((now - start) / durationMs, 1);
      setDisplay(Math.round(value * easeOutCubic(progress)));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };

    setDisplay(0);
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, durationMs]);

  return (
    <span className={className} suppressHydrationWarning>
      {format(display)}
    </span>
  );
}
