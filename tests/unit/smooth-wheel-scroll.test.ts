import { describe, expect, it, vi } from "vitest";
import { bindSmoothWheel, smoothWheelOptions } from "@/hooks/use-smooth-wheel-scroll";

function fakeMedia(initial: boolean) {
  const listeners = new Set<() => void>();
  return {
    matches: initial,
    addEventListener: (_type: "change", listener: () => void) => void listeners.add(listener),
    removeEventListener: (_type: "change", listener: () => void) => void listeners.delete(listener),
    flip(next: boolean) {
      this.matches = next;
      for (const listener of [...listeners]) listener();
    },
    listenerCount: () => listeners.size,
  };
}

function fakeLenis() {
  return { destroy: vi.fn() };
}

describe("bindSmoothWheel", () => {
  it("터치·동작 줄이기 환경(쿼리 불일치)에서는 Lenis 를 만들지 않는다", () => {
    const media = fakeMedia(false);
    const create = vi.fn(fakeLenis);
    const publish = vi.fn();

    const unbind = bindSmoothWheel(media, create, publish);

    expect(create).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
    unbind();
    expect(media.listenerCount()).toBe(0);
  });

  it("마우스 환경이면 하나만 만들고, 해제 시 destroy 후 null 을 알린다", () => {
    const media = fakeMedia(true);
    const instance = fakeLenis();
    const publish = vi.fn();

    const unbind = bindSmoothWheel(media, () => instance, publish);
    expect(publish).toHaveBeenLastCalledWith(instance);

    unbind();
    expect(instance.destroy).toHaveBeenCalledTimes(1);
    expect(publish).toHaveBeenLastCalledWith(null);
    expect(media.listenerCount()).toBe(0);
  });

  it("입력 환경이 바뀌면 즉시 끄고, 돌아오면 새로 켠다", () => {
    const media = fakeMedia(true);
    const instances: Array<ReturnType<typeof fakeLenis>> = [];
    const create = vi.fn(() => {
      const next = fakeLenis();
      instances.push(next);
      return next;
    });
    const publish = vi.fn();

    bindSmoothWheel(media, create, publish);
    media.flip(false);
    expect(instances[0]!.destroy).toHaveBeenCalledTimes(1);
    expect(publish).toHaveBeenLastCalledWith(null);

    media.flip(true);
    expect(create).toHaveBeenCalledTimes(2);
    expect(publish).toHaveBeenLastCalledWith(instances[1]);
  });
});

describe("smoothWheelOptions", () => {
  it("휠 리스너는 그 패널에만 달고, 높이는 캐시 없이 매번 실측한다", () => {
    const panel = {} as HTMLElement;
    expect(smoothWheelOptions(panel)).toMatchObject({
      wrapper: panel,
      eventsTarget: panel,
      naiveDimensions: true,
      autoResize: false,
      autoRaf: true,
    });
  });
});
