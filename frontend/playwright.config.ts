import os from "node:os";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;

/**
 * End-to-end tests against the full stack: the static frontend build served by
 * the FastAPI backend, as in production. They use the locally installed Chrome
 * and Edge (no browser download); on CI, install them with
 * `npx playwright install chrome msedge`. Needs `uv` for the backend.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "chrome", use: { ...devices["Desktop Chrome"], channel: "chrome" } },
    { name: "edge", use: { ...devices["Desktop Edge"], channel: "msedge" } },
    { name: "mobile-chrome", use: { ...devices["Pixel 7"], channel: "chrome" } },
  ],
  webServer: {
    command: `npm run build && cd ../backend && uv run uvicorn app.main:app --port ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    env: { DB_PATH: path.join(os.tmpdir(), "prelegal-e2e.db") },
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
