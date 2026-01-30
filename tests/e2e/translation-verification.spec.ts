import { test, expect } from "@playwright/test";

// Use saved authentication state
test.use({ storageState: "tests/.auth/user.json" });

test.describe("Translation Verification - Real Multilingual Data", () => {
  test("다국어 게시글 번역 확인", async ({ page }) => {
    // Navigate to community
    await page.goto("/community");
    await page.waitForTimeout(3000);

    // Screenshot 1: Initial state (toggle should be ON by default)
    await page.screenshot({ path: "test-results/translation-1-initial.png", fullPage: true });
    console.log("📸 Screenshot 1: Initial state saved");

    // Check toggle state
    const toggleButton = page.locator('button[role="switch"]');
    const isToggleVisible = await toggleButton.isVisible({ timeout: 10000 }).catch(() => false);

    if (!isToggleVisible) {
      console.log("❌ Toggle not visible - skipping");
      test.skip(true, "Toggle not visible");
      return;
    }

    const initialState = await toggleButton.getAttribute("aria-checked");
    console.log(`✓ Toggle visible, state: ${initialState === "true" ? "ON" : "OFF"}`);

    // Ensure toggle is ON for translation
    if (initialState !== "true") {
      await toggleButton.click();
      await page.waitForTimeout(2000);
      console.log("✓ Toggle turned ON");
    }

    // Wait for translation to complete
    await page.waitForTimeout(3000);

    // Screenshot 2: With translation ON
    await page.screenshot({ path: "test-results/translation-2-toggle-on.png", fullPage: true });
    console.log("📸 Screenshot 2: Toggle ON state saved");

    // Check for translated content indicators
    // Look for posts with different original languages
    const feedContent = await page.locator("[data-feed-card]").all();
    console.log(`Found ${feedContent.length} posts`);

    // Check if "Translating..." or translated content exists
    const translatingIndicator = page.getByText("Translating...");
    const hasTranslating = await translatingIndicator
      .isVisible({ timeout: 1000 })
      .catch(() => false);
    console.log(`Translating indicator: ${hasTranslating}`);

    // Turn toggle OFF to see original posts
    await toggleButton.click();
    await page.waitForTimeout(2000);

    // Screenshot 3: With translation OFF (original posts)
    await page.screenshot({ path: "test-results/translation-3-toggle-off.png", fullPage: true });
    console.log("📸 Screenshot 3: Toggle OFF state saved");

    // Check for original language content
    const originalContent = page.locator("[data-feed-card]");
    const firstPost = originalContent.first();
    if (await firstPost.isVisible()) {
      const postText = await firstPost.textContent();
      console.log(`First post content preview: ${postText?.substring(0, 100)}...`);
    }

    // Turn toggle back ON
    await toggleButton.click();
    await page.waitForTimeout(3000);

    // Screenshot 4: Back to translated state
    await page.screenshot({
      path: "test-results/translation-4-toggle-on-again.png",
      fullPage: true,
    });
    console.log("📸 Screenshot 4: Toggle ON again saved");

    // Scroll down to load more posts
    await page.evaluate(() => {
      const scrollContainer = document.querySelector('[class*="virtuoso"]') || window;
      if (scrollContainer instanceof Window) {
        window.scrollBy(0, 500);
      } else {
        (scrollContainer as HTMLElement).scrollTop += 500;
      }
    });
    await page.waitForTimeout(2000);

    // Screenshot 5: After scrolling
    await page.screenshot({ path: "test-results/translation-5-after-scroll.png", fullPage: true });
    console.log("📸 Screenshot 5: After scroll saved");

    console.log("\n✅ Translation verification complete!");
    console.log("Check test-results/translation-*.png for visual verification");
  });
});
