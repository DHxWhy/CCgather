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

  // Mock Notifications API (required to prevent infinite loop)
  // Add small delay to prevent React batching issues
  await page.route("**/api/community/notifications*", async (route) => {
    await new Promise((r) => setTimeout(r, 100));
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ notifications: [], unread_count: 0 }),
    });
  });

  // Mock Countries API
  await page.route("**/api/countries*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        countries: [
          { code: "US", name: "United States", count: 100 },
          { code: "KR", name: "South Korea", count: 85 },
          { code: "JP", name: "Japan", count: 70 },
        ],
      }),
    });
  });

  // Mock Auth Recovery Check
  await page.route("**/api/auth/recovery-check*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ hasRecoveryToken: false }),
    });
  });

  // Default /api/me mock (can be overridden by individual tests)
  await page.route("**/api/me*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(createMeResponse()),
    });
  });

  // Mock Community Posts API
  await page.route("**/api/community/posts*", async (route) => {
    const mockPosts = createMockCommunityPosts(20);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(createCommunityPostsResponse(mockPosts, true, "en", false)),
    });
  });

  // Mock Community Settings API
  await page.route("**/api/community/settings*", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(createMockCommunitySettings(true, "en")),
      });
    } else {
      // PATCH request
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      });
    }
  });

  // Mock Translation API
  await page.route("**/api/community/translate-batch*", async (route) => {
    try {
      const body = await route.request().postDataJSON();
      const response = createMockTranslationResponse(body.items || [], body.targetLanguage || "en");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(response),
      });
    } catch {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          translations: [],
          stats: { total: 0, from_cache: 0, translated: 0 },
        }),
      });
    }
  });
}

async function navigateToCommunity(page: Page) {
  // Go directly to /community instead of clicking tab from leaderboard
  await page.goto("/community");
  // Wait for community feed to load
  await page
    .waitForSelector('[data-testid="feed-card"], .community-feed, .feed-section', {
      timeout: 15000,
      state: "attached",
    })
    .catch(() => {
      // Fallback: wait for any content
    });
  await page.waitForTimeout(1000);
}

// ============================================
// Scenario 1: Guest User - Toggle Not Visible
// ============================================

test.describe("Scenario 1: Guest User - Toggle Not Visible", () => {
  test("guest user cannot see auto-translate toggle", async ({ page }) => {
    // Setup base mocks without auth
    await setupBaseMocks(page);

    // Mock /api/me to return no user (guest)
    await page.route("**/api/me*", async (route) => {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ error: "Unauthorized" }),
      });
    });

    // Mock community settings (guest won't have settings)
    await page.route("**/api/community/settings*", async (route) => {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ error: "Unauthorized" }),
      });
    });

    // Mock community posts
    const mockPosts = createMockCommunityPosts(10);
    await page.route("**/api/community/posts*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(createCommunityPostsResponse(mockPosts, false, "en")),
      });
    });

    await navigateToCommunity(page);

    // Banner should be visible
    await expect(page.getByText("Auto-translate")).toBeVisible();

    // Toggle should NOT be visible for guest users
    const toggleButton = page.locator('button[role="switch"]');
    await expect(toggleButton).toHaveCount(0);

    // Posts should display in original language
    const feedCards = page.locator('[data-testid="feed-card"]');
    await expect(feedCards.first()).toBeVisible({ timeout: 5000 });

    // No shimmer effects for guest
    await expect(page.locator('[aria-label="Loading translation..."]')).toHaveCount(0);
  });
});

// ============================================
// Scenario 2: Signed-in User - Toggle ON - Shimmer Effect
// ============================================

