import { createInitialState } from "./seed";
import type { ActiveTimer, AppState, ProjectMember, Settings, SyncState } from "./types";

const STORAGE_KEY = "timemanage.app_state.v2";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

const arrayOr = <T>(value: unknown, fallback: T[]): T[] => (Array.isArray(value) ? value as T[] : fallback);

const normalizeActiveTimer = (timer: unknown): ActiveTimer | undefined => {
  if (!isRecord(timer) || typeof timer.sessionId !== "string" || typeof timer.startedAt !== "string") return undefined;
  const duration = typeof timer.duration === "number" ? timer.duration : 25 * 60;
  return {
    sessionId: timer.sessionId,
    taskId: typeof timer.taskId === "string" ? timer.taskId : undefined,
    workSessionId: typeof timer.workSessionId === "string" ? timer.workSessionId : undefined,
    mode: timer.mode === "short_break" || timer.mode === "long_break" ? timer.mode : "focus",
    duration,
    remaining: typeof timer.remaining === "number" ? timer.remaining : duration,
    isRunning: Boolean(timer.isRunning),
    startedAt: timer.startedAt,
    plannedEndAt: typeof timer.plannedEndAt === "string"
      ? timer.plannedEndAt
      : new Date(new Date(timer.startedAt).getTime() + duration * 1000).toISOString(),
    pausedAt: typeof timer.pausedAt === "string" ? timer.pausedAt : undefined,
    totalPausedSeconds: typeof timer.totalPausedSeconds === "number" ? timer.totalPausedSeconds : 0,
    cycleIndex: typeof timer.cycleIndex === "number" ? timer.cycleIndex : 1,
    pendingSettlement: timer.pendingSettlement === "pending" || timer.pendingSettlement === "none" ? timer.pendingSettlement : undefined,
  };
};

const mergeSettings = (initial: Settings, value: unknown): Settings => {
  const parsed = isRecord(value) ? value as Partial<Settings> : {};
  return {
    ...initial,
    ...parsed,
    reportFilter: {
      ...(initial.reportFilter ?? { range: "30d", project: "all", tag: "all", taskId: "all" }),
      ...(parsed.reportFilter ?? {}),
    },
    notificationSettings: {
      ...initial.notificationSettings,
      ...(parsed.notificationSettings ?? {}),
    },
  };
};

const mergeSync = (initial: SyncState, value: unknown): SyncState => {
  const parsed = isRecord(value) ? value as Partial<SyncState> : {};
  return {
    ...initial,
    ...parsed,
    tombstones: parsed.tombstones ?? [],
  };
};

const projectMemberIdentityKey = (member: ProjectMember) => {
  const scope = `${member.workspaceId ?? ""}:${member.projectId}`;
  if (member.email) return `${scope}:email:${member.email.trim().toLowerCase()}`;
  if (member.accountId) return `${scope}:account:${member.accountId}`;
  return `${scope}:member:${member.id}`;
};

const compareUpdatedAt = (left?: string, right?: string) => (left ?? "").localeCompare(right ?? "");

const normalizeProjectMembers = (members: ProjectMember[]) => {
  const canonicalByIdentity = new Map<string, ProjectMember>();
  for (const member of members) {
    const key = projectMemberIdentityKey(member);
    const current = canonicalByIdentity.get(key);
    if (!current || compareUpdatedAt(member.updatedAt, current.updatedAt) > 0) {
      canonicalByIdentity.set(key, member);
    }
  }

  const canonicalIds = new Set(Array.from(canonicalByIdentity.values()).map((member) => member.id));
  return members.filter((member) => canonicalIds.has(member.id));
};

export const normalizeAppStatePayload = (payload: unknown): AppState => {
  const initial = createInitialState();
  if (!isRecord(payload) || payload.version !== initial.version) return initial;
  const parsed = payload as Partial<AppState>;
  const sync = mergeSync(initial.sync, parsed.sync);
  return {
    ...initial,
    ...parsed,
    settings: mergeSettings(initial.settings, parsed.settings),
    auth: { ...initial.auth, ...parsed.auth },
    projects: arrayOr(parsed.projects, initial.projects),
    projectMembers: normalizeProjectMembers(arrayOr(parsed.projectMembers, initial.projectMembers)),
    tasks: arrayOr(parsed.tasks, initial.tasks),
    dailyPlans: arrayOr(parsed.dailyPlans, initial.dailyPlans),
    focusSessions: arrayOr(parsed.focusSessions, initial.focusSessions),
    workSessions: arrayOr(parsed.workSessions, initial.workSessions),
    executionSignals: arrayOr(parsed.executionSignals, initial.executionSignals),
    interruptions: arrayOr(parsed.interruptions, initial.interruptions),
    rewardState: { ...initial.rewardState, ...parsed.rewardState },
    sync,
    backupSnapshots: arrayOr(parsed.backupSnapshots, initial.backupSnapshots),
    taskTemplates: arrayOr(parsed.taskTemplates, initial.taskTemplates),
    templateInstances: arrayOr(parsed.templateInstances, initial.templateInstances),
    activeTimer: normalizeActiveTimer(parsed.activeTimer),
    updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : initial.updatedAt,
  };
};

const mergeStoredState = (payload: string): AppState => normalizeAppStatePayload(JSON.parse(payload));

export async function loadState(): Promise<AppState> {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return createInitialState();
  try {
    return mergeStoredState(stored);
  } catch {
    return createInitialState();
  }
}

export async function saveState(state: AppState): Promise<void> {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, updatedAt: new Date().toISOString() }));
}
