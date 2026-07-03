import type { Page } from "@playwright/test";
import { authenticatedState } from "./authenticatedState";
import { STORAGE_KEY } from "./constants";
import { mockTeamBackend } from "./mockTeamBackend";
import type { MockTeamBackendOptions } from "./mockTypes";

export const clearStoredApp = async (page: Page) => {
  await page.goto("/");
  await page.evaluate((key) => localStorage.removeItem(key), STORAGE_KEY);
};

export const openApp = async (page: Page, state = authenticatedState(), backendOptions: MockTeamBackendOptions = {}) => {
  await mockTeamBackend(page, state, backendOptions);
  await page.addInitScript(
    ({ key, value }) => {
      localStorage.setItem(key, JSON.stringify(value));
    },
    { key: STORAGE_KEY, value: state },
  );
  await page.goto("/");
};
