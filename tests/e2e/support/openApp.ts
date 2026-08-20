import type { Page } from "@playwright/test";
import { authenticatedState } from "./authenticatedState";
import { STORAGE_KEY } from "./constants";
import { mockTeamBackend } from "./mockTeamBackend";
import type { MockTeamBackendOptions } from "./mockTypes";
import type { AppState } from "../../../src/types";
import { WORKSPACE_SCOPE_PREFERENCES_KEY } from "../../../src/workspaceScopePreference";

export const clearStoredApp = async (page: Page) => {
  await page.goto("/");
  await page.evaluate(([stateKey, workspaceScopeKey]) => {
    localStorage.removeItem(stateKey);
    localStorage.removeItem(workspaceScopeKey);
  }, [STORAGE_KEY, WORKSPACE_SCOPE_PREFERENCES_KEY]);
};

const storedRuntimeForState = (state: AppState) => ({
  version: 5,
  settings: state.settings,
  auth: {
    status: state.auth.status,
    token: state.auth.token,
    expiresAt: state.auth.expiresAt,
    account: state.auth.account,
    workspace: state.auth.workspace,
    membership: state.auth.membership,
    bootstrapped: state.auth.bootstrapped,
    message: state.auth.message,
  },
  backend: {
    serverUrl: state.backend.serverUrl,
    username: state.backend.username,
    deviceId: state.backend.deviceId,
    token: state.backend.token,
  },
  updatedAt: state.updatedAt,
});

export const openApp = async (page: Page, state = authenticatedState(), backendOptions: MockTeamBackendOptions = {}) => {
  await mockTeamBackend(page, state, backendOptions);
  await page.addInitScript(
    ({ key, value }) => {
      localStorage.setItem(key, JSON.stringify(value));
    },
    { key: STORAGE_KEY, value: storedRuntimeForState(state) },
  );
  await page.goto("/");
};
