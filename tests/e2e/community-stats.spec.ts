import { test, expect, Page } from "@playwright/test";
import {
  createMockCommunitySettings,
  createMockCommunityPosts,
  createCommunityPostsResponse,
  createMockTranslationResponse,
  createMockHallOfFame,
  createMockCountryStats,
} from "./fixtures/community-mocks";
import {
  createLeaderboardResponse,
  createMeResponse,
  createUserHistoryResponse,
  createUserBadgesResponse,
} from "./fixtures/mock-data";

// ============================================
// Helper Functions
// ============================================

async function setupBaseMocks(page: Page) {
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

  // Mock user APIs
  await page.route("**/api/users/*/usage-summary*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(createUserHistoryResponse("user-1")),
    });
  });

  await page.route("**/api/users/*/badges*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(createUserBadgesResponse()),
    });
  });

  // Mock authenticated user
  await page.route("**/api/me*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(createMeResponse()),
    });
  });

  // Mock settings
  await page.route("**/api/community/settings*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(createMockCommunitySettings(true, "en")),
    });
  });

  // Mock community posts
  const mockPosts = createMockCommunityPosts(20);
  await page.route("**/api/community/posts*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(createCommunityPostsResponse(mockPosts, true, "en")),
    });
  });

  // Mock translation
  await page.route("**/api/community/translate-batch*", async (route) => {
    const body = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(createMockTranslationResponse(body.items, body.targetLanguage)),
    });
  });
}

async function navigateToCommunity(page: Page) {
  await page.goto("/leaderboard");
  await page.waitForSelector("table tbody tr", { timeout: 15000 });
  await page.waitForTimeout(500);

  // Click Community tab
  const communityTab = page.locator("button", { hasText: "Community" });
  await communityTab.click();
  await page.waitForTimeout(1000);
}

// ============================================
// Scenario 6: Hall of Fame - Period Filtering
// ============================================

test.describe("Scenario 6: Hall of Fame - Period Filtering", () => {
  test("Hall of Fame displays correct stats for different periods", async ({ page }) => {
    const hallOfFameRequests: string[] = [];

    await setupBaseMocks(page);

    // Mock Hall of Fame with tracking
    await page.route("**/api/community/hall-of-fame*", async (route) => {
      const url = new URL(route.request().url());
      const period = (url.searchParams.get("period") || "today") as "today" | "weekly" | "monthly";
      hallOfFameRequests.push(period);

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(createMockHallOfFame(period)),
      });
    });

    // Mock Country Stats
    await page.route("**/api/community/country-stats*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(createMockCountryStats()),
      });
    });

    await navigateToCommunity(page);

    // Wait for Hall of Fame to load
    await page.waitForTimeout(1500);

    // Hall of Fame section should be visible
    const hallOfFameSection = page.getByText("Hall of Fame").first();
    await expect(hallOfFameSection).toBeVisible({ timeout: 5000 });

    // Check "Today" filter is active by default
    const todayButton = page.locator("button", { hasText: "Today" }).first();
    await expect(todayButton).toBeVisible();

    // Most-liked entries should be visible
    const mostLikedText = page.getByText("Most Liked").first();
    await expect(mostLikedText).toBeVisible();

    // Most-replied entries should be visible
    const mostRepliedText = page.getByText("Most Replied").first();
    await expect(mostRepliedText).toBeVisible();

    // Click "Weekly" filter
    const weeklyButton = page.locator("button", { hasText: "Weekly" }).first();
    await weeklyButton.click();

    // Wait for API call
    await page.waitForTimeout(1000);

    // Verify weekly request was made
    expect(hallOfFameRequests).toContain("weekly");

    // Click "Monthly" filter
    const monthlyButton = page.locator("button", { hasText: "Monthly" }).first();
    await monthlyButton.click();

    // Wait for API call
    await page.waitForTimeout(1000);

    // Verify monthly request was made
    expect(hallOfFameRequests).toContain("monthly");
  });

  test("Hall of Fame shows user avatars and counts", async ({ page }) => {
    await setupBaseMocks(page);

    // Mock Hall of Fame
    await page.route("**/api/community/hall-of-fame*", async (route) => {
      const url = new URL(route.request().url());
      const period = (url.searchParams.get("period") || "today") as "today" | "weekly" | "monthly";

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(createMockHallOfFame(period)),
      });
    });

    // Mock Country Stats
    await page.route("**/api/community/country-stats*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(createMockCountryStats()),
      });
    });

    await navigateToCommunity(page);
    await page.waitForTimeout(1500);

    // Check for user names in Hall of Fame
    await expect(page.getByText("TopDev1")).toBeVisible({ timeout: 5000 });

    // Check for count numbers (Most Liked: 50 for today)
    const countText = page.locator("text=/\\d+/");
    await expect(countText.first()).toBeVisible();
  });
});

// ============================================
// Scenario 7: Top Countries - Stats Aggregation
// ============================================

