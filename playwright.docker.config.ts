import { defineConfig, devices } from "@playwright/test";
import { killStalePorts } from "./tests/e2e/cleanup";

process.env.E2E_DOCKER = "1";

// Runs at config load, before Playwright starts anything. Docker mode runs
// every service (app + Excalidraw) inside compose, so there are no host
// listeners to clear — cleanup is a no-op for :8081/:8080 and skipped.
killStalePorts();

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/*.e2e.ts",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? "dot" : "list",
  outputDir: "./tests/e2e/test-results",
  // globalSetup builds + runs the app from the built Docker image and seeds
  // data-e2e (incl. the SSH deploy key). globalTeardown removes the container.
  globalSetup: "./tests/e2e/globalSetup.ts",
  globalTeardown: "./tests/e2e/globalTeardown.ts",

  use: {
    baseURL: "http://excalihub.localhost:8081",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
});
