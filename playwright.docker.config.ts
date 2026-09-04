import { defineConfig, devices } from "@playwright/test";
import { killStalePorts } from "./tests/e2e/cleanup";

process.env.E2E_DOCKER = "1";

// Runs at config load, before Playwright starts webServers. Docker mode skips
// :8081 (the container owns it via docker-proxy) and still clears :4321/:8099.
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

  webServer: [
    // Only the Excalidraw stub runs on the host (Playwright manages it fine).
    // The excalihub app itself is the Docker container started in globalSetup,
    // which proxies to this stub via host.docker.internal:8099.
    {
      command: "bun run tests/e2e/excalidraw-stub.ts",
      url: "http://localhost:8099",
      reuseExistingServer: true,
      timeout: 15_000,
    },
  ],
});
