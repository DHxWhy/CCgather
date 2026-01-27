/**
 * Save authentication state for Playwright tests
 *
 * Usage:
 *   npx tsx scripts/save-auth-state.ts
 *
 * This will:
 * 1. Open a real Chrome browser (not Chromium)
 * 2. Navigate to the sign-in page
 * 3. Wait for you to manually log in
 * 4. Save the authentication state to .auth/state.json
 * 5. Future Playwright tests can reuse this state
 */

import { chromium } from "playwright";
import * as fs from "fs";
import * as path from "path";

const AUTH_FILE = ".auth/state.json";

async function saveAuthState() {
  // Ensure .auth directory exists
  const authDir = path.dirname(AUTH_FILE);
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  console.log("🚀 Launching Chrome browser...");
  console.log("📝 Please log in manually, then the script will save your session.\n");

  // Use real Chrome to bypass Google's automation detection
  const browser = await chromium.launch({
    channel: "chrome",
    headless: false,
    args: ["--disable-blink-features=AutomationControlled"],
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
  });

  const page = await context.newPage();

  // Navigate to sign-in page
  await page.goto("http://localhost:3000/sign-in");

  console.log("⏳ Waiting for login... (page will close automatically after login)");
  console.log("   URL will change to /leaderboard or / after successful login.\n");

  // Wait for successful login (URL changes away from sign-in)
  await page.waitForURL(
    (url) => {
      const pathname = url.pathname;
      return !pathname.includes("sign-in") && !pathname.includes("sign-up");
    },
    { timeout: 300000 }
  ); // 5 minutes timeout

  console.log("✅ Login detected! Saving authentication state...");

  // Save the authentication state
  await context.storageState({ path: AUTH_FILE });

  console.log(`💾 Authentication state saved to: ${AUTH_FILE}`);
  console.log("\n🎉 Done! Future Playwright tests will use this logged-in state.");

  await browser.close();
}

saveAuthState().catch((error) => {
  console.error("❌ Error:", error.message);
  process.exit(1);
});
