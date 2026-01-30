// spec: tests/e2e/leaderboard.plan.md
// Group E: Profile Panel Content

import { test, expect } from "./fixtures/test-setup";

test.describe("Profile Panel Content", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/leaderboard");
    // Wait for table with slightly longer timeout for mobile
    await page.waitForSelector("table tbody tr", { timeout: 20000 });
    await expect(page.locator("table tbody tr").first()).toBeVisible();

    // Open panel for first user
    await page.locator("table tbody tr").first().click();
    await page.waitForTimeout(600); // Slightly longer for mobile animations
    await expect(page.getByText("Profile Details")).toBeVisible({ timeout: 5000 });
  });

  test("User Header Information", async ({ page }) => {
    // Scope to the panel
    const panel = page
      .locator('[class*="fixed"][class*="right-0"]')
      .filter({ hasText: "Profile Details" });

    // Verify "Profile Details" label
    await expect(page.getByText("Profile Details")).toBeVisible();

    // Verify avatar displays (img or gradient div with letter inside panel)
    const avatarImg = panel.locator('img[class*="rounded-full"]');
    const avatarDiv = panel.locator('div[class*="rounded-full"][class*="bg-gradient"]');
    const hasAvatar = (await avatarImg.count()) > 0 || (await avatarDiv.count()) > 0;
    expect(hasAvatar).toBeTruthy();

    // Verify username/display_name
    const userName = panel.locator("h2").first();
    await expect(userName).toBeVisible();

    // Verify level badge
    const levelBadge = panel
      .locator("span")
      .filter({ hasText: /Lv\.\d+/ })
      .first();
    await expect(levelBadge).toBeVisible();

    // Verify @username
    const atUsername = panel.locator("p").filter({ hasText: "@" });
    await expect(atUsername).toBeVisible();
  });

  test("Level Progress Bar", async ({ page }) => {
    // Scope to the panel
    const panel = page
      .locator('[class*="fixed"][class*="right-0"]')
      .filter({ hasText: "Profile Details" });

    // Verify progress bar section (look for "Current Range:" text)
    const progressSection = panel
      .locator("div")
      .filter({ hasText: /Current Range:/ })
      .first();
    await expect(progressSection).toBeVisible();

    // Wait for animation
    await page.waitForTimeout(1600);

    // Verify progress bar exists (the bg-claude-coral bar inside the progress container)
    const progressContainer = panel.locator(".h-2\\.5.bg-white\\/10");
    await expect(progressContainer).toBeVisible();
  });

  test("Stats Grid Display", async ({ page }) => {
    // Verify Global Rank
    await expect(page.getByText("🌍 Global Rank")).toBeVisible();

    // Verify Country Rank
    await expect(page.getByText("Country Rank")).toBeVisible();

    // Verify Cost
    await expect(
      page
        .locator("div")
        .filter({ hasText: /Cost \$/ })
        .first()
    ).toBeVisible();

    // Verify Tokens
    await expect(
      page
        .locator("div")
        .filter({ hasText: /Tokens/ })
        .first()
    ).toBeVisible();
  });

  test("Usage History Chart", async ({ page }) => {
    // Verify chart section header
    await expect(page.getByText("📈 Usage History")).toBeVisible();

    // Wait for chart to load
    await page.waitForTimeout(1000);

    // Chart or loading/no-data message should be visible
    const chart = page.locator("svg.recharts-surface");
    const noData = page.getByText("No usage data available");
    const loading = page.locator(".animate-spin");

    const chartVisible = (await chart.count()) > 0;
    const noDataVisible = await noData.isVisible().catch(() => false);
    const loadingVisible = (await loading.count()) > 0;

    expect(chartVisible || noDataVisible || loadingVisible).toBeTruthy();
  });

  test("Activity Heatmap", async ({ page }) => {
    // Scroll to heatmap
    await page.getByText("📅 Activity (Last Year)").scrollIntoViewIfNeeded();

    // Verify heatmap section
    await expect(page.getByText("📅 Activity (Last Year)")).toBeVisible();
  });

  test("Badge Grid Display", async ({ page }) => {
    // Scroll to badges
    await page.getByText("🏅 Badges").scrollIntoViewIfNeeded();

    // Verify badge header with count
    const badgeHeader = page
      .locator("div")
      .filter({ hasText: /🏅 Badges \(\d+\/\d+\)/ })
      .first();
    await expect(badgeHeader).toBeVisible();

    // Verify category icons
    const categories = ["🔥", "💎", "🏆", "🎭", "🤝"];
    for (const category of categories) {
      await expect(page.getByText(category).first()).toBeVisible();
    }
  });

  test("User Transition Animation", async ({ page }) => {
    // Get first user's name from the panel
    const panel = page
      .locator('[class*="fixed"][class*="right-0"]')
      .filter({ hasText: "Profile Details" });
    const firstUserName = await panel.locator("h2").first().textContent();

    // Close the panel first on mobile to access the table
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);

    // Click second user
    await page.locator("table tbody tr").nth(1).click();
    await page.waitForTimeout(600);

    // Get second user's name from the panel
    await expect(page.getByText("Profile Details")).toBeVisible({ timeout: 5000 });
    const secondPanel = page
      .locator('[class*="fixed"][class*="right-0"]')
      .filter({ hasText: "Profile Details" });
    const secondUserName = await secondPanel.locator("h2").first().textContent();

    // Names should be different
    expect(secondUserName).not.toBe(firstUserName);
  });
});
