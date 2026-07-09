import { createInitialState } from "./seed";
import type {
  AppState,
  AuthState,
  BackendConnectionState,
  DailyPlan,
  ExecutionSignal,
  FocusSession,
  Settings,
  Task,
  WorkSession,
} from "./types";

const STORAGE_KEY = "timemanage.app_state.v4";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

type StoredAppRuntime = {
  version: 4;
  settings: Partial<Settings>;
  auth: Partial<AuthState>;
  backend: Pick<BackendConnectionState, "serverUrl" | "username" | "deviceId" | "token">;
  activeRuntime?: StoredActiveRuntime;
  updatedAt: string;
};

type StoredActiveRuntime = {
  activeTimer: AppState["activeTimer"];
  tasks: Task[];
  dailyPlans: DailyPlan[];
  focusSessions: FocusSession[];
  workSessions: WorkSession[];
  executionSignals: ExecutionSignal[];
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
  const state: AppState = {
    ...initial,
    settings: {
      ...initial.settings,
      ...payload.settings,
    },
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
  return restoreStoredActiveRuntime(state, payload.activeRuntime);
};

const readStoredState = (payload: string): AppState => parseCurrentAppStatePayload(JSON.parse(payload));

const asArray = <T>(value: unknown): T[] => (Array.isArray(value) ? value as T[] : []);

const restoreStoredActiveRuntime = (state: AppState, payload: unknown): AppState => {
  if (!isRecord(payload) || !isRecord(payload.activeTimer)) return state;
  const active = payload.activeTimer as unknown as NonNullable<AppState["activeTimer"]>;
  const activeTaskId = active.taskId;
  const workSessions = asArray<WorkSession>(payload.workSessions).filter((session) =>
    session.id === active.workSessionId ||
    session.focusSessionId === active.sessionId,
  );
  const workSessionIds = new Set(workSessions.map((session) => session.id));
  return {
    ...state,
    activeTimer: active,
    tasks: activeTaskId ? asArray<Task>(payload.tasks).filter((task) => task.id === activeTaskId) : [],
    dailyPlans: activeTaskId
      ? asArray<DailyPlan>(payload.dailyPlans).filter((plan) => plan.committedTaskIds.includes(activeTaskId))
      : [],
    focusSessions: asArray<FocusSession>(payload.focusSessions).filter((session) => session.id === active.sessionId),
    workSessions,
    executionSignals: asArray<ExecutionSignal>(payload.executionSignals).filter((signal) =>
      workSessionIds.has(signal.workSessionId),
    ),
  };
};

const activeRuntimeFromState = (state: AppState): StoredActiveRuntime | undefined => {
  const active = state.activeTimer;
  if (!active) return undefined;
  const activeTaskId = active.taskId;
  const workSessionIds = new Set(
    state.workSessions
      .filter((session) =>
        session.id === active.workSessionId ||
        session.focusSessionId === active.sessionId,
      )
      .map((session) => session.id),
  );
  const tasks = activeTaskId ? state.tasks.filter((task) => task.id === activeTaskId) : [];
  return {
    activeTimer: active,
    tasks,
    dailyPlans: activeTaskId
      ? state.dailyPlans.filter((plan) => plan.committedTaskIds.includes(activeTaskId))
      : [],
    focusSessions: state.focusSessions.filter((session) => session.id === active.sessionId),
    workSessions: state.workSessions.filter((session) => workSessionIds.has(session.id)),
    executionSignals: state.executionSignals.filter((signal) => workSessionIds.has(signal.workSessionId)),
  };
};

export async function loadState(): Promise<AppState> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return createInitialState();
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
    activeRuntime: activeRuntimeFromState(state),
    updatedAt: new Date().toISOString(),
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Tauri/WebView privacy modes can make localStorage unavailable; runtime state still remains in memory.
  }
}
