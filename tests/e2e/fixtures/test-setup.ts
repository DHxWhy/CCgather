// Common test setup with API mocking

import { test as base, expect, Page } from "@playwright/test";
import {
  createLeaderboardResponse,
  createUserHistoryResponse,
  createUserBadgesResponse,
  createMeResponse,
} from "./mock-data";

// Extended test with automatic API mocking
export const test = base.extend<{ mockAPIs: void }>({
  mockAPIs: [
    async ({ page }, use) => {
      // Mock leaderboard API
      await page.route("**/api/leaderboard*", async (route) => {
        const url = new URL(route.request().url());
        const pageNum = parseInt(url.searchParams.get("page") || "1");
        const limit = parseInt(url.searchParams.get("limit") || "20");
        const period = url.searchParams.get("period") || "all";

        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(createLeaderboardResponse(pageNum, limit, period)),
        });
      });

      // Mock usage-summary API (centralized data source)
      await page.route("**/api/users/*/usage-summary*", async (route) => {
        const urlParts = route.request().url().split("/");
        const userIdIndex = urlParts.findIndex((p) => p === "users") + 1;
        const userId = urlParts[userIdIndex] || "user-1";

        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(createUserHistoryResponse(userId)),
        });
      });

      // Keep old history API mock for backwards compatibility
      await page.route("**/api/users/*/history*", async (route) => {
        const urlParts = route.request().url().split("/");
        const userIdIndex = urlParts.findIndex((p) => p === "users") + 1;
        const userId = urlParts[userIdIndex] || "user-1";

        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(createUserHistoryResponse(userId)),
        });
      });

      // Mock user badges API
      await page.route("**/api/users/*/badges*", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(createUserBadgesResponse()),
        });
      });

      // Mock /api/me
      await page.route("**/api/me*", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(createMeResponse()),
        });
      });

      await use();
    },
    { auto: true },
  ],
});

export { expect };

// Helper to wait for leaderboard to load
export async function waitForLeaderboardLoad(page: Page) {
  await page.waitForSelector("table tbody tr", { timeout: 15000 });
  await page.waitForTimeout(500);
}
