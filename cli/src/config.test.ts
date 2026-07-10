import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { defaultConfigPath, loadConfig } from "./config";

const temporaryDirectories: string[] = [];

afterEach(() => {
  temporaryDirectories.splice(0).forEach((path) => rmSync(path, { recursive: true, force: true }));
});

describe("TimeManage CLI config", () => {
  it("uses the CLI config directory", () => {
    expect(defaultConfigPath().toLowerCase()).toContain("timemanage cli".replace(" ", process.platform === "win32" ? " " : "-"));
  });

  it("loads the CLI environment variables over file values", () => {
    const directory = mkdtempSync(join(tmpdir(), "timemanage-cli-"));
    temporaryDirectories.push(directory);
    const configPath = join(directory, "config.json");
    writeFileSync(configPath, JSON.stringify({
      serverUrl: "https://file.example/api",
      email: "file@example.com",
      password: "file-password",
      deviceId: "file-device",
    }));

    expect(loadConfig({
      TM_CLI_CONFIG: configPath,
      TM_CLI_SERVER_URL: "https://cli.example/api",
      TM_CLI_EMAIL: "cli@example.com",
      TM_CLI_PASSWORD: "cli-password",
      TM_CLI_DEVICE_ID: "cli-device",
    })).toEqual({
      serverUrl: "https://cli.example/api",
      email: "cli@example.com",
      password: "cli-password",
      deviceId: "cli-device",
    });
  });
});
