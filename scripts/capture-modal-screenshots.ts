import { chromium } from "playwright";
import * as path from "path";

const SCREENSHOTS_DIR = ".playwright-mcp";
const BASE_URL = "http://localhost:3000";

async function captureScreenshots() {
  console.log("🚀 Launching browser...");

  const browser = await chromium.launch({
    headless: false,
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });

  const page = await context.newPage();

  try {
    // Navigate to onboarding
    console.log("📍 Navigating to /onboarding...");
    await page.goto(`${BASE_URL}/onboarding`, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(2000);

    // Check if redirected to sign-in
    if (page.url().includes("/sign-in")) {
      console.log("🔐 Login required. Please log in manually...");
      await page.waitForURL("**/onboarding**", { timeout: 120000 });
      console.log("✅ Logged in successfully!");
    }

    // Wait for country selection
    console.log("⏳ Waiting for country cards...");
    await page.waitForSelector("text=/Popular Leagues/i", { timeout: 10000 });

    // Screenshot: Initial onboarding page
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, "onboarding_initial.png"),
    });
    console.log("📸 Saved: onboarding_initial.png");

    // Select South Korea
    console.log("🌏 Selecting South Korea...");
    const koreaCard = page
      .locator("button, div")
      .filter({ hasText: /South Korea/i })
      .first();
    await koreaCard.click();
    await page.waitForTimeout(1500);

    // Screenshot: Country selected
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, "country_selected.png"),
    });
    console.log("📸 Saved: country_selected.png");

    // Click Join League
    console.log("🎯 Clicking Join League...");
    const joinButton = page.getByRole("button", { name: /Join League/i });
    await joinButton.click();
    await page.waitForTimeout(1000);

    // Wait for modal
    await page.waitForSelector("text=/Developer Network Agreement/i", { timeout: 5000 });

    // Screenshot: Agreement Modal Desktop
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, "agreement_modal_desktop.png"),
    });
    console.log("📸 Saved: agreement_modal_desktop.png");

    // Scroll modal to show Data Integrity Promise
    const modalContent = page.locator(".overflow-y-auto").first();
    await modalContent.evaluate((el) => (el.scrollTop = el.scrollHeight));
    await page.waitForTimeout(500);

    // Screenshot: Data Integrity section visible
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, "agreement_modal_integrity.png"),
    });
    console.log("📸 Saved: agreement_modal_integrity.png");

    // Switch to mobile viewport
    console.log("📱 Switching to mobile viewport (375px)...");
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(500);

    // Scroll to top
    await modalContent.evaluate((el) => (el.scrollTop = 0));
    await page.waitForTimeout(300);

    // Screenshot: Mobile view top
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, "agreement_modal_mobile_top.png"),
    });
    console.log("📸 Saved: agreement_modal_mobile_top.png");

    // Scroll to bottom for integrity section
    await modalContent.evaluate((el) => (el.scrollTop = el.scrollHeight));
    await page.waitForTimeout(300);

    // Screenshot: Mobile integrity section
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, "agreement_modal_mobile_integrity.png"),
    });
    console.log("📸 Saved: agreement_modal_mobile_integrity.png");

    // Tablet viewport
    console.log("📱 Switching to tablet viewport (768px)...");
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(500);
    await modalContent.evaluate((el) => (el.scrollTop = 0));

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, "agreement_modal_tablet.png"),
    });
    console.log("📸 Saved: agreement_modal_tablet.png");

    console.log("\n✅ All screenshots captured!");
  } catch (error) {
    console.error("❌ Error:", error);
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, "error.png"),
    });
  } finally {
    await browser.close();
  }
}

captureScreenshots();
