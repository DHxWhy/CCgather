import { test, expect } from "@playwright/test";

test.describe("Product Hunt Badge Position Verification", () => {
  test("should verify Product Hunt badge is positioned on the correct side", async ({ page }) => {
    // Navigate to homepage
    await page.goto("http://localhost:3000");

    // Wait 3 seconds for the Product Hunt badge to appear
    await page.waitForTimeout(3000);

    // Take a full page screenshot
    const screenshot = await page.screenshot({
      fullPage: true,
      path: "product-hunt-badge-verification.png",
    });

    console.log("Screenshot saved to: product-hunt-badge-verification.png");

    // Try to locate the Product Hunt badge
    // Common selectors for Product Hunt badges
    const possibleSelectors = [
      'a[href*="producthunt.com"]',
      'img[alt*="Product Hunt"]',
      '[class*="product-hunt"]',
      '[id*="product-hunt"]',
      'iframe[src*="producthunt"]',
    ];

    let badgeElement = null;
    let usedSelector = "";

    for (const selector of possibleSelectors) {
      const element = page.locator(selector).first();
      if ((await element.count()) > 0) {
        badgeElement = element;
        usedSelector = selector;
        break;
      }
    }

    if (badgeElement) {
      // Get the bounding box of the badge
      const boundingBox = await badgeElement.boundingBox();

      if (boundingBox) {
        const viewportSize = page.viewportSize();
        const pageWidth = viewportSize?.width || 1280;

        const badgeCenter = boundingBox.x + boundingBox.width / 2;
        const pageCenter = pageWidth / 2;

        const side = badgeCenter < pageCenter ? "LEFT" : "RIGHT";

        console.log("\n=== Product Hunt Badge Position Analysis ===");
        console.log(`Found using selector: ${usedSelector}`);
        console.log(`Badge X position: ${boundingBox.x.toFixed(2)}px`);
        console.log(`Badge Y position: ${boundingBox.y.toFixed(2)}px`);
        console.log(`Badge width: ${boundingBox.width.toFixed(2)}px`);
        console.log(`Badge height: ${boundingBox.height.toFixed(2)}px`);
        console.log(`Badge center X: ${badgeCenter.toFixed(2)}px`);
        console.log(`Page width: ${pageWidth}px`);
        console.log(`Page center: ${pageCenter}px`);
        console.log(`\n>>> RESULT: Product Hunt badge is on the ${side} side <<<\n`);
      } else {
        console.log("Badge element found but no bounding box available");
      }
    } else {
      console.log("Product Hunt badge not found using common selectors");
      console.log("Please check the screenshot: product-hunt-badge-verification.png");
    }
  });
});