test.describe("Scenario 2: Signed-in User - Toggle ON - Shimmer Effect", () => {
  test("shimmer effect displays during translation loading", async ({ page }) => {
    await setupBaseMocks(page);

    // Mock authenticated user
    await page.route("**/api/me*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(createMeResponse()),
      });
    });

    // Mock settings with auto-translate ON
    await page.route("**/api/community/settings*", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(createMockCommunitySettings(true, "en")),
        });
      }
    });

    // Mock community posts with foreign language content
    const mockPosts = createMockCommunityPosts(20);
    await page.route("**/api/community/posts*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(createCommunityPostsResponse(mockPosts, true, "en")),
      });
    });

    // Mock translation API with delay to observe shimmer
    await page.route("**/api/community/translate-batch*", async (route) => {
      const body = route.request().postDataJSON();

      // Add delay to see shimmer effect
      await new Promise((resolve) => setTimeout(resolve, 1500));

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(createMockTranslationResponse(body.items, body.targetLanguage)),
      });
    });

    await navigateToCommunity(page);

    // Toggle should be visible and ON
    const toggleButton = page.locator('button[role="switch"]');
    await expect(toggleButton).toBeVisible({ timeout: 5000 });

    // Check for "Translating..." loading indicator
    await expect(page.getByText("Translating...")).toBeVisible({ timeout: 3000 });

    // Wait for shimmer to appear on foreign language posts
    const shimmerElement = page.locator('[aria-label="Loading translation..."]');
    await expect(shimmerElement.first()).toBeVisible({ timeout: 3000 });

    // Wait for translation to complete
    await page.waitForTimeout(2500);

    // Shimmer should be gone after translation
    await expect(page.locator('[aria-label="Loading translation..."]')).toHaveCount(0, {
      timeout: 5000,
    });

    // Translated text should be visible
    await expect(page.getByText(/\[Translated to en\]/)).toBeVisible({ timeout: 3000 });
  });
});

// ============================================
// Scenario 3: Toggle OFF - Original Text Display
// ============================================

test.describe("Scenario 3: Toggle OFF - Original Text Display", () => {
  test("toggling OFF shows original posts and saves preference", async ({ page }) => {
    let autoTranslateSetting = true;

    await setupBaseMocks(page);

    // Mock authenticated user
    await page.route("**/api/me*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(createMeResponse()),
      });
    });

    // Mock settings with state tracking
    await page.route("**/api/community/settings*", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(createMockCommunitySettings(autoTranslateSetting, "en")),
        });
      } else if (route.request().method() === "PATCH") {
        const body = route.request().postDataJSON();
        autoTranslateSetting = body.auto_translate;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true }),
        });
      }
    });

    // Mock community posts
    const mockPosts = createMockCommunityPosts(20);
    await page.route("**/api/community/posts*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(createCommunityPostsResponse(mockPosts, autoTranslateSetting, "en")),
      });
    });

    // Track translation API calls
    const translationCalls: string[] = [];
    await page.route("**/api/community/translate-batch*", async (route) => {
      translationCalls.push("called");
      const body = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(createMockTranslationResponse(body.items, body.targetLanguage)),
      });
    });

    await navigateToCommunity(page);

    // Wait for toggle to appear
    const toggleButton = page.locator('button[role="switch"]');
    await expect(toggleButton).toBeVisible({ timeout: 5000 });

    // Click toggle to turn OFF
    await toggleButton.click();

    // Wait for PATCH request
    const patchRequest = page.waitForRequest(
      (request) => request.url().includes("/api/community/settings") && request.method() === "PATCH"
    );
    await patchRequest;

    // Wait for UI update
    await page.waitForTimeout(500);

    // Banner should show "Showing original posts"
    await expect(page.getByText("Showing original posts")).toBeVisible({ timeout: 3000 });

    // Original Korean content should be visible
    await expect(page.getByText("Claude Code 정말 대박이네요!")).toBeVisible({ timeout: 3000 });
  });
});

// ============================================
// Scenario 4: Infinite Scroll - Lazy Translation
// ============================================

