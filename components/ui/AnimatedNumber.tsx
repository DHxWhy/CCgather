"use client";

import { useEffect, useRef, useState } from "react";

interface AnimatedNumberProps {
  value: number;
  duration?: number; // 고정 애니메이션 지속시간 (ms)
  perUnitDuration?: number; // 1단위당 ms (예: 1000 = 1초에 1씩) - 이게 있으면 duration 무시
  maxDuration?: number; // 최대 duration 제한 (ms)
  minDuration?: number; // 최소 duration 제한 (ms)
  className?: string;
  formatter?: (value: number) => string;
  storageKey?: string; // sessionStorage 키 (이전 값 기억용)
  easing?: "easeOut" | "linear"; // 이징 함수 선택
}

/**
 * 숫자가 천천히 롤링되는 애니메이션 컴포넌트
 * A2 방식: 이전 값 → 새 값으로 변화분만 애니메이션
 * sessionStorage로 탭 전환 시에도 이전 값 기억
 *
 * 사용 예시:
 * - 커뮤니티 (작은 숫자): perUnitDuration={800} maxDuration={20000}
 * - 리더보드 (큰 숫자): duration={8000} easing="linear"
 */
export default function AnimatedNumber({
  value,
  duration = 1500,
  perUnitDuration,
  maxDuration = 30000,
  minDuration = 300,
  className,
  formatter = (n) => n.toLocaleString(),
  storageKey,
  easing = "easeOut",
}: AnimatedNumberProps) {
  // sessionStorage에서 이전 값 읽기
  const getStoredValue = (): number => {
    if (!storageKey || typeof window === "undefined") return value;
    try {
      const stored = sessionStorage.getItem(`animNum_${storageKey}`);
      return stored ? parseInt(stored, 10) : value;
    } catch {
      return value;
    }
  };

  const [displayValue, setDisplayValue] = useState(value);
  const previousValueRef = useRef<number | null>(null);
  const animationRef = useRef<number | null>(null);
  const isFirstMount = useRef(true);

  useEffect(() => {
    // 첫 마운트 시 이전 값 가져오기
    if (isFirstMount.current) {
      previousValueRef.current = getStoredValue();
      isFirstMount.current = false;
    }

    const previousValue = previousValueRef.current ?? value;
    const difference = value - previousValue;
    const absDifference = Math.abs(difference);

    // 값이 같으면 애니메이션 불필요
    if (difference === 0) {
      setDisplayValue(value);
      return;
    }

    // 실제 duration 계산
    let actualDuration: number;
    if (perUnitDuration) {
      // 1단위당 시간 기반 계산
      actualDuration = absDifference * perUnitDuration;
      actualDuration = Math.min(actualDuration, maxDuration);
      actualDuration = Math.max(actualDuration, minDuration);
    } else {
      // 고정 duration 사용
      actualDuration = duration;
    }

    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / actualDuration, 1);

      // 이징 함수 선택
      let easedProgress: number;
      if (easing === "linear") {
        easedProgress = progress;
      } else {
        // easeOutQuart - 천천히 감속
        easedProgress = 1 - Math.pow(1 - progress, 4);
      }

      const currentValue = Math.round(previousValue + difference * easedProgress);
      setDisplayValue(currentValue);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        setDisplayValue(value);
        previousValueRef.current = value;
        // sessionStorage에 현재 값 저장
        if (storageKey && typeof window !== "undefined") {
          try {
            sessionStorage.setItem(`animNum_${storageKey}`, value.toString());
          } catch {
            // 무시
          }
        }
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [value, duration, perUnitDuration, maxDuration, minDuration, storageKey, easing]);

  return <span className={className}>{formatter(displayValue)}</span>;
}
