// Playwright configuration — real-browser E2E for the i18n implementation.
// Uses the actual application served by Vite dev server (no mocks).
const { defineConfig, devices } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./e2e",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:4200",
    headless: true,
    viewport: { width: 1280, height: 800 },
    locale: "en-US",
    trace: "off",
    screenshot: "off",
  },
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:4200",
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
});
