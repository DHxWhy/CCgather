// spec: tests/e2e/leaderboard.plan.md
// Group A: Basic Loading & States

import { test, expect } from "./fixtures/test-setup";

test.describe("Basic Loading & States", () => {
  test("Initial Page Load - Successful", async ({ page }) => {
    await page.goto("/leaderboard");

    // Wait for table to load (mock data provides 20 rows per page)
    await expect(page.locator("table tbody tr")).toHaveCount(20, { timeout: 15000 });

    // Verify filter buttons exist (scope, period, sort groups)
    const filterGroups = page.locator(".flex.p-1.rounded-lg");
    await expect(filterGroups).toHaveCount(3, { timeout: 5000 }); // scope, period, sort

    // Verify page title
    const pageTitle = page.locator("h1");
    await expect(pageTitle).toContainText("Global");
    await expect(pageTitle).toContainText("Leaderboard");

    // Verify subtitle contains ranking text
    await expect(page.getByText(/Top Claude Code developers ranked by/)).toBeVisible();

    // Verify table headers
    const tableHeaders = page.locator("thead th");
    await expect(tableHeaders.first()).toBeVisible();
  });

  test("Error State Display", async ({ page }) => {
    // Override mock to simulate error
    await page.route("**/api/leaderboard*", (route) => {
      route.abort("failed");
    });

    await page.goto("/leaderboard");
    await page.waitForTimeout(1000);

    // Verify warning icon
    const warningIcon = page.locator("text=⚠️");
    await expect(warningIcon).toBeVisible({ timeout: 10000 });

    // Verify retry button
    const retryButton = page.getByRole("button", { name: /retry/i });
    await expect(retryButton).toBeVisible();

    // Verify no table
    const table = page.locator("table");
    await expect(table).not.toBeVisible();
  });

  test("Retry After Error", async ({ page }) => {
    let requestCount = 0;

    await page.route("**/api/leaderboard*", (route) => {
      requestCount++;
      if (requestCount === 1) {
        route.abort("failed");
      } else {
        // Return mock data on retry
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            users: Array.from({ length: 20 }, (_, i) => ({
              id: `user-${i + 1}`,
              username: `testuser${i + 1}`,
              display_name: `Player ${i + 1}`,
              avatar_url: null,
              country_code: "KR",
              current_level: 1,
              global_rank: i + 1,
              country_rank: i + 1,
              total_tokens: 1000000 - i * 10000,
              total_cost: 1000 - i * 10,
            })),
            pagination: { page: 1, limit: 20, total: 20, totalPages: 1 },
            period: "all",
          }),
        });
      }
    });

    await page.goto("/leaderboard");
    await page.waitForTimeout(1000);

    // Verify error state
    await expect(page.locator("text=⚠️")).toBeVisible({ timeout: 10000 });

    // Click retry
    const retryButton = page.getByRole("button", { name: /retry/i });
    await retryButton.click();

    // Verify data loads
    await expect(page.locator("table tbody tr")).toHaveCount(20, { timeout: 15000 });
    await expect(page.locator("text=⚠️")).not.toBeVisible();
  });

  test("Empty State Display", async ({ page }) => {
    await page.route("**/api/leaderboard*", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          users: [],
          pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
          period: "all",
        }),
      });
    });

    await page.goto("/leaderboard");
    await page.waitForTimeout(1000);

    // Verify empty state
    const emptyIcon = page.locator("text=📭");
    await expect(emptyIcon).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("No users found")).toBeVisible();
    await expect(page.getByText("Be the first to join the leaderboard!")).toBeVisible();
  });
});
