import { createInitialState } from "./seed";
import type { AppState } from "./types";

const STORAGE_KEY = "timemanage.app_state.v2";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

export const isCurrentAppStatePayload = (payload: unknown): payload is AppState => {
  const initial = createInitialState();

  if (!isRecord(payload)) return false;

  const sync = payload.sync;

  return (
    payload.version === initial.version &&
    isRecord(payload.settings) &&
    isRecord(payload.auth) &&
    Array.isArray(payload.projects) &&
    Array.isArray(payload.projectMembers) &&
    Array.isArray(payload.tasks) &&
    Array.isArray(payload.dailyPlans) &&
    Array.isArray(payload.focusSessions) &&
    Array.isArray(payload.workSessions) &&
    Array.isArray(payload.executionSignals) &&
    Array.isArray(payload.interruptions) &&
    isRecord(payload.rewardState) &&
    isRecord(sync) &&
    Array.isArray(sync.tombstones) &&
    Array.isArray(payload.taskTemplates) &&
    Array.isArray(payload.templateInstances) &&
    typeof payload.updatedAt === "string" &&
    (payload.activeTimer === undefined || payload.activeTimer === null || isRecord(payload.activeTimer))
  );
};

export const parseCurrentAppStatePayload = (payload: unknown): AppState => {
  if (!isCurrentAppStatePayload(payload)) {
    throw new Error("不是当前版本的完整 TimeManage 数据。");
  }

  return {
    version: payload.version,
    settings: payload.settings,
    auth: payload.auth,
    projects: payload.projects,
    projectMembers: payload.projectMembers,
    tasks: payload.tasks,
    dailyPlans: payload.dailyPlans,
    focusSessions: payload.focusSessions,
    workSessions: payload.workSessions,
    executionSignals: payload.executionSignals,
    interruptions: payload.interruptions,
    rewardState: payload.rewardState,
    sync: payload.sync,
    taskTemplates: payload.taskTemplates,
    templateInstances: payload.templateInstances,
    updatedAt: payload.updatedAt,
    ...(payload.activeTimer ? { activeTimer: payload.activeTimer } : {}),
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
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, updatedAt: new Date().toISOString() }));
}
