import { defineConfig, devices } from "@playwright/test";
import { killStalePorts } from "./tests/e2e/cleanup";

// Runs at config load, before Playwright starts webServers — clears stale
// listeners from previous sessions so the run can't be served by an orphan
// server holding previous-session state.
killStalePorts();

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "demo.ts",
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: "list",
  outputDir: "./tests/e2e/demo-results",
  globalSetup: "./tests/e2e/globalSetup.ts",

  use: {
    baseURL: "http://excalihub.localhost:8081",
    screenshot: "off",
    video: "off",
    viewport: { width: 1280, height: 720 },
  },

  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],

  webServer: [
    {
      command: "bun run dev:server",
      url: "http://localhost:8081/api/config",
      reuseExistingServer: false,
      timeout: 30_000,
      env: {
        PORT: "8081",
        DATA_DIR: "./data-e2e",
        HUB_PORT: "4321",
        EXCALIDRAW_CONTAINER: "http://localhost:8099",
      },
    },
    {
      command: "bun run tests/e2e/excalidraw-stub.ts",
      url: "http://localhost:8099",
      reuseExistingServer: true,
      timeout: 15_000,
    },
    {
      command: "bun run dev:hub",
      url: "http://localhost:4321",
      reuseExistingServer: true,
      timeout: 120_000,
      env: {
        ASTRO_DEV_BACKGROUND: "false",
      },
    },
  ],
});
