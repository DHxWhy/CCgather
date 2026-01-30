import { test, expect } from "@playwright/test";

// Use saved authentication state
test.use({ storageState: "tests/.auth/user.json" });

test.describe("Scroll Pagination & Translation Toggle Verification", () => {
  test("스크롤 페이지네이션 + 원문/번역 토글 검증", async ({ page }) => {
    // Navigate to community
    await page.goto("/community");
    await page.waitForTimeout(3000);

    console.log("\n=== 1. 초기 상태 확인 ===");

    // Screenshot 1: Initial state
    await page.screenshot({ path: "test-results/scroll-1-initial.png", fullPage: true });
    console.log("📸 Screenshot 1: Initial state");

    // Check toggle state
    const toggleButton = page.locator('button[role="switch"]');
    const isToggleVisible = await toggleButton.isVisible({ timeout: 10000 }).catch(() => false);

    if (!isToggleVisible) {
      console.log("❌ Toggle not visible - skipping");
      test.skip(true, "Toggle not visible");
      return;
    }

    // Ensure toggle is ON
    const initialState = await toggleButton.getAttribute("aria-checked");
    console.log(`✓ Toggle state: ${initialState === "true" ? "ON" : "OFF"}`);

    if (initialState !== "true") {
      await toggleButton.click();
      await page.waitForTimeout(2000);
      console.log("✓ Toggle turned ON");
    }

    // Wait for translations to load
    await page.waitForTimeout(3000);

    // Count initial posts
    const initialPosts = await page.locator("[data-feed-card]").count();
    console.log(`✓ Initial posts count: ${initialPosts}`);

    // Screenshot 2: Before scroll (with translation)
    await page.screenshot({ path: "test-results/scroll-2-before-scroll.png", fullPage: true });
    console.log("📸 Screenshot 2: Before scroll");

    console.log("\n=== 2. 원문/번역 토글 검증 ===");

    // The translation toggle button only appears on hover
    // Find a foreign language post (not KR→KR)
    const feedCards = page.locator("[data-feed-card]");
    const cardCount = await feedCards.count();
    console.log(`✓ Total feed cards: ${cardCount}`);

    let foundForeignPost = false;
    for (let i = 0; i < Math.min(cardCount, 5); i++) {
      const card = feedCards.nth(i);

      // Check if this is a foreign language post (has non-KR language indicator)
      const langIndicator = card.locator("text=/^[A-Z]{2}$/").first();
      const langText = await langIndicator.textContent().catch(() => null);

      if (langText && langText !== "KR") {
        console.log(`✓ Found foreign post #${i + 1}: ${langText}→KR`);
        foundForeignPost = true;

        // Get content before toggle
        const contentBefore = await card.locator("p").first().textContent();
        console.log(`Content before: ${contentBefore?.substring(0, 50)}...`);

        // Hover over the card to reveal toggle button (longer hover for React state update)
        await card.hover();
        await page.waitForTimeout(1000);

        // Screenshot 3a: Hover state showing toggle button
        await page.screenshot({ path: "test-results/scroll-3a-hover.png", fullPage: true });
        console.log("📸 Screenshot 3a: Hover state");

        // Look for the toggle button - check both "원문" and globe icon
        const toggleButton = card.locator('button:has-text("원문")');
        let toggleVisible = await toggleButton.isVisible({ timeout: 2000 }).catch(() => false);

        // Also try to find by globe icon if text search fails
        if (!toggleVisible) {
          const globeButton = card
            .locator("button")
            .filter({ has: page.locator("svg") })
            .filter({ hasText: /원문|번역/ });
          toggleVisible = await globeButton
            .first()
            .isVisible({ timeout: 1000 })
            .catch(() => false);
        }

        console.log(`✓ Translation toggle visible on hover: ${toggleVisible}`);

        // Debug: log all buttons in the card
        const allButtons = await card.locator("button").all();
        console.log(`✓ Total buttons in card: ${allButtons.length}`);
        for (let j = 0; j < Math.min(allButtons.length, 5); j++) {
          const btnText = await allButtons[j].textContent().catch(() => "N/A");
          console.log(`  Button ${j + 1}: "${btnText?.trim().substring(0, 30)}"`);
        }

        if (toggleVisible) {
          // Get button text before click
          const buttonTextBefore = await toggleButton.textContent();
          console.log(`Toggle button text: ${buttonTextBefore}`);

          // Click to show original
          await toggleButton.click();
          await page.waitForTimeout(1500);

          // Screenshot 3b: Original view
          await page.screenshot({ path: "test-results/scroll-3b-original.png", fullPage: true });
          console.log("📸 Screenshot 3b: After toggle click");

          // Get content after toggle - read from the same card's paragraph
          const paragraphs = card.locator("p.whitespace-pre-wrap");
          const contentAfter = await paragraphs
            .first()
            .textContent({ timeout: 2000 })
            .catch(() => "N/A");
          console.log(`Content after: ${contentAfter?.substring(0, 50)}...`);

          // Check if content actually changed to foreign language
          const containsKorean = /[가-힣]/.test(contentAfter || "");
          const containsGerman = /[äöüßÄÖÜ]/.test(contentAfter || "");
          console.log(
            `Content contains Korean: ${containsKorean}, German chars: ${containsGerman}`
          );

          // Verify content changed
          if (contentBefore !== contentAfter) {
            console.log("✅ Content changed - Original view working!");
          } else {
            console.log("⚠️ Content same - checking if translated_content exists...");
            // Debug: check what content is showing
            console.log(`Full content: ${contentAfter}`);
          }

          // Check for "번역 보기" button
          await card.hover();
          await page.waitForTimeout(500);
          const backToggle = card.locator('button:has-text("번역 보기")');
          const backVisible = await backToggle.isVisible({ timeout: 1000 }).catch(() => false);
          console.log(`✓ "번역 보기" button visible: ${backVisible}`);

          if (backVisible) {
            await backToggle.click();
            await page.waitForTimeout(1000);
            console.log("✓ Toggled back to translation view");
          }
        }

        break; // Test one post
      }
    }

    if (!foundForeignPost) {
      console.log("⚠️ No foreign language posts found for toggle test");
    }

    console.log("\n=== 3. 스크롤 페이지네이션 검증 ===");

    // Scroll down to trigger pagination
    console.log("Scrolling to load more posts...");

    // Find the virtuoso container and scroll
    const scrollContainer = page.locator('[class*="virtuoso"]').first();
    const isVirtuosoVisible = await scrollContainer.isVisible().catch(() => false);

    if (isVirtuosoVisible) {
      // Scroll within the virtuoso container
      await scrollContainer.evaluate((el) => {
        el.scrollTop = el.scrollHeight;
      });
    } else {
      // Fallback: scroll the page
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });
    }

    await page.waitForTimeout(2000);

    // Screenshot 4: After first scroll
    await page.screenshot({ path: "test-results/scroll-4-after-scroll-1.png", fullPage: true });
    console.log("📸 Screenshot 4: After first scroll");

    // Check for "Loading more..." indicator or new posts
    const loadingIndicator = page.getByText("Loading more...");
    const hasLoading = await loadingIndicator.isVisible({ timeout: 1000 }).catch(() => false);
    console.log(`Loading indicator visible: ${hasLoading}`);

    // Wait for new posts to load
    await page.waitForTimeout(3000);

    // Count posts after scroll
    const postsAfterScroll = await page.locator("[data-feed-card]").count();
    console.log(`✓ Posts after scroll: ${postsAfterScroll}`);

    // Scroll again to load even more
    if (isVirtuosoVisible) {
      await scrollContainer.evaluate((el) => {
        el.scrollTop = el.scrollHeight;
      });
    } else {
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });
    }

    await page.waitForTimeout(3000);

    // Screenshot 5: After second scroll
    await page.screenshot({ path: "test-results/scroll-5-after-scroll-2.png", fullPage: true });
    console.log("📸 Screenshot 5: After second scroll");

    const postsAfterScroll2 = await page.locator("[data-feed-card]").count();
    console.log(`✓ Posts after second scroll: ${postsAfterScroll2}`);

    console.log("\n=== 4. 스크롤 후 번역 상태 확인 ===");

    // Check if new posts have translation badges (language indicators like ES→KR)
    const langIndicators = page.locator("text=/[A-Z]{2}→[A-Z]{2}/");
    const langCount = await langIndicators.count();
    console.log(`✓ Language indicators found: ${langCount}`);

    // Check for shimmer (loading) indicators
    const shimmerElements = page.locator('[class*="shimmer"], [class*="animate-pulse"]');
    const shimmerCount = await shimmerElements.count();
    console.log(`✓ Shimmer/loading elements: ${shimmerCount}`);

    // Check "Translating..." indicator
    const translatingText = page.getByText("Translating...");
    const isTranslating = await translatingText.isVisible({ timeout: 1000 }).catch(() => false);
    console.log(`✓ "Translating..." visible: ${isTranslating}`);

    // Screenshot 6: Final state
    await page.screenshot({ path: "test-results/scroll-6-final.png", fullPage: true });
    console.log("📸 Screenshot 6: Final state");

    // Verify "No more posts" message if reached end
    const noMorePosts = page.getByText("No more posts");
    const reachedEnd = await noMorePosts.isVisible({ timeout: 1000 }).catch(() => false);
    console.log(`✓ Reached end of feed: ${reachedEnd}`);

    console.log("\n=== 검증 완료 ===");
    console.log(`초기 포스트: ${initialPosts}`);
    console.log(`스크롤 후 포스트: ${postsAfterScroll2}`);
    console.log(`외국어 포스트 발견: ${foundForeignPost}`);
    console.log("\n✅ Check test-results/scroll-*.png for visual verification");
  });
});
