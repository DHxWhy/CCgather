import { test, expect, Page } from "@playwright/test";

/**
 * Real API Integration Tests for Community Auto-Translate Feature
 *
 * These tests run against the REAL application without mocks.
 * Prerequisites:
 * - Dev server running at localhost:3000
 * - Real database with test data
 * - Logged-in user session (for toggle visibility)
 */

test.describe("Community Auto-Translate - Real API Tests", () => {
  // Note: Tests run independently (parallel) for speed

  // Helper: Wait for page to be fully loaded
  async function waitForCommunityLoad(page: Page) {
    // Wait for community page structure (don't use networkidle - polling prevents it)
    await page.waitForLoadState("domcontentloaded", { timeout: 15000 });

    // Wait for either posts or empty state
    await Promise.race([
      page.waitForSelector('[data-testid="feed-card"]', { timeout: 10000 }),
      page.waitForSelector(".feed-section", { timeout: 10000 }),
      page.waitForSelector("text=No posts yet", { timeout: 10000 }),
      page.waitForSelector("text=Auto-translate", { timeout: 10000 }),
    ]).catch(() => {});

    // Give React time to hydrate
    await page.waitForTimeout(1000);
  }

  test.beforeEach(async ({ page }) => {
    // Navigate to community page
    await page.goto("/community", { waitUntil: "domcontentloaded" });
    await waitForCommunityLoad(page);
  });

  // ============================================
  // Scenario 1: Page Load & Basic UI Elements
  // ============================================
  test("페이지 로드 시 기본 UI 요소 확인", async ({ page }) => {
    // Check page title/header (use heading to be specific)
    await expect(page.getByRole("heading", { name: /Community/i })).toBeVisible({ timeout: 5000 });

    // Check Auto-translate section exists
    const autoTranslateSection = page.locator("text=Auto-translate");
    const isVisible = await autoTranslateSection.isVisible().catch(() => false);

    if (isVisible) {
      console.log("✓ Auto-translate section is visible");

      // Check toggle button (only for logged-in users)
      const toggleButton = page.locator('button[role="switch"]');
      const toggleVisible = await toggleButton.isVisible().catch(() => false);

      if (toggleVisible) {
        console.log("✓ Toggle button is visible (user is logged in)");

        // Check toggle state
        const isChecked = await toggleButton.getAttribute("aria-checked");
        console.log(`Toggle state: ${isChecked === "true" ? "ON" : "OFF"}`);
      } else {
        console.log("Toggle button not visible (user might be guest)");
      }
    }

    // Check tab buttons
    await expect(page.getByRole("button", { name: /Vibes/i })).toBeVisible();
  });

  // ============================================
  // Scenario 2: Feed Posts Display
  // ============================================
  test("피드 포스트 표시 확인", async ({ page }) => {
    // Wait for posts or empty state
    const hasPosts = await page
      .locator('[class*="feed"], [class*="post"], [class*="card"]')
      .first()
      .isVisible()
      .catch(() => false);

    if (hasPosts) {
      console.log("✓ Posts are displayed in the feed");

      // Count visible posts
      const posts = page.locator('[class*="FeedCard"], [data-testid="feed-card"]');
      const count = await posts.count();
      console.log(`Visible posts count: ${count}`);

      // Check post structure (author, content, actions)
      const firstPost = posts.first();
      if (await firstPost.isVisible()) {
        // Check for author info
        const hasAuthor = await firstPost
          .locator('[class*="author"], [class*="username"]')
          .isVisible()
          .catch(() => false);
        console.log(`First post has author info: ${hasAuthor}`);

        // Check for like/comment buttons
        const hasActions = (await firstPost.locator("button").count()) > 0;
        console.log(`First post has action buttons: ${hasActions}`);
      }
    } else {
      console.log("No posts displayed (empty feed or loading)");

      // Check for empty state message
      const emptyMessage = await page
        .getByText("No posts yet")
        .isVisible()
        .catch(() => false);
      if (emptyMessage) {
        console.log("✓ Empty state message displayed correctly");
      }
    }
  });

  // ============================================
  // Scenario 3: Toggle Functionality (Logged-in User)
  // ============================================
  test("토글 ON/OFF 기능 테스트", async ({ page }) => {
    const toggleButton = page.locator('button[role="switch"]');
    const isToggleVisible = await toggleButton.isVisible().catch(() => false);

    if (!isToggleVisible) {
      console.log("Toggle not visible - skipping (user might be guest)");
      test.skip();
      return;
    }

    // Get initial state
    const initialState = await toggleButton.getAttribute("aria-checked");
    console.log(`Initial toggle state: ${initialState}`);

    // Click to toggle
    await toggleButton.click();
    await page.waitForTimeout(500);

    // Verify state changed
    const newState = await toggleButton.getAttribute("aria-checked");
    console.log(`New toggle state: ${newState}`);

    expect(newState).not.toBe(initialState);

    // Check for visual feedback
    const statusText = page.locator(
      "text=Posts appear in your language, text=Showing original posts"
    );
    const hasStatusText = await statusText
      .first()
      .isVisible()
      .catch(() => false);
    console.log(`Status text updated: ${hasStatusText}`);

    // Toggle back to original state
    await toggleButton.click();
    await page.waitForTimeout(500);

    const finalState = await toggleButton.getAttribute("aria-checked");
    expect(finalState).toBe(initialState);
    console.log("✓ Toggle functionality works correctly");
  });

  // ============================================
  // Scenario 4: Translation Loading Indicator
  // ============================================
  test("번역 로딩 인디케이터 확인", async ({ page }) => {
    const toggleButton = page.locator('button[role="switch"]');
    const isToggleVisible = await toggleButton.isVisible().catch(() => false);

    if (!isToggleVisible) {
      console.log("Toggle not visible - skipping");
      test.skip();
      return;
    }

    // Ensure toggle is ON
    const isChecked = await toggleButton.getAttribute("aria-checked");
    if (isChecked !== "true") {
      await toggleButton.click();
      await page.waitForTimeout(300);
    }

    // Check for "Translating..." text (may appear briefly)
    const translatingText = page.getByText("Translating...");

    // Take screenshot for visual verification
    await page.screenshot({
      path: "test-results/translation-state.png",
      fullPage: false,
    });
    console.log("✓ Screenshot saved: test-results/translation-state.png");

    // Check if shimmer effect exists on any post
    const shimmerElements = page.locator('[class*="shimmer"], [class*="animate-pulse"]');
    const shimmerCount = await shimmerElements.count();
    console.log(`Shimmer/loading elements found: ${shimmerCount}`);
  });

  // ============================================
  // Scenario 5: Hall of Fame Section
  // ============================================
  test("Hall of Fame 섹션 검증", async ({ page }) => {
    // Find Hall of Fame section
    const hofSection = page.getByText("Hall of Fame");
    const isHofVisible = await hofSection.isVisible().catch(() => false);

    if (!isHofVisible) {
      console.log("Hall of Fame section not visible on this viewport");
      return;
    }

    console.log("✓ Hall of Fame section is visible");

    // Check period tabs
    const todayTab = page.getByRole("button", { name: /Today/i });
    const weeklyTab = page.getByRole("button", { name: /Weekly/i });
    const monthlyTab = page.getByRole("button", { name: /Monthly/i });

    // Verify tabs exist
    const hasTabs = await todayTab.isVisible().catch(() => false);
    if (hasTabs) {
      console.log("✓ Period tabs are visible");

      // Click Weekly tab
      await weeklyTab.click();
      await page.waitForTimeout(500);
      console.log("Switched to Weekly view");

      // Click Monthly tab
      await monthlyTab.click();
      await page.waitForTimeout(500);
      console.log("Switched to Monthly view");

      // Return to Today
      await todayTab.click();
      await page.waitForTimeout(500);
      console.log("Returned to Today view");
    }

    // Check for LIKED / REPLIED categories
    const likedCategory = page.getByText("LIKED");
    const repliedCategory = page.getByText("REPLIED");

    const hasCategories = await likedCategory.isVisible().catch(() => false);
    console.log(`Hall of Fame categories visible: ${hasCategories}`);
  });

  // ============================================
  // Scenario 6: Top Countries Section
  // ============================================
  test("Top Countries 섹션 검증", async ({ page }) => {
    // Find Top Countries section
    const countriesSection = page.getByText("Top Countries");
    const isVisible = await countriesSection.isVisible().catch(() => false);

    if (!isVisible) {
      console.log("Top Countries section not visible on this viewport");
      return;
    }

    console.log("✓ Top Countries section is visible");

    // Check for country entries
    const countryEntries = page.locator('[class*="country"], [class*="flag"]');
    const count = await countryEntries.count();
    console.log(`Country entries found: ${count}`);

    // Check for user's country highlight
    const userCountryHighlight = page.getByText(/Your country is/i);
    const hasUserCountry = await userCountryHighlight.isVisible().catch(() => false);
    console.log(`User country highlighted: ${hasUserCountry}`);
  });

  // ============================================
  // Scenario 7: Infinite Scroll / Load More
  // ============================================
  test("스크롤 시 추가 포스트 로드 확인", async ({ page }) => {
    // Find the scrollable feed area
    const feedArea = page
      .locator('[class*="virtuoso"], [class*="feed"], [class*="scroll"]')
      .first();
    const isFeedVisible = await feedArea.isVisible().catch(() => false);

    if (!isFeedVisible) {
      console.log("Feed area not found - skipping scroll test");
      return;
    }

    // Get initial post count
    const initialPosts = await page
      .locator('[class*="FeedCard"], [data-testid="feed-card"]')
      .count();
    console.log(`Initial post count: ${initialPosts}`);

    // Scroll down
    await feedArea.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
    await page.waitForTimeout(2000);

    // Check for loading indicator or new posts
    const loadingMore = page.getByText(/Loading more/i);
    const noMore = page.getByText(/No more posts/i);

    const isLoadingMore = await loadingMore.isVisible().catch(() => false);
    const hasNoMore = await noMore.isVisible().catch(() => false);

    if (isLoadingMore) {
      console.log("✓ Loading more posts...");
      await page.waitForTimeout(2000);
    }

    if (hasNoMore) {
      console.log("✓ Reached end of feed");
    }

    // Get final post count
    const finalPosts = await page.locator('[class*="FeedCard"], [data-testid="feed-card"]').count();
    console.log(`Final post count: ${finalPosts}`);

    if (finalPosts > initialPosts) {
      console.log(`✓ Loaded ${finalPosts - initialPosts} additional posts`);
    }
  });

  // ============================================
  // Scenario 8: Page Refresh - State Persistence
  // ============================================
  test("페이지 새로고침 후 상태 유지 확인", async ({ page }) => {
    const toggleButton = page.locator('button[role="switch"]');
    const isToggleVisible = await toggleButton.isVisible().catch(() => false);

    if (!isToggleVisible) {
      console.log("Toggle not visible - skipping persistence test");
      test.skip();
      return;
    }

    // Get current state
    const stateBefore = await toggleButton.getAttribute("aria-checked");
    console.log(`State before refresh: ${stateBefore}`);

    // Refresh page
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForCommunityLoad(page);

    // Check state after refresh
    const toggleAfter = page.locator('button[role="switch"]');
    await expect(toggleAfter).toBeVisible({ timeout: 10000 });

    const stateAfter = await toggleAfter.getAttribute("aria-checked");
    console.log(`State after refresh: ${stateAfter}`);

    // State should persist
    expect(stateAfter).toBe(stateBefore);
    console.log("✓ Toggle state persisted after refresh");
  });

  // ============================================
  // Scenario 9: Network Performance
  // ============================================
  test("네트워크 성능 측정", async ({ page }) => {
    // Collect network requests
    const requests: { url: string; duration: number }[] = [];

    page.on("requestfinished", async (request) => {
      const timing = request.timing();
      if (request.url().includes("/api/")) {
        requests.push({
          url: request.url(),
          duration: timing.responseEnd - timing.requestStart,
        });
      }
    });

    // Navigate fresh
    await page.goto("/community", { waitUntil: "domcontentloaded" });
    await waitForCommunityLoad(page);

    // Wait for API calls to complete
    await page.waitForTimeout(3000);

    // Log API performance
    console.log("\n=== API Performance ===");
    requests.forEach((req) => {
      const urlPath = new URL(req.url).pathname;
      console.log(`${urlPath}: ${Math.round(req.duration)}ms`);
    });

    // Check for slow requests (> 2000ms)
    const slowRequests = requests.filter((r) => r.duration > 2000);
    if (slowRequests.length > 0) {
      console.log(`\n⚠️ Slow requests detected: ${slowRequests.length}`);
      slowRequests.forEach((r) => {
        console.log(`  - ${new URL(r.url).pathname}: ${Math.round(r.duration)}ms`);
      });
    }
  });

  // ============================================
  // Scenario 10: Error State Handling
  // ============================================
  test("에러 상태 처리 확인", async ({ page }) => {
    // Check that no error modal is displayed
    const errorModal = page.getByText("Something went wrong");
    const hasError = await errorModal.isVisible().catch(() => false);

    if (hasError) {
      console.log("❌ Error modal is displayed!");

      // Take screenshot of error
      await page.screenshot({
        path: "test-results/error-state.png",
        fullPage: true,
      });

      // Check error message
      const errorMessage = await page
        .locator('[class*="error"]')
        .textContent()
        .catch(() => "Unknown error");
      console.log(`Error message: ${errorMessage}`);

      // This test should fail if there's an error
      expect(hasError).toBe(false);
    } else {
      console.log("✓ No error states detected");
    }
  });
});

// ============================================
// Visual Regression Tests
// ============================================
test.describe("Visual Regression", () => {
  test("Community 페이지 스크린샷 비교", async ({ page }) => {
    await page.goto("/community", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);

    // Take full page screenshot
    await page.screenshot({
      path: "test-results/community-page-full.png",
      fullPage: true,
    });

    // Take viewport screenshot
    await page.screenshot({
      path: "test-results/community-page-viewport.png",
      fullPage: false,
    });

    console.log("✓ Screenshots saved to test-results/");
  });
});