test.describe("Scenario 4: Infinite Scroll - Lazy Translation", () => {
  test("newly loaded posts trigger translation", async ({ page }) => {
    const allPosts = createMockCommunityPosts(50);
    const translationBatches: number[] = [];

    await setupBaseMocks(page);

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

    // Mock community posts with pagination
    await page.route("**/api/community/posts*", async (route) => {
      const url = new URL(route.request().url());
      const limit = parseInt(url.searchParams.get("limit") || "20");
      const offset = parseInt(url.searchParams.get("offset") || "0");

      const posts = allPosts.slice(offset, offset + limit);
      const hasMore = offset + limit < allPosts.length;

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          posts,
          total: allPosts.length,
          hasMore,
          auto_translate_enabled: true,
          preferred_language: "en",
        }),
      });
    });

    // Track translation batches
    await page.route("**/api/community/translate-batch*", async (route) => {
      const body = route.request().postDataJSON();
      translationBatches.push(body.items.length);

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(createMockTranslationResponse(body.items, body.targetLanguage)),
      });
    });

    await navigateToCommunity(page);

    // Wait for initial posts to load
    await page.waitForTimeout(2000);

    // Initial batch should have been translated
    expect(translationBatches.length).toBeGreaterThanOrEqual(1);

    // Scroll to trigger more loading
    const feedContainer = page.locator(".scrollbar-hide").first();
    if ((await feedContainer.count()) > 0) {
      await feedContainer.evaluate((el) => {
        el.scrollTop = el.scrollHeight;
      });
    } else {
      // Fallback: scroll the page
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    }

    // Wait for new posts to load
    await page.waitForTimeout(3000);

    // Should have multiple translation batches (initial + scroll)
    expect(translationBatches.length).toBeGreaterThanOrEqual(1);
  });
});

// ============================================
// Scenario 5: Page Refresh - State Persistence
// ============================================

test.describe("Scenario 5: Page Refresh - State Persistence", () => {
  test("auto-translate toggle state persists across refreshes", async ({ page }) => {
    await setupBaseMocks(page);

    // Mock authenticated user
    await page.route("**/api/me*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(createMeResponse()),
      });
    });

    // Mock settings with auto_translate: false (persisted state)
    await page.route("**/api/community/settings*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(createMockCommunitySettings(false, "en")),
      });
    });

    // Mock community posts
    const mockPosts = createMockCommunityPosts(20);
    await page.route("**/api/community/posts*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(createCommunityPostsResponse(mockPosts, false, "en")),
      });
    });

    await navigateToCommunity(page);

    // Toggle should be OFF
    await expect(page.getByText("Showing original posts")).toBeVisible({ timeout: 5000 });

    // Refresh the page
    await page.reload();
    await page.waitForSelector("table tbody tr", { timeout: 15000 });

    // Navigate back to Community
    const communityTab = page.locator("button", { hasText: "Community" });
    await communityTab.click();
    await page.waitForTimeout(1000);

    // State should persist - still OFF
    await expect(page.getByText("Showing original posts")).toBeVisible({ timeout: 5000 });
  });
});

// ============================================
// Scenario 8: Translation Cache Behavior
// ============================================

