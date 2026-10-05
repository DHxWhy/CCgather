"use client";

import Lenis, { type LenisOptions } from "lenis";
import { useEffect, useRef, type RefObject } from "react";

// 마우스 휠·트랙패드에서만 켠다. Lenis 는 touchstart/touchmove 를 passive:false 로 달아
// 터치 모멘텀 스크롤을 메인 스레드에 묶으므로(모바일 끊김 3cae3d2 와 같은 계열) 터치 기기와
// 동작 줄이기 사용자는 네이티브 스크롤 그대로 둔다.
export const SMOOTH_WHEEL_MEDIA_QUERY =
  "(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)";

interface MediaQueryLike {
  matches: boolean;
  addEventListener(type: "change", listener: () => void): void;
  removeEventListener(type: "change", listener: () => void): void;
}

export function bindSmoothWheel<T extends { destroy(): void }>(
  media: MediaQueryLike,
  create: () => T,
  publish: (instance: T | null) => void
): () => void {
  let instance: T | null = null;

  const sync = () => {
    if (media.matches && !instance) {
      instance = create();
    } else if (!media.matches && instance) {
      instance.destroy();
      instance = null;
    } else {
      return;
    }
    publish(instance);
  };

  sync();
  media.addEventListener("change", sync);
  return () => {
    media.removeEventListener("change", sync);
    instance?.destroy();
    instance = null;
    publish(null);
  };
}

export function smoothWheelOptions(wrapper: HTMLElement | Window): LenisOptions {
  return {
    wrapper,
    eventsTarget: wrapper,
    autoRaf: true,
    // 기본 0.1 은 휠 한 칸이 멈추기까지 0.88s 라 "느려졌다"는 체감이 났다 — 0.2 면 0.45s (2026-10-05 실측)
    lerp: 0.2,
    // 가상 스크롤·무한 로딩·지구본 접힘으로 높이가 수시로 바뀐다 — 캐시 대신 휠마다 실측
    naiveDimensions: true,
    autoResize: false,
    allowNestedScroll: true,
  };
}

export function useSmoothWheelScroll(
  target: HTMLElement | "window" | null
): RefObject<Lenis | null> {
  const lenisRef = useRef<Lenis | null>(null);

  useEffect(() => {
    if (!target) return undefined;
    const wrapper = target === "window" ? window : target;
    return bindSmoothWheel(
      window.matchMedia(SMOOTH_WHEEL_MEDIA_QUERY),
      () => new Lenis(smoothWheelOptions(wrapper)),
      (instance) => {
        lenisRef.current = instance;
      }
    );
  }, [target]);

  return lenisRef;
}

// 관성 애니메이션 도중에 scrollTop 만 바꾸면 Lenis 가 다음 프레임에 되돌린다 — 애니메이션을 끊고 맨 위로
export function jumpToTop(el: HTMLElement | null, lenis: Lenis | null): void {
  lenis?.scrollTo(0, { immediate: true, force: true });
  if (el) el.scrollTop = 0;
}
