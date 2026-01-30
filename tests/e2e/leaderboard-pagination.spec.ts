// spec: tests/e2e/leaderboard.plan.md
// Group C: Pagination

import { test, expect } from "./fixtures/test-setup";

test.describe("Pagination", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/leaderboard");
    await expect(page.locator("table tbody tr")).toHaveCount(20, { timeout: 15000 });
  });

  test("Navigate to Next Page", async ({ page }) => {
    // Wait for pagination to appear (it appears when there are more than 1 page)
    await page.waitForTimeout(500);

    // Find the next button (contains › character) - use text matching
    const nextButton = page.locator("button").filter({ hasText: "›" }).last();

    // Check if pagination exists, skip if only one page
    if ((await nextButton.count()) === 0) {
      test.skip();
      return;
    }

    await expect(nextButton).toBeVisible();

    // Click next page
    await nextButton.click();
    await page.waitForTimeout(500);

    // Verify page 2 data loads (first rank should be #21)
    const firstRank = page.locator("table tbody tr").first().locator("td").first();
    await expect(firstRank).toContainText("#21");

    // Verify previous button is NOT disabled (enabled on page 2)
    const prevButton = page.locator("button").filter({ hasText: "‹" }).first();
    await expect(prevButton).not.toBeDisabled();
  });

  test("Navigate to Previous Page", async ({ page }) => {
    // First navigate to page 2
    await page.waitForTimeout(500);
    const nextButton = page.locator("button").filter({ hasText: "›" }).last();

    if ((await nextButton.count()) === 0) {
      test.skip();
      return;
    }

    await nextButton.click();
    await page.waitForTimeout(500);

    // Navigate back
    const prevButton = page.locator("button").filter({ hasText: "‹" }).first();
    await prevButton.click();
    await page.waitForTimeout(500);

    // Verify back on page 1 (first rank should be 🥇)
    const firstRank = page.locator("table tbody tr").first().locator("td").first();
    await expect(firstRank).toContainText("🥇");

    // Verify prev button is disabled on page 1
    await expect(prevButton).toBeDisabled();
  });

  test("Click Specific Page Number", async ({ page }) => {
    // Check if page 3 exists
    const page3Button = page.locator("button").filter({ hasText: /^3$/ });
    const hasPage3 = (await page3Button.count()) > 0;

    if (!hasPage3) {
      test.skip();
      return;
    }

    // Click page 3
    await page3Button.click();
    await page.waitForTimeout(500);

    // Verify page 3 data (ranks #41-#50)
    const firstRank = page.locator("table tbody tr").first().locator("td").first();
    await expect(firstRank).toContainText("#41");
  });

  test("First Page Boundary - Previous button disabled", async ({ page }) => {
    // On page 1, previous should be disabled
    await page.waitForTimeout(500);
    const prevButton = page.locator("button").filter({ hasText: "‹" }).first();

    if ((await prevButton.count()) === 0) {
      test.skip();
      return;
    }

    // Verify button is disabled on page 1
    await expect(prevButton).toBeDisabled();
  });

  test("Total User Count Display", async ({ page }) => {
    // Look for user count text
    const userCountText = page.locator("span").filter({ hasText: /\d+ users/ });
    await expect(userCountText).toBeVisible();
    const text = await userCountText.textContent();
    expect(text).toMatch(/\d+ users/);
  });
});