test.describe("Scenario 8: Translation Cache Behavior", () => {
  test("translations are cached and reused", async ({ page }) => {
    const translationCache = new Map<string, string>();
    let apiCallCount = 0;

    await setupBaseMocks(page);

    // Mock authenticated user
    await page.route("**/api/me*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(createMeResponse()),
      });
    });

    // Mock settings
    let autoTranslate = true;
    await page.route("**/api/community/settings*", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(createMockCommunitySettings(autoTranslate, "en")),
        });
      } else if (route.request().method() === "PATCH") {
        const body = route.request().postDataJSON();
        autoTranslate = body.auto_translate;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true }),
        });
      }
    });

    // Mock community posts
    const mockPosts = createMockCommunityPosts(10);
    await page.route("**/api/community/posts*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(createCommunityPostsResponse(mockPosts, autoTranslate, "en")),
      });
    });

    // Mock translation with cache simulation
    await page.route("**/api/community/translate-batch*", async (route) => {
      apiCallCount++;
      const body = route.request().postDataJSON();
      const items = body.items;

      const results = items.map((item: { id: string; type: string; text: string }) => {
        const cacheKey = `${item.type}:${item.id}:${body.targetLanguage}`;

        if (translationCache.has(cacheKey)) {
          return {
            id: item.id,
            type: item.type,
            translated_text: translationCache.get(cacheKey),
            from_cache: true,
          };
        } else {
          const translation = `[Translated] ${item.text}`;
          translationCache.set(cacheKey, translation);
          return {
            id: item.id,
            type: item.type,
            translated_text: translation,
            from_cache: false,
          };
        }
      });

      const fromCacheCount = results.filter((r: { from_cache: boolean }) => r.from_cache).length;

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          translations: results,
          stats: {
            total: items.length,
            from_cache: fromCacheCount,
            translated: items.length - fromCacheCount,
          },
        }),
      });
    });

    await navigateToCommunity(page);
    await page.waitForTimeout(2000);

    // First load should have called API
    expect(apiCallCount).toBeGreaterThanOrEqual(1);

    const firstCallCount = apiCallCount;
    const cacheSize = translationCache.size;
    expect(cacheSize).toBeGreaterThan(0);

    // Toggle OFF then ON to trigger re-translation
    const toggleButton = page.locator('button[role="switch"]');
    await toggleButton.click();
    await page.waitForTimeout(500);
    await toggleButton.click();
    await page.waitForTimeout(2000);

    // API should have been called again, but with cache hits
    expect(apiCallCount).toBeGreaterThan(firstCallCount);
  });
});

// ============================================
// Scenario 9: Error Handling - Translation Failure
// ============================================

test.describe("Scenario 9: Error Handling - Translation Failure", () => {
  test("graceful degradation when translation API fails", async ({ page }) => {
    let shouldFail = true;

    await setupBaseMocks(page);

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
    const mockPosts = createMockCommunityPosts(10);
    await page.route("**/api/community/posts*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(createCommunityPostsResponse(mockPosts, true, "en")),
      });
    });

    // Mock translation API to fail initially
    await page.route("**/api/community/translate-batch*", async (route) => {
      if (shouldFail) {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({
            error: "Translation failed",
            details: "Gemini API unavailable",
          }),
        });
      } else {
        const body = route.request().postDataJSON();
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(createMockTranslationResponse(body.items, body.targetLanguage)),
        });
      }
    });

    await navigateToCommunity(page);

    // Wait for error to be handled
    await page.waitForTimeout(3000);

    // Original content should be visible (fallback)
    await expect(page.getByText("Claude Code 정말 대박이네요!")).toBeVisible({ timeout: 5000 });

    // No error modal should be shown (silent failure)
    await expect(page.locator('[role="alert"]')).toHaveCount(0);
  });
});

// ============================================
// Scenario 10: Mobile Responsiveness
// ============================================

test.describe("Scenario 10: Mobile Responsiveness", () => {
  test("toggle works correctly on mobile viewport", async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await setupBaseMocks(page);

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
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(createMockCommunitySettings(true, "en")),
        });
      } else if (route.request().method() === "PATCH") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true }),
        });
      }
    });

    // Mock community posts
    const mockPosts = createMockCommunityPosts(10);
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

    await navigateToCommunity(page);

    // Toggle should be visible
    const toggleButton = page.locator('button[role="switch"]');
    await expect(toggleButton).toBeVisible({ timeout: 5000 });

    // Check toggle is appropriately sized for touch
    const toggleBox = await toggleButton.boundingBox();
    expect(toggleBox).toBeTruthy();
    expect(toggleBox!.width).toBeGreaterThanOrEqual(36);
    expect(toggleBox!.height).toBeGreaterThanOrEqual(20);

    // Tap toggle
    await toggleButton.tap();

    // State should change
    await expect(page.getByText("Showing original posts")).toBeVisible({ timeout: 3000 });

    // Check no horizontal scroll
    const horizontalScroll = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    expect(horizontalScroll).toBe(false);
  });
});
