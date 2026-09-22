import { defineConfig, devices } from "@playwright/test";
import { killStalePorts } from "./tests/e2e/cleanup";

// Dev-mode e2e runs a real Excalidraw container on a dedicated port (default
// 8099) so it never collides with `bun run dev`'s Excalidraw on :8080. Override
// with EXCALIDRAW_PORT if 8099 is taken.
const EXCALIDRAW_PORT = process.env.EXCALIDRAW_PORT ?? "8099";

// Runs at config load, before Playwright starts webServers — clears stale
// listeners from previous sessions so the run can't be served by an orphan
// server holding previous-session state.
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
      command: "bun run dev:server",
      url: "http://localhost:8081/api/config",
      reuseExistingServer: false,
      timeout: 30_000,
      env: {
        PORT: "8081",
        DATA_DIR: "./data-e2e",
        HUB_PORT: "4321",
        EXCALIDRAW_CONTAINER: `http://localhost:${EXCALIDRAW_PORT}`,
      },
    },
    {
      // Real Excalidraw on a dedicated port (not the :8080 `bun run dev` one).
      // Uses :latest (dev canary); the docker/CI suite pins a digest via
      // docker-compose.e2e.yml.
      command: "bun run dev:excalidraw:e2e",
      url: `http://localhost:${EXCALIDRAW_PORT}`,
      reuseExistingServer: true,
      timeout: 120_000,
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
