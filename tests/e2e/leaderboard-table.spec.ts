// spec: tests/e2e/leaderboard.plan.md
// Group D: Table Display & Panel Opening

import { test, expect } from "./fixtures/test-setup";

test.describe("Table Display & Panel Opening", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/leaderboard");
    await expect(page.locator("table tbody tr")).toHaveCount(20, { timeout: 15000 });
  });

  test.describe("Table Display Tests", () => {
    test("Top 3 Special Styling - Medal emojis", async ({ page }) => {
      const rows = page.locator("table tbody tr");

      // Rank 1 shows 🥇
      const rank1 = rows.nth(0).locator("td").first();
      await expect(rank1).toContainText("🥇");

      // Rank 2 shows 🥈
      const rank2 = rows.nth(1).locator("td").first();
      await expect(rank2).toContainText("🥈");

      // Rank 3 shows 🥉
      const rank3 = rows.nth(2).locator("td").first();
      await expect(rank3).toContainText("🥉");

      // Rank 4+ shows #4
      const rank4 = rows.nth(3).locator("td").first();
      await expect(rank4).toContainText("#4");
    });

    test("User Row Hover State", async ({ page }) => {
      const firstRow = page.locator("table tbody tr").first();
      await expect(firstRow).toBeVisible();

      // Verify row has cursor-pointer class
      const hasPointerClass = await firstRow.evaluate((el) =>
        el.classList.contains("cursor-pointer")
      );
      expect(hasPointerClass).toBeTruthy();
    });

    test("User Avatar Display", async ({ page }) => {
      const firstRow = page.locator("table tbody tr").first();

      // Check for avatar img or gradient div
      const avatarImg = firstRow.locator("img");
      const gradientDiv = firstRow.locator('div[class*="rounded-full"]');

      const hasImg = (await avatarImg.count()) > 0;
      const hasGradient = (await gradientDiv.count()) > 0;

      expect(hasImg || hasGradient).toBeTruthy();
    });

    test("Cost and Token Values Display", async ({ page }) => {
      const firstRow = page.locator("table tbody tr").first();

      // Cost shows with $ prefix
      const costCell = firstRow.locator("td").nth(4);
      const costText = await costCell.textContent();
      expect(costText).toContain("$");

      // Tokens column exists
      const tokenCell = firstRow.locator("td").last();
      const tokenText = await tokenCell.textContent();
      expect(tokenText).toBeTruthy();
    });
  });

  test.describe("Panel Opening Tests", () => {
    test("Open Panel by Row Click", async ({ page }) => {
      const firstRow = page.locator("table tbody tr").first();
      await firstRow.click();

      // Wait for panel
      await page.waitForTimeout(400);

      // Verify panel is visible
      await expect(page.getByText("Profile Details")).toBeVisible();
    });

    test("Close Panel with X Button", async ({ page }) => {
      // Open panel
      const firstRow = page.locator("table tbody tr").first();
      await firstRow.click();
      await page.waitForTimeout(400);
      await expect(page.getByText("Profile Details")).toBeVisible();

      // Find the close button inside the panel (the X icon in the fixed panel)
      // The panel has "Profile Details" text, and the close button is inside it
      const panel = page
        .locator('[class*="fixed"][class*="right-0"]')
        .filter({ hasText: "Profile Details" });
      const closeButton = panel
        .locator("button")
        .filter({ has: page.locator("svg") })
        .first();
      await closeButton.click();

      // Panel should be closed (element disappears from DOM after animation)
      await expect(page.getByText("Profile Details")).not.toBeVisible({ timeout: 5000 });
    });

    test("Close Panel with ESC Key", async ({ page }) => {
      // Open panel
      const firstRow = page.locator("table tbody tr").first();
      await firstRow.click();
      await page.waitForTimeout(400);
      await expect(page.getByText("Profile Details")).toBeVisible();

      // Press Escape
      await page.keyboard.press("Escape");

      // Panel should be closed (element disappears from DOM after animation)
      await expect(page.getByText("Profile Details")).not.toBeVisible({ timeout: 5000 });
    });

    test("Selected Row Highlight", async ({ page }) => {
      const firstRow = page.locator("table tbody tr").first();
      await firstRow.click();
      await page.waitForTimeout(400);

      // Row should have selected styling
      const hasSelectedClass = await firstRow.evaluate((el) => {
        const bg = window.getComputedStyle(el).backgroundColor;
        return bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent";
      });
      expect(hasSelectedClass).toBeTruthy();
    });
  });
});
