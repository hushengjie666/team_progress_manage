import { createInitialState } from "./seed";
import type { AppState, AuthState, Settings, BackendConnectionState } from "./types";

const STORAGE_KEY = "timemanage.app_state.v4";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

type StoredAppRuntime = {
  version: 4;
  settings: Settings;
  auth: Partial<AuthState>;
  backend: Pick<BackendConnectionState, "serverUrl" | "username" | "deviceId" | "token">;
  updatedAt: string;
};

export const isCurrentAppStatePayload = (payload: unknown): payload is StoredAppRuntime => {
  if (!isRecord(payload)) return false;

  const backend = payload.backend;

  return (
    payload.version === 4 &&
    isRecord(payload.settings) &&
    isRecord(payload.auth) &&
    isRecord(backend) &&
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
    backend: {
      ...initial.backend,
      serverUrl: payload.backend.serverUrl,
      username: payload.backend.username,
      deviceId: payload.backend.deviceId,
      token: payload.backend.token,
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
    version: 4,
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
    updatedAt: new Date().toISOString(),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}
