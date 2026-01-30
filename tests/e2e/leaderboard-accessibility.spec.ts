// spec: tests/e2e/leaderboard.plan.md
// Group F: Accessibility & Edge Cases

import { test, expect, type Page } from "./fixtures/test-setup";

async function waitForLeaderboardLoad(page: Page) {
  await page.waitForSelector("table tbody tr", { timeout: 15000 });
  await page.waitForTimeout(500);
}

test.describe("Accessibility & Edge Cases", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/leaderboard");
    await waitForLeaderboardLoad(page);
  });

  test.describe("Accessibility Tests", () => {
    test("Keyboard Navigation - ESC closes panel", async ({ page }) => {
      // Open panel
      await page.locator("table tbody tr").first().click();
      await page.waitForTimeout(400);
      await expect(page.getByText("Profile Details")).toBeVisible();

      // Press ESC
      await page.keyboard.press("Escape");

      // Panel should be closed (element disappears from DOM after animation)
      await expect(page.getByText("Profile Details")).not.toBeVisible({ timeout: 5000 });
    });
  });

  test.describe("Responsive Tests", () => {
    test("Mobile Viewport", async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.reload();
      await waitForLeaderboardLoad(page);

      // Verify short period labels exist (mobile shows 1D in span inside button)
      // The button contains a span with "1D" text for mobile
      const periodButtons = page.locator("button").filter({ hasText: /1D|7D|30D|All/ });
      await expect(periodButtons.first()).toBeVisible();

      // Open panel
      await page.locator("table tbody tr").first().click();
      await page.waitForTimeout(500);

      // Verify panel is visible
      await expect(page.getByText("Profile Details")).toBeVisible();
    });

    test("Tablet Viewport", async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.reload();
      await waitForLeaderboardLoad(page);

      // Verify full period labels
      const fullLabel = page.locator("button").filter({ hasText: "Today" });
      await expect(fullLabel).toBeVisible();
    });
  });

  test.describe("Edge Cases", () => {
    test("Rapid Filter Changes", async ({ page }) => {
      // Rapid clicks using more flexible selectors
      const periodFilterGroup = page.locator(".flex.p-1.rounded-lg").nth(1);
      const buttons = periodFilterGroup.locator("button");

      // Click through each button rapidly
      await buttons.nth(0).click();
      await buttons.nth(1).click();
      await buttons.nth(2).click();
      await buttons.nth(3).click();

      // Wait for stabilization
      await page.waitForTimeout(1000);

      // Verify table still loads correctly
      const rows = page.locator("table tbody tr");
      await expect(rows.first()).toBeVisible();
      const rowCount = await rows.count();
      expect(rowCount).toBeGreaterThan(0);
    });

    test("Panel Open During Filter Change", async ({ page }) => {
      // Open panel
      await page.locator("table tbody tr").first().click();
      await page.waitForTimeout(600);
      await expect(page.getByText("Profile Details")).toBeVisible({ timeout: 5000 });

      // Close panel temporarily on mobile to access filters
      const viewportSize = page.viewportSize();
      if (viewportSize && viewportSize.width < 768) {
        await page.keyboard.press("Escape");
        await page.waitForTimeout(400);
      }

      // Change filter using more specific selector
      const periodFilterGroup = page.locator(".flex.p-1.rounded-lg").nth(1);
      await periodFilterGroup.locator("button").nth(1).click();
      await page.waitForTimeout(500);

      // If panel was closed, reopen it
      if (viewportSize && viewportSize.width < 768) {
        await page.locator("table tbody tr").first().click();
        await page.waitForTimeout(600);
      }

      // Panel should be visible
      await expect(page.getByText("Profile Details")).toBeVisible({ timeout: 5000 });

      // Table should update
      await expect(page.locator("table tbody tr").first()).toBeVisible();
    });

    test("Refresh While Panel Open", async ({ page }) => {
      // Open panel
      await page.locator("table tbody tr").first().click();
      await page.waitForTimeout(500);
      await expect(page.getByText("Profile Details")).toBeVisible();

      // Refresh
      await page.reload();
      await waitForLeaderboardLoad(page);

      // Panel should be closed after refresh (not visible in DOM)
      await expect(page.getByText("Profile Details")).not.toBeVisible({ timeout: 5000 });
    });

    test("Row Animation on Load", async ({ page }) => {
      await page.goto("/leaderboard");

      // Wait a bit for animation to start
      await page.waitForTimeout(200);

      // Check if rows are loading with animation
      const firstRow = page.locator("table tbody tr").first();
      await expect(firstRow).toBeVisible({ timeout: 5000 });

      // Wait for animations to complete
      await page.waitForTimeout(1000);

      // All rows should be visible
      const rows = page.locator("table tbody tr");
      await expect(rows.first()).toBeVisible();
    });
  });
});
