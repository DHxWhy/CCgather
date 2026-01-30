"use client";

import { useEffect, useRef, useState, useCallback } from "react";

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
  // Smart start: 큰 숫자를 90%에서 시작하여 부담 감소
  smartStart?: number; // 시작점 비율 (0.9 = 90%, 0 = 비활성화)
  // Realtime simulation: 애니메이션 후 천천히 증가하는 효과
  simulateRealtime?: {
    interval: number; // 증가 간격 (ms), 예: 3000 = 3초마다
    minIncrement: number; // 최소 증가량
    maxIncrement: number; // 최대 증가량
  };
}

/**
 * 숫자가 천천히 롤링되는 애니메이션 컴포넌트
 * A2 방식: 이전 값 → 새 값으로 변화분만 애니메이션
 * sessionStorage로 탭 전환 시에도 이전 값 기억
 *
 * 사용 예시:
 * - 커뮤니티 (작은 숫자): perUnitDuration={800} maxDuration={20000}
 * - 리더보드 (큰 숫자): duration={2000} smartStart={0.9} simulateRealtime={{ interval: 5000, minIncrement: 1, maxIncrement: 10 }}
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
  smartStart = 0,
  simulateRealtime,
}: AnimatedNumberProps) {
  // sessionStorage에서 이전 값 읽기
  const getStoredValue = useCallback((): number | null => {
    if (!storageKey || typeof window === "undefined") return null;
    try {
      const stored = sessionStorage.getItem(`animNum_${storageKey}`);
      return stored ? parseInt(stored, 10) : null;
    } catch {
      return null;
    }
  }, [storageKey]);

  const [displayValue, setDisplayValue] = useState(value);
  const previousValueRef = useRef<number | null>(null);
  const animationRef = useRef<number | null>(null);
  const realtimeIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isFirstMount = useRef(true);
  const baseValueRef = useRef<number>(value); // 실제 API 값 저장

  // Realtime simulation effect - starts when value is loaded (> 0)
  useEffect(() => {
    if (!simulateRealtime || value === 0) return;

    // Clear existing interval
    if (realtimeIntervalRef.current) {
      clearInterval(realtimeIntervalRef.current);
    }

    // Start realtime simulation after a short delay
    const startDelay = 2500; // 페이지 로드 후 2.5초 뒤 시작

    const timeoutId = setTimeout(() => {
      realtimeIntervalRef.current = setInterval(() => {
        const increment =
          Math.floor(
            Math.random() * (simulateRealtime.maxIncrement - simulateRealtime.minIncrement + 1)
          ) + simulateRealtime.minIncrement;

        setDisplayValue((prev) => {
          const newValue = prev + increment;
          // sessionStorage 업데이트
          if (storageKey && typeof window !== "undefined") {
            try {
              sessionStorage.setItem(`animNum_${storageKey}`, newValue.toString());
            } catch {
              // 무시
            }
          }
          return newValue;
        });
      }, simulateRealtime.interval);
    }, startDelay);

    return () => {
      clearTimeout(timeoutId);
      if (realtimeIntervalRef.current) {
        clearInterval(realtimeIntervalRef.current);
      }
    };
  }, [simulateRealtime, value, storageKey]);

  // Main animation effect
  useEffect(() => {
    // 값이 0이고 첫 마운트이면 아직 로드 안됨 - 건너뛰기
    // 하지만 이전에 값이 있었다면 0으로 애니메이션해야 함
    if (value === 0 && isFirstMount.current) return;

    // 값이 0으로 변경된 경우 즉시 표시
    if (value === 0) {
      setDisplayValue(0);
      previousValueRef.current = 0;
      if (storageKey && typeof window !== "undefined") {
        try {
          sessionStorage.setItem(`animNum_${storageKey}`, "0");
        } catch {
          // 무시
        }
      }
      return;
    }

    // 실제 API 값 저장
    baseValueRef.current = value;

    // 첫 마운트 시 이전 값 결정
    if (isFirstMount.current) {
      const storedValue = getStoredValue();
      if (storedValue !== null) {
        // 저장된 값이 있으면 그걸 사용
        previousValueRef.current = storedValue;
      } else if (smartStart > 0 && value > 100) {
        // 저장된 값이 없고 smartStart가 활성화되면 90%에서 시작
        previousValueRef.current = Math.floor(value * smartStart);
      } else {
        // 그 외에는 현재 값 (애니메이션 없음)
        previousValueRef.current = value;
      }
      isFirstMount.current = false;
    }

    const previousValue = previousValueRef.current ?? value;
    const difference = value - previousValue;

    // 값이 같으면 애니메이션 불필요
    if (difference === 0) {
      setDisplayValue(value);
      return;
    }

    // 실제 duration 계산
    let actualDuration: number;
    if (perUnitDuration) {
      // 1단위당 시간 기반 계산
      const absDifference = Math.abs(difference);
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
  }, [
    value,
    duration,
    perUnitDuration,
    maxDuration,
    minDuration,
    storageKey,
    easing,
    smartStart,
    getStoredValue,
  ]);

  return <span className={className}>{formatter(displayValue)}</span>;
}
