import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/*.e2e.ts",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? "dot" : "list",
  outputDir: "./tests/e2e/test-results",
  globalSetup: "./tests/e2e/globalSetup.ts",

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
    {
      command:
        "mkdir -p ./inject && cp -R server/src/inject/. ./inject/ && bun run dist/index.js",
      url: "http://localhost:8081/api/config",
      reuseExistingServer: false,
      timeout: 30_000,
      env: {
        NODE_ENV: "production",
        PORT: "8081",
        HOST: "127.0.0.1",
        DATA_DIR: "./data-e2e",
        BASE_DOMAIN: "localhost",
        HUB_SUBDOMAIN: "excalihub",
        EXCALIDRAW_CONTAINER: "http://localhost:8099",
      },
    },
    {
      command: "bun run tests/e2e/excalidraw-stub.ts",
      url: "http://localhost:8099",
      reuseExistingServer: true,
      timeout: 15_000,
    },
  ],
});
