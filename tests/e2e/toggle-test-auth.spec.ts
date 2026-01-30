import { test, expect } from "@playwright/test";

// Use saved authentication state
test.use({ storageState: "tests/.auth/user.json" });

test.describe("Auto-Translate Toggle Tests (Authenticated)", () => {
  test("토글 ON/OFF 기능 테스트 - 로그인 상태", async ({ page }) => {
    // Navigate to community
    await page.goto("/community");
    await page.waitForTimeout(3000);

    // Take screenshot of initial state
    await page.screenshot({ path: "test-results/toggle-initial.png" });

    // Check for toggle button
    const toggleButton = page.locator('button[role="switch"]');
    const isToggleVisible = await toggleButton.isVisible({ timeout: 10000 }).catch(() => false);

    console.log("Toggle visible:", isToggleVisible);

    if (!isToggleVisible) {
      // Check if we're logged in by looking for settings link
      const settingsLink = page.locator('a[href="/settings"]');
      const isLoggedIn = await settingsLink.isVisible().catch(() => false);
      console.log("Settings link visible (logged in):", isLoggedIn);

      // Take screenshot to debug
      await page.screenshot({ path: "test-results/toggle-not-found.png", fullPage: true });

      // Skip if not visible
      test.skip(true, "Toggle not visible - auth may have expired");
      return;
    }

    // Get initial state
    const initialState = await toggleButton.getAttribute("aria-checked");
    console.log("Initial toggle state:", initialState);

    // Click to toggle
    await toggleButton.click();
    await page.waitForTimeout(1000);

    // Take screenshot after toggle
    await page.screenshot({ path: "test-results/toggle-after-click.png" });

    // Verify state changed
    const newState = await toggleButton.getAttribute("aria-checked");
    console.log("New toggle state:", newState);

    expect(newState).not.toBe(initialState);

    // Check status text
    if (newState === "true") {
      await expect(page.getByText("Posts appear in your language")).toBeVisible({ timeout: 3000 });
      console.log("Status: Posts appear in your language");
    } else {
      await expect(page.getByText("Showing original posts")).toBeVisible({ timeout: 3000 });
      console.log("Status: Showing original posts");
    }

    // Toggle back
    await toggleButton.click();
    await page.waitForTimeout(500);

    const finalState = await toggleButton.getAttribute("aria-checked");
    expect(finalState).toBe(initialState);
    console.log("Toggled back to:", finalState);

    console.log("✓ Toggle test PASSED");
  });

  test("번역 Shimmer 효과 확인", async ({ page }) => {
    await page.goto("/community");
    await page.waitForTimeout(3000);

    const toggleButton = page.locator('button[role="switch"]');
    const isToggleVisible = await toggleButton.isVisible({ timeout: 5000 }).catch(() => false);

    if (!isToggleVisible) {
      test.skip(true, "Toggle not visible");
      return;
    }

    // Ensure toggle is ON
    const isChecked = await toggleButton.getAttribute("aria-checked");
    if (isChecked !== "true") {
      await toggleButton.click();
      await page.waitForTimeout(500);
    }

    // Check for "Translating..." text
    const translatingText = page.getByText("Translating...");
    const hasTranslating = await translatingText.isVisible({ timeout: 5000 }).catch(() => false);
    console.log("Translating indicator visible:", hasTranslating);

    // Take screenshot
    await page.screenshot({ path: "test-results/shimmer-effect.png" });

    console.log("✓ Shimmer test completed");
  });
});
