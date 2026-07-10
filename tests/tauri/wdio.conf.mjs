import { existsSync } from "node:fs";
import { resolve } from "node:path";

const appBinaryName = process.platform === "win32" ? "timemanage-desktop.exe" : "timemanage-desktop";
const appBinaryPath = process.env.TM_TAURI_APP_BINARY
  ? resolve(process.env.TM_TAURI_APP_BINARY)
  : resolve(process.cwd(), "src-tauri", "target", "debug", appBinaryName);
const smokeSpecPath = resolve(process.cwd(), "tests", "tauri", "smoke.e2e.mjs");
const specPath = process.env.TM_TAURI_WDIO_SPEC ? resolve(process.env.TM_TAURI_WDIO_SPEC) : smokeSpecPath;

if (!existsSync(appBinaryPath)) {
  throw new Error(`Tauri debug binary not found: ${appBinaryPath}`);
}

export const config = {
  runner: "local",
  specs: [specPath],
  maxInstances: 1,
  services: [["@wdio/tauri-service", {
    appBinaryPath,
    driverProvider: "embedded",
    embeddedPort: Number(process.env.TAURI_WEBDRIVER_PORT ?? 4445),
    startTimeout: 30000,
    statusPollTimeout: 30000,
    captureBackendLogs: true,
    env: {
      ...process.env,
      ...(process.env.TM_TAURI_TEST_HOME ? { HOME: process.env.TM_TAURI_TEST_HOME } : {}),
    },
  }]],
  capabilities: [{
    browserName: "tauri",
    "tauri:options": {
      application: appBinaryPath,
    },
  }],
  logLevel: process.env.WDIO_LOG_LEVEL ?? "warn",
  bail: 0,
  waitforTimeout: 10000,
  connectionRetryTimeout: 90000,
  connectionRetryCount: 2,
  framework: "mocha",
  reporters: ["spec"],
  mochaOpts: {
    ui: "bdd",
    timeout: 90000,
  },
};
