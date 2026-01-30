// Real API Test - No mocking, tests actual database state
// Currently database is empty, so we test empty state handling

import { test, expect } from "@playwright/test";

test.describe("Real API Tests (No Mocking)", () => {
  test("Empty database shows empty state correctly", async ({ page }) => {
    await page.goto("/leaderboard");

    // Wait for API call to complete
    await page.waitForTimeout(2000);

    // With empty database, should show empty state
    const emptyIcon = page.locator("text=📭");
    await expect(emptyIcon).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("No users found")).toBeVisible();
    await expect(page.getByText("Be the first to join the leaderboard!")).toBeVisible();
  });

  test("Filter controls still work with empty data", async ({ page }) => {
    await page.goto("/leaderboard");
    await page.waitForTimeout(2000);

    // Filter groups should still be visible
    const filterGroups = page.locator(".flex.p-1.rounded-lg");
    await expect(filterGroups.first()).toBeVisible();

    // Clicking filters should not cause errors
    const scopeFilterGroup = page.locator(".flex.p-1.rounded-lg").first();
    const countryButton = scopeFilterGroup.locator("button").nth(1);
    await countryButton.click();
    await page.waitForTimeout(500);

    // Title should change even with empty data
    await expect(page.locator("h1")).toContainText("Country Leaderboard");
  });

  test("API endpoint returns valid JSON structure", async ({ page }) => {
    const response = await page.request.get("/api/leaderboard?limit=5");
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data).toHaveProperty("users");
    expect(data).toHaveProperty("pagination");
    expect(data).toHaveProperty("period");
    expect(Array.isArray(data.users)).toBeTruthy();
    expect(data.pagination).toHaveProperty("page");
    expect(data.pagination).toHaveProperty("limit");
    expect(data.pagination).toHaveProperty("total");
    expect(data.pagination).toHaveProperty("totalPages");
  });

  test("Different filter parameters return valid responses", async ({ page }) => {
    // Test various filter combinations
    const endpoints = [
      "/api/leaderboard?scope=global&period=all",
      "/api/leaderboard?scope=country&period=all",
      "/api/leaderboard?scope=global&period=7d",
      "/api/leaderboard?scope=global&period=30d",
      "/api/leaderboard?scope=global&sort=cost",
      "/api/leaderboard?scope=global&sort=tokens",
    ];

    for (const endpoint of endpoints) {
      const response = await page.request.get(endpoint);
      expect(response.ok()).toBeTruthy();
      const data = await response.json();
      expect(data).toHaveProperty("users");
      expect(data).toHaveProperty("pagination");
    }
  });
});
