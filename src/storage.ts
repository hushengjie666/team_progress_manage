import { createInitialState } from "./seed";
import type { AppState, AuthState, Settings, SyncState } from "./types";

const STORAGE_KEY = "timemanage.app_state.v3";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

type StoredAppRuntime = {
  version: 3;
  settings: Settings;
  auth: Partial<AuthState>;
  sync: Pick<SyncState, "serverUrl" | "username" | "deviceId" | "token">;
  updatedAt: string;
};

export const isCurrentAppStatePayload = (payload: unknown): payload is StoredAppRuntime => {
  if (!isRecord(payload)) return false;

  const sync = payload.sync;

  return (
    payload.version === 3 &&
    isRecord(payload.settings) &&
    isRecord(payload.auth) &&
    isRecord(sync) &&
    typeof payload.updatedAt === "string"
  );
};

export const parseCurrentAppStatePayload = (payload: unknown): AppState => {
  if (!isCurrentAppStatePayload(payload)) {
    throw new Error("不是当前版本的完整 TimeManage 数据。");
  }

  const initial = createInitialState();
  return {
    ...initial,
    settings: payload.settings,
    auth: {
      ...initial.auth,
      ...payload.auth,
      workspaces: undefined,
      workspaceMemberships: undefined,
    },
    sync: {
      ...initial.sync,
      serverUrl: payload.sync.serverUrl,
      username: payload.sync.username,
      deviceId: payload.sync.deviceId,
      token: payload.sync.token,
      tombstones: [],
    },
    updatedAt: payload.updatedAt,
  };
};

const readStoredState = (payload: string): AppState => parseCurrentAppStatePayload(JSON.parse(payload));

export async function loadState(): Promise<AppState> {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return createInitialState();
  try {
    return readStoredState(stored);
  } catch {
    return createInitialState();
  }
}

export async function saveState(state: AppState): Promise<void> {
  const payload: StoredAppRuntime = {
    version: 3,
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
    sync: {
      serverUrl: state.sync.serverUrl,
      username: state.sync.username,
      deviceId: state.sync.deviceId,
      token: state.sync.token,
    },
    updatedAt: new Date().toISOString(),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}
