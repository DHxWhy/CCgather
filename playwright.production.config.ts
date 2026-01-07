import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright configuration for CCgather Production E2E tests
 * Tests against live production site: https://ccgather.com
 */
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/production-onboarding-session.spec.ts",
  fullyParallel: false,
  forbidOnly: true,
  retries: 1,
  workers: 1,
  reporter: [["html", { outputFolder: "playwright-report-production" }]],
  timeout: 60000,
  use: {
    baseURL: "https://ccgather.com",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "on-first-retry",
  },
  projects: [
    {
      name: "chromium-production",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 720 },
      },
    },
  ],
});
