import { test, expect } from "@playwright/test";

const authFile = "tests/.auth/user.json";

/**
 * Authentication Setup - Run this first with --headed to login manually
 * npx playwright test tests/e2e/auth.setup.ts --headed --project=chromium
 */
test("save auth session", async ({ page }) => {
  // Navigate to sign-in page
  await page.goto("/sign-in");
  await page.waitForTimeout(3000);

  // Check if already authenticated
  const currentUrl = page.url();
  if (!currentUrl.includes("sign-in")) {
    console.log("Already authenticated, saving session...");
    await page.context().storageState({ path: authFile });
    return;
  }

  console.log("\n========================================");
  console.log("MANUAL ACTION REQUIRED:");
  console.log("1. Sign in with your credentials");
  console.log("2. Wait for redirect");
  console.log("========================================\n");

  // Wait for user to complete login (2 minutes)
  await page.waitForURL((url) => !url.toString().includes("sign-in"), {
    timeout: 120000,
  });

  // Verify and save
  await page.goto("/community");
  await page.waitForTimeout(2000);

  await page.context().storageState({ path: authFile });
  console.log("Session saved to " + authFile);
});
