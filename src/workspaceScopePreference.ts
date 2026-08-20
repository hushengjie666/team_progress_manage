type WorkspaceScopePreferenceStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export const WORKSPACE_SCOPE_PREFERENCES_KEY = "timemanage.ui.workspaceScope.v1";

const availableStorage = (storage?: WorkspaceScopePreferenceStorage) => {
  if (storage) return storage;
  return typeof localStorage === "undefined" ? undefined : localStorage;
};

const readPreferences = (storage: WorkspaceScopePreferenceStorage): Record<string, string> => {
  try {
    const parsed = JSON.parse(storage.getItem(WORKSPACE_SCOPE_PREFERENCES_KEY) ?? "{}") as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
    );
  } catch {
    return {};
  }
};

export const loadWorkspaceScopePreference = (
  accountId: string,
  storage?: WorkspaceScopePreferenceStorage,
) => {
  const target = availableStorage(storage);
  if (!accountId || !target) return null;
  return readPreferences(target)[accountId] ?? null;
};

export const saveWorkspaceScopePreference = (
  accountId: string,
  workspaceId: string | null,
  storage?: WorkspaceScopePreferenceStorage,
) => {
  const target = availableStorage(storage);
  if (!accountId || !target) return;
  const preferences = readPreferences(target);
  if (workspaceId) preferences[accountId] = workspaceId;
  else delete preferences[accountId];
  try {
    if (Object.keys(preferences).length) {
      target.setItem(WORKSPACE_SCOPE_PREFERENCES_KEY, JSON.stringify(preferences));
    } else {
      target.removeItem(WORKSPACE_SCOPE_PREFERENCES_KEY);
    }
  } catch {
    // The workspace filter remains usable when browser storage is unavailable.
  }
};
