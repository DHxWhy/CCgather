import { test, expect } from "@playwright/test";

const VIEWPORTS = [
  { label: "mobile-320", width: 320, height: 800 },
  { label: "mobile-360", width: 360, height: 800 },
  { label: "mobile-390", width: 390, height: 844 },
  { label: "mobile-412", width: 412, height: 915 },
  { label: "tablet-768", width: 768, height: 1024 },
  { label: "tablet-1024", width: 1024, height: 1366 },
  { label: "desktop-1280", width: 1280, height: 800 },
  { label: "desktop-1440", width: 1440, height: 900 },
];

async function overflowingElements(page: import("@playwright/test").Page, innerWidth: number) {
  return page.evaluate((iw: number) => {
    const bad: string[] = [];
    // 페이지 전역이 아니라 스프린트 섹션 내부만 본다. /stats 상단의 WebGL 지구본은
    // 절대배치 오버레이 점을 쓰고 헤드리스에서 좌표가 불안정해 과탐을 만든다.
    // 페이지 전체의 진짜 가로 스크롤은 아래 scrollWidth 단정이 따로 지킨다.
    const root = document.getElementById("season-sprint");
    if (!root) return ["#season-sprint not found"];
    for (const el of Array.from(root.querySelectorAll("*"))) {
      // 의도적으로 스크롤되는 티커는 제외
      if (el.closest(".marquee-viewport")) continue;
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) continue;
      // 숨겨진 요소(예: GlobeStatsSection 의 hideStats 요약줄)는 사용자에게
      // 보이지도, 가로 스크롤을 만들지도 않으므로 과탐을 피해 제외한다.
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || cs.opacity === "0") continue;
      if (-r.left > 0.5 || r.right - iw > 0.5) {
        bad.push(
          `${el.tagName.toLowerCase()}.${(el.getAttribute("class") || "").split(" ")[0]}|${(
            el.textContent || ""
          )
            .trim()
            .slice(0, 20)}`
        );
      }
    }
    return bad;
  }, innerWidth);
}

test.describe("stats season sprint", () => {
  test("renders the sprint board with ranked rows and a live countdown", async ({ page }) => {
    await page.goto("/stats");
    const section = page.locator("#season-sprint");
    await expect(section.getByRole("heading", { name: /season sprint/i })).toBeVisible({
      timeout: 30_000,
    });

    const rows = section.locator("ol > li");
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThanOrEqual(20);
    await expect(rows.first()).toContainText("1");

    const countdown = section.locator("span", { hasText: /ends in|locks in/ }).first();
    await expect(countdown).toBeVisible();
    const first = await countdown.textContent();
    await page.waitForTimeout(2200);
    const second = await countdown.textContent();
    expect(second).not.toEqual(first);
  });

  for (const vp of VIEWPORTS) {
    test(`no horizontal overflow at ${vp.label}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/stats");
      // /stats 는 요청마다 12개 RPC 를 도는 동적 페이지라 응답이 느릴 수 있다.
      await expect(page.locator("#season-sprint")).toBeVisible({ timeout: 30_000 });
      await page.waitForTimeout(1200);
      expect(await overflowingElements(page, vp.width)).toEqual([]);

      const realOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth
      );
      expect(realOverflow).toBeLessThanOrEqual(0);
    });
  }

  test("leaderboard stays isolated from the season sprint", async ({ page }) => {
    await page.goto("/leaderboard");
    await expect(page.locator("main")).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(2000);
    await expect(page.locator("#season-sprint")).toHaveCount(0);
  });
});
