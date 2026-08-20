import { describe, expect, it } from "vitest";
import {
  loadWorkspaceScopePreference,
  saveWorkspaceScopePreference,
  WORKSPACE_SCOPE_PREFERENCES_KEY,
} from "./workspaceScopePreference";

const memoryStorage = () => {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
};

describe("workspace scope preference", () => {
  it("restores the last workspace independently for each account", () => {
    const storage = memoryStorage();

    saveWorkspaceScopePreference("account_a", "workspace_private", storage);
    saveWorkspaceScopePreference("account_b", "workspace_shared", storage);

    expect(loadWorkspaceScopePreference("account_a", storage)).toBe("workspace_private");
    expect(loadWorkspaceScopePreference("account_b", storage)).toBe("workspace_shared");
  });

  it("clears an account selection without removing other account preferences", () => {
    const storage = memoryStorage();
    saveWorkspaceScopePreference("account_a", "workspace_private", storage);
    saveWorkspaceScopePreference("account_b", "workspace_shared", storage);

    saveWorkspaceScopePreference("account_a", null, storage);

    expect(loadWorkspaceScopePreference("account_a", storage)).toBeNull();
    expect(loadWorkspaceScopePreference("account_b", storage)).toBe("workspace_shared");
  });

  it("ignores malformed stored values", () => {
    const storage = memoryStorage();
    storage.setItem(WORKSPACE_SCOPE_PREFERENCES_KEY, "not-json");

    expect(loadWorkspaceScopePreference("account_a", storage)).toBeNull();
  });
});
