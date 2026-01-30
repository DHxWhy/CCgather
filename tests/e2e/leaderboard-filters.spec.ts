// spec: tests/e2e/leaderboard.plan.md
// Group B: Filter Controls

import { test, expect } from "./fixtures/test-setup";

test.describe("Leaderboard Filters", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/leaderboard");
    await expect(page.locator("table tbody tr")).toHaveCount(20, { timeout: 15000 });
  });

  test.describe("Scope Filter Tests", () => {
    test("Switch from Global to Country scope", async ({ page }) => {
      // Find the scope filter group (first .flex.p-1 with rounded-lg)
      const scopeFilterGroup = page.locator(".flex.p-1.rounded-lg").first();
      const countryButton = scopeFilterGroup.locator("button").nth(1);
      await countryButton.click();
      await page.waitForTimeout(500);

      // Verify page title changes
      await expect(page.locator("h1")).toContainText("Country Leaderboard");

      // Verify table reloads
      await expect(page.locator("table tbody tr").first()).toBeVisible();
    });

    test("Switch from Country to Global scope", async ({ page }) => {
      // First switch to country
      const scopeFilterGroup = page.locator(".flex.p-1.rounded-lg").first();
      const countryButton = scopeFilterGroup.locator("button").nth(1);
      await countryButton.click();
      await page.waitForTimeout(500);

      // Click global button (first button in scope group)
      const globalButton = scopeFilterGroup.locator("button").first();
      await globalButton.click();
      await page.waitForTimeout(500);

      // Verify title changes
      await expect(page.locator("h1")).toContainText("Global Leaderboard");
    });
  });

  test.describe("Period Filter Tests", () => {
    test("Filter by Today (1D)", async ({ page }) => {
      // Period filter is the second .flex.p-1.rounded-lg group
      const periodFilterGroup = page.locator(".flex.p-1.rounded-lg").nth(1);
      const todayButton = periodFilterGroup.locator("button").first();
      await todayButton.click();
      await page.waitForTimeout(500);
      await expect(page.locator("table tbody tr").first()).toBeVisible();
    });

    test("Filter by 7D", async ({ page }) => {
      const periodFilterGroup = page.locator(".flex.p-1.rounded-lg").nth(1);
      const sevenDayButton = periodFilterGroup.locator("button").nth(1);
      await sevenDayButton.click();
      await page.waitForTimeout(500);
      await expect(page.locator("table tbody tr").first()).toBeVisible();
    });

    test("Filter by 30D", async ({ page }) => {
      const periodFilterGroup = page.locator(".flex.p-1.rounded-lg").nth(1);
      const thirtyDayButton = periodFilterGroup.locator("button").nth(2);
      await thirtyDayButton.click();
      await page.waitForTimeout(500);
      await expect(page.locator("table tbody tr").first()).toBeVisible();
    });

    test("Filter by All Time", async ({ page }) => {
      const periodFilterGroup = page.locator(".flex.p-1.rounded-lg").nth(1);

      // First set a different period
      await periodFilterGroup.locator("button").first().click();
      await page.waitForTimeout(300);

      // Click All Time (last button)
      const allTimeButton = periodFilterGroup.locator("button").last();
      await allTimeButton.click();
      await page.waitForTimeout(500);
      await expect(page.locator("table tbody tr").first()).toBeVisible();
    });
  });

  test.describe("Sort Filter Tests", () => {
    test("Sort by Cost (💵)", async ({ page }) => {
      const costButton = page.locator('button:has-text("💵")');
      await costButton.click();

      // Verify subtitle changes
      await expect(page.getByText("ranked by spending")).toBeVisible();
    });

    test("Sort by Tokens (🪙)", async ({ page }) => {
      // First switch to cost
      await page.locator('button:has-text("💵")').click();
      await page.waitForTimeout(300);

      // Switch back to tokens
      const tokenButton = page.locator('button:has-text("🪙")');
      await tokenButton.click();

      // Verify subtitle
      await expect(page.getByText("ranked by token usage")).toBeVisible();
    });
  });

  test.describe("Filter changes reset pagination", () => {
    test("Filter change resets to page 1", async ({ page }) => {
      // Check if page 2 exists
      const page2Button = page.locator("button").filter({ hasText: /^2$/ });
      const hasPage2 = (await page2Button.count()) > 0;

      if (!hasPage2) {
        test.skip();
        return;
      }

      // Navigate to page 2
      await page2Button.click();
      await page.waitForTimeout(500);

      // Change period filter using positional selector
      const periodFilterGroup = page.locator(".flex.p-1.rounded-lg").nth(1);
      await periodFilterGroup.locator("button").nth(1).click();
      await page.waitForTimeout(500);

      // Verify page reset (first rank should be #1 or medal)
      const firstRank = page.locator("table tbody tr").first().locator("td").first();
      await expect(firstRank).toContainText(/🥇|#1/);
    });
  });
});
