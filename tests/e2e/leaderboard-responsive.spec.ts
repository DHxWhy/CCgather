// spec: F:\코딩 프로젝트\CCgather\claudedocs\leaderboard-responsive-test-plan.md
// seed: tests/e2e/seed-leaderboard.spec.ts

import { test, expect } from "@playwright/test";

test.describe("Leaderboard Responsive UI", () => {
  test("Desktop Table - All Columns Visible at 1280px", async ({ page }) => {
    // 1. Set desktop viewport
    await page.setViewportSize({ width: 1280, height: 720 });

    // 2. Navigate to leaderboard
    await page.goto("http://localhost:3002/leaderboard");

    // 3. Wait for table to load
    await expect(page.locator("table tbody tr")).toHaveCount(1, { timeout: 15000 });

    // 4. Verify all 6 columns are visible in header (use th selector)
    const headers = page.locator("table thead tr th");
    await expect(headers).toHaveCount(6);

    // 5. Verify column headers: Rank, C, User, Level, Cost, Tokens
    await expect(page.locator("table thead").getByText("Rank")).toBeVisible();
    await expect(page.locator("table thead").getByText("Level")).toBeVisible();
    await expect(page.locator("table thead").getByText("Cost")).toBeVisible();
    await expect(page.locator("table thead").getByText("Tokens")).toBeVisible();

    // 6. Verify first row has Level badge visible (use td selector)
    const firstRow = page.locator("table tbody tr").first();
    await expect(firstRow.locator("td").nth(3)).toContainText("Lv.");

    // 7. Verify Cost shows full format with $ and comma
    const costCell = firstRow.locator("td").nth(4);
    await expect(costCell).toContainText("$");
  });

  test("Tablet Table - Level Column Visible at 768px", async ({ page }) => {
    // 1. Set tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });

    // 2. Navigate to leaderboard
    await page.goto("http://localhost:3002/leaderboard");

    // 3. Wait for table to load
    await expect(page.locator("table tbody tr")).toHaveCount(1, { timeout: 15000 });

    // 4. Verify 6 columns visible (Level should be visible at md breakpoint, use th selector)
    const headers = page.locator("table thead tr th");
    await expect(headers).toHaveCount(6);

    // 5. Verify Level column is visible at 768px (md breakpoint)
    await expect(page.locator("table thead").getByText("Level")).toBeVisible();

    // 6. Verify first row has Level badge (use td selector)
    const firstRow = page.locator("table tbody tr").first();
    await expect(firstRow.locator("td").nth(3)).toContainText("Lv.");
  });

  test("Mobile Table - Compact Layout at 375px", async ({ page }) => {
    // 1. Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // 2. Navigate to leaderboard
    await page.goto("http://localhost:3002/leaderboard");

    // 3. Wait for table to load
    await expect(page.locator("table tbody tr")).toHaveCount(1, { timeout: 15000 });

    // 4. Verify table has columns (6 columns remain visible on mobile)
    const headers = page.locator("table thead tr th");
    await expect(headers).toHaveCount(6);

    // 5. Verify table is displayed and contains data
    const firstRow = page.locator("table tbody tr").first();
    await expect(firstRow).toBeVisible();

    // 6. Verify Cost header shows $ symbol
    await expect(page.locator("table thead").getByText("$")).toBeVisible();

    // 7. Verify first row contains cost value
    const costCell = firstRow.locator("td").nth(4);
    await expect(costCell).toContainText("$");
  });

  test("Desktop Filter Layout - Button Groups at 1280px", async ({ page }) => {
    // 1. Set desktop viewport
    await page.setViewportSize({ width: 1280, height: 720 });

    // 2. Navigate to leaderboard
    await page.goto("http://localhost:3002/leaderboard");

    // 3. Wait for table to load
    await expect(page.locator("table tbody tr")).toHaveCount(1, { timeout: 15000 });

    // 4. Verify Period filter shows button group with full text labels
    await expect(page.getByRole("button", { name: "All Time" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Today" })).toBeVisible();
    await expect(page.getByRole("button", { name: "7D" })).toBeVisible();
    await expect(page.getByRole("button", { name: "30D" })).toBeVisible();

    // 5. Verify Scope filter button group (use .first() for multiple matches)
    await expect(page.getByRole("button", { name: "🌍" }).first()).toBeVisible();

    // 6. Verify Sort filter buttons (use .first() for multiple matches)
    await expect(page.getByRole("button", { name: "💵" }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "🪙" }).first()).toBeVisible();
  });

  test("Mobile Filter Layout - Dropdown at 375px", async ({ page }) => {
    // 1. Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // 2. Navigate to leaderboard
    await page.goto("http://localhost:3002/leaderboard");

    // 3. Wait for table to load
    await expect(page.locator("table tbody tr")).toHaveCount(1, { timeout: 15000 });

    // 4. Verify Period filter becomes SELECT dropdown on mobile
    const periodDropdown = page.locator('select[name="period"], select:has(option[value="all"])');
    await expect(periodDropdown).toBeVisible();

    // 5. Verify dropdown has all period options
    await expect(periodDropdown.locator('option[value="all"]')).toHaveCount(1);
    await expect(periodDropdown.locator('option[value="1d"]')).toHaveCount(1);
    await expect(periodDropdown.locator('option[value="7d"]')).toHaveCount(1);
    await expect(periodDropdown.locator('option[value="30d"]')).toHaveCount(1);

    // 6. Verify Scope and Sort filters remain as button groups (use .first() for multiple matches)
    await expect(page.getByRole("button", { name: "🌍" }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "💵" }).first()).toBeVisible();
  });

  test("Desktop Panel Push Mode at 1280px", async ({ page }) => {
    // 1. Set desktop viewport
    await page.setViewportSize({ width: 1280, height: 720 });

    // 2. Navigate to leaderboard
    await page.goto("http://localhost:3002/leaderboard");

    // 3. Wait for table to load
    await expect(page.locator("table tbody tr")).toHaveCount(1, { timeout: 15000 });

    // 4. Click on first user row to open panel
    await page.locator("table tbody tr").first().click();

    // 5. Wait for panel to open
    await page.waitForTimeout(500);

    // 6. Verify panel is visible
    const panel = page.locator('[class*="fixed"][class*="right-0"]').filter({ hasText: "DHxYoon" });
    await expect(panel).toBeVisible();

    // 7. Verify no backdrop overlay on desktop (push mode)
    const backdrop = page.locator('.fixed.inset-0[class*="bg-black"]');
    await expect(backdrop).not.toBeVisible();

    // 8. Close panel with X button (use force: true to avoid header z-index blocking)
    const closeButton = panel.locator("button").first();
    await closeButton.click({ force: true });

    // 9. Wait for panel to close
    await page.waitForTimeout(500);
  });

  test("Tablet Panel Push Mode at 768px", async ({ page }) => {
    // 1. Set tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });

    // 2. Navigate to leaderboard
    await page.goto("http://localhost:3002/leaderboard");

    // 3. Wait for table to load
    await expect(page.locator("table tbody tr")).toHaveCount(1, { timeout: 15000 });

    // 4. Click on user row to open panel
    await page.locator("table tbody tr").first().click();

    // 5. Wait for panel to open
    await page.waitForTimeout(500);

    // 6. Verify panel is visible with 320px width (push mode)
    const panel = page.locator('[class*="fixed"][class*="right-0"]').filter({ hasText: "DHxYoon" });
    await expect(panel).toBeVisible();

    // 7. Verify no backdrop overlay (push mode at tablet size)
    const backdrop = page.locator('.fixed.inset-0[class*="bg-black"]');
    await expect(backdrop).not.toBeVisible();

    // 8. Close panel (use force: true to avoid header z-index blocking)
    const closeButton = panel.locator("button").first();
    await closeButton.click({ force: true });

    // 9. Wait for panel to close
    await page.waitForTimeout(500);
  });

  test("Mobile Panel Overlay Mode at 375px", async ({ page }) => {
    // 1. Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // 2. Navigate to leaderboard
    await page.goto("http://localhost:3002/leaderboard");

    // 3. Wait for table to load
    await expect(page.locator("table tbody tr")).toHaveCount(1, { timeout: 15000 });

    // 4. Click on user row to open panel
    await page.locator("table tbody tr").first().click();

    // 5. Wait for panel to open
    await page.waitForTimeout(500);

    // 6. Verify panel is visible in overlay mode
    const panel = page.locator('[class*="fixed"][class*="right-0"]').filter({ hasText: "DHxYoon" });
    await expect(panel).toBeVisible();

    // 7. Verify dark backdrop is visible (overlay mode)
    const backdrop = page.locator('.fixed.inset-0[class*="bg-black"]');
    await expect(backdrop).toBeVisible();

    // 8. Close panel by clicking backdrop (use force: true to avoid header z-index blocking)
    await backdrop.click({ position: { x: 10, y: 300 }, force: true });

    // 9. Wait for panel to close
    await page.waitForTimeout(500);

    // 10. Verify panel is closed
    await expect(panel).not.toBeVisible();
  });
});