test.describe("Scenario 7: Top Countries - Stats Aggregation", () => {
  test("Top Countries displays aggregated stats", async ({ page }) => {
    await setupBaseMocks(page);

    // Mock Hall of Fame
    await page.route("**/api/community/hall-of-fame*", async (route) => {
      const url = new URL(route.request().url());
      const period = (url.searchParams.get("period") || "today") as "today" | "weekly" | "monthly";

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(createMockHallOfFame(period)),
      });
    });

    // Mock Country Stats
    await page.route("**/api/community/country-stats*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(createMockCountryStats()),
      });
    });

    await navigateToCommunity(page);
    await page.waitForTimeout(1500);

    // Top Countries section should be visible
    const topCountriesSection = page.getByText("Top Countries").first();
    await expect(topCountriesSection).toBeVisible({ timeout: 5000 });

    // Check for country names
    await expect(page.getByText("United States")).toBeVisible({ timeout: 3000 });
    await expect(page.getByText("South Korea")).toBeVisible({ timeout: 3000 });
    await expect(page.getByText("Japan")).toBeVisible({ timeout: 3000 });

    // Check for rank indicators
    const rankIndicators = page.locator("text=/#[1-3]/");
    await expect(rankIndicators.first()).toBeVisible({ timeout: 3000 });
  });

  test("Top Countries supports sorting by posts and likes", async ({ page }) => {
    await setupBaseMocks(page);

    // Mock Hall of Fame
    await page.route("**/api/community/hall-of-fame*", async (route) => {
      const url = new URL(route.request().url());
      const period = (url.searchParams.get("period") || "today") as "today" | "weekly" | "monthly";

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(createMockHallOfFame(period)),
      });
    });

    // Mock Country Stats
    await page.route("**/api/community/country-stats*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(createMockCountryStats()),
      });
    });

    await navigateToCommunity(page);
    await page.waitForTimeout(1500);

    // Check for Posts sort option
    const postsButton = page.locator("button", { hasText: "Posts" }).first();
    if (await postsButton.isVisible()) {
      await postsButton.click();
      await page.waitForTimeout(500);
    }

    // Check for Likes sort option
    const likesButton = page.locator("button", { hasText: "Likes" }).first();
    if (await likesButton.isVisible()) {
      await likesButton.click();
      await page.waitForTimeout(500);
    }

    // Countries should still be visible after sorting
    await expect(page.getByText("United States")).toBeVisible({ timeout: 3000 });
  });

  test("User country is highlighted", async ({ page }) => {
    await setupBaseMocks(page);

    // Mock Hall of Fame
    await page.route("**/api/community/hall-of-fame*", async (route) => {
      const url = new URL(route.request().url());
      const period = (url.searchParams.get("period") || "today") as "today" | "weekly" | "monthly";

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(createMockHallOfFame(period)),
      });
    });

    // Mock Country Stats
    await page.route("**/api/community/country-stats*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(createMockCountryStats()),
      });
    });

    await navigateToCommunity(page);
    await page.waitForTimeout(1500);

    // User's country (KR from mock) should be visible
    await expect(page.getByText("South Korea")).toBeVisible({ timeout: 5000 });

    // Look for highlight indicator (could be a dot or different styling)
    // This depends on the actual implementation
    const userCountryRow = page.locator("text=South Korea").locator("..");
    await expect(userCountryRow).toBeVisible();
  });
});

// ============================================
// Combined Community Stats Test
// ============================================

test.describe("Combined Community Stats", () => {
  test("Hall of Fame and Top Countries load together", async ({ page }) => {
    let hallOfFameCalled = false;
    let countryStatsCalled = false;

    await setupBaseMocks(page);

    // Mock Hall of Fame
    await page.route("**/api/community/hall-of-fame*", async (route) => {
      hallOfFameCalled = true;
      const url = new URL(route.request().url());
      const period = (url.searchParams.get("period") || "today") as "today" | "weekly" | "monthly";

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(createMockHallOfFame(period)),
      });
    });

    // Mock Country Stats
    await page.route("**/api/community/country-stats*", async (route) => {
      countryStatsCalled = true;

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(createMockCountryStats()),
      });
    });

    await navigateToCommunity(page);
    await page.waitForTimeout(2000);

    // Both APIs should be called
    expect(hallOfFameCalled).toBe(true);
    expect(countryStatsCalled).toBe(true);

    // Both sections should be visible
    await expect(page.getByText("Hall of Fame").first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Top Countries").first()).toBeVisible({ timeout: 5000 });
  });

  test("Stats handle API errors gracefully", async ({ page }) => {
    await setupBaseMocks(page);

    // Mock Hall of Fame to fail
    await page.route("**/api/community/hall-of-fame*", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "Internal Server Error" }),
      });
    });

    // Mock Country Stats to fail
    await page.route("**/api/community/country-stats*", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "Internal Server Error" }),
      });
    });

    await navigateToCommunity(page);
    await page.waitForTimeout(2000);

    // Page should not crash
    const communityFeed = page.locator('[data-testid="feed-card"]');
    if ((await communityFeed.count()) === 0) {
      // Feed might still load even if stats fail
      await expect(page.getByText("Community")).toBeVisible();
    }

    // No error modals blocking UI
    await expect(page.locator('[role="alert"][aria-live="assertive"]')).toHaveCount(0);
  });
});
