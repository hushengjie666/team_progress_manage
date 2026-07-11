import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:1420",
    reuseExistingServer: true,
    timeout: 60_000,
  },
  use: {
    baseURL: "http://127.0.0.1:1420",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chrome",
      use: { ...devices["Desktop Chrome"], channel: "chrome" },
      testIgnore: /mobile-(layout|visual)\.spec\.ts/,
    },
    {
      name: "mobile-se-webkit",
      use: { ...devices["iPhone SE (3rd gen)"] },
      testMatch: /mobile-(layout|visual)\.spec\.ts/,
    },
    {
      name: "mobile-pro-webkit",
      use: { ...devices["iPhone 15 Pro"] },
      testMatch: /mobile-(layout|visual)\.spec\.ts/,
    },
    {
      name: "mobile-max-webkit",
      use: { ...devices["iPhone 15 Pro Max"] },
      testMatch: /mobile-(layout|visual)\.spec\.ts/,
    },
  ],
});
