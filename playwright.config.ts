import { defineConfig } from "@playwright/test";

const port = Number(process.env.E2E_PORT || 3100);

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: process.env.CI ? 60_000 : 120_000, // dev-mode Turbopack compiles on a cold server can eat most of a minute
  retries: 0,
  expect: { timeout: 10_000 }, // dev-mode compiles on first hit can exceed the 5 s default
  use: {
    baseURL: `http://localhost:${port}`,
    trace: "retain-on-failure",
  },
  webServer: {
    command: process.env.CI ? `npm start -- --port ${port}` : `npm run dev -- --port ${port}`,
    url: `http://localhost:${port}`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
