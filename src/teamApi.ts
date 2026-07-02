import { createInitialState } from "./seed";
import { ensureTodayPlan } from "./appModel";
import { flattenStateToChanges, mergeRowsIntoState, type SyncRow } from "./sync";
import type { AppState, ExecutionSignal, FocusSession, SyncState, Task, WorkSession } from "./types";

type TeamStateResponse = {
  changes: SyncRow[];
  current_revision: number;
};

type TeamChangeResponse = {
  accepted: SyncRow[];
  conflicts: SyncRow[];
  current_revision: number;
};

type TeamRevisionResponse = {
  current_revision: number;
};

const apiUrl = (serverUrl: string, path: string) => `${serverUrl.replace(/\/+$/, "")}${path}`;

const authHeaders = (token?: string) => ({
  "Content-Type": "application/json",
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
});

const readResponse = async <T>(response: Response): Promise<T> => {
  if (response.ok) return response.json() as Promise<T>;
  let message = "团队接口请求失败";
  try {
    const payload = await response.json() as { error?: string };
    message = payload.error ?? message;
  } catch {
    // keep default message
  }
  throw new Error(message);
};

const upsertById = <T extends { id: string }>(items: T[], incoming: T) =>
  items.some((item) => item.id === incoming.id)
    ? items.map((item) => (item.id === incoming.id ? incoming : item))
    : [incoming, ...items];

const localIsNewerOrMissing = <T extends { updatedAt?: string; startedAt?: string }>(local: T, remote?: T) =>
  !remote || (local.updatedAt ?? local.startedAt ?? "") >= (remote.updatedAt ?? remote.startedAt ?? "");

const preserveLocalActiveRuntime = (remote: AppState, local: AppState): AppState => {
  const active = local.activeTimer;
  if (!active) return remote;

  let next = { ...remote, activeTimer: active };
  const localTask = active.taskId ? local.tasks.find((task) => task.id === active.taskId) : undefined;
  if (localTask && localIsNewerOrMissing<Task>(localTask, next.tasks.find((task) => task.id === localTask.id))) {
    next = { ...next, tasks: upsertById(next.tasks, localTask) };
  }

  const localFocusSession = local.focusSessions.find((session) => session.id === active.sessionId);
  if (
    localFocusSession &&
    localIsNewerOrMissing<FocusSession>(localFocusSession, next.focusSessions.find((session) => session.id === localFocusSession.id))
  ) {
    next = { ...next, focusSessions: upsertById(next.focusSessions, localFocusSession) };
  }

  const localWorkSession = local.workSessions.find((session) =>
    active.workSessionId ? session.id === active.workSessionId : session.focusSessionId === active.sessionId,
  );
  if (
    localWorkSession &&
    (localWorkSession.status === "active" || localWorkSession.status === "paused") &&
    localIsNewerOrMissing<WorkSession>(localWorkSession, next.workSessions.find((session) => session.id === localWorkSession.id))
  ) {
    next = { ...next, workSessions: upsertById(next.workSessions, localWorkSession) };
  }

  const localSignals = localWorkSession
    ? local.executionSignals.filter((signal) => signal.workSessionId === localWorkSession.id)
    : [];
  if (localSignals.length) {
    const existingSignalIds = new Set(next.executionSignals.map((signal) => signal.id));
    const missingSignals = localSignals.filter((signal) => !existingSignalIds.has(signal.id));
    if (missingSignals.length) {
      next = { ...next, executionSignals: [...missingSignals, ...next.executionSignals] as ExecutionSignal[] };
    }
  }

  return ensureTodayPlan(next);
};

const createEmptyTeamStateBase = (local: AppState, token: string): AppState => ({
  ...createInitialState(),
  auth: local.auth,
  projects: [],
  projectMembers: [],
  tasks: [],
  dailyPlans: [],
  focusSessions: [],
  workSessions: [],
  executionSignals: [],
  interruptions: [],
  strictViolations: [],
  sync: {
    ...local.sync,
    enabled: false,
    autoSync: false,
    token,
    lastPulledRevision: 0,
    status: "idle",
    message: "团队在线模式",
    tombstones: [],
    conflicts: [],
  },
});

export async function loadTeamState(local: AppState): Promise<AppState> {
  const token = local.auth.token ?? local.sync.token;
  if (!token) return local;
  const payload = await readResponse<TeamStateResponse>(await fetch(apiUrl(local.sync.serverUrl, "/team/state/all"), {
    headers: authHeaders(token),
  }));
  const base = createEmptyTeamStateBase(local, token);
  const merged = mergeRowsIntoState(base, payload.changes, payload.current_revision, { forceRemote: true });
  const restored = preserveLocalActiveRuntime(merged, local);
  return {
    ...restored,
    auth: local.auth,
    sync: {
      ...restored.sync,
      enabled: false,
      autoSync: false,
      token,
      serverUrl: local.sync.serverUrl,
      username: local.auth.account?.email ?? local.sync.username,
      status: "synced",
      message: "团队在线数据已加载",
      retryCount: 0,
      nextRetryAt: undefined,
      lastPulledRevision: payload.current_revision,
    },
  };
}

const rowKey = (row: { entity: string; id: string }) => `${row.entity}:${row.id}`;

export function teamChangesBetween(before: AppState, after: AppState): SyncRow[] {
  const beforeRows = new Map(flattenStateToChanges(before).map((row) => [rowKey(row), JSON.stringify(row)]));
  return flattenStateToChanges(after)
    .filter((row) => beforeRows.get(rowKey(row)) !== JSON.stringify(row))
    .map((row) => ({ ...row, revision: 0, version: 1 }));
}

export async function pushTeamChanges(sync: SyncState, token: string, before: AppState, after: AppState): Promise<number | undefined> {
  const changes = teamChangesBetween(before, after);
  if (changes.length === 0) return undefined;
  const payload = await readResponse<TeamChangeResponse>(await fetch(apiUrl(sync.serverUrl, "/team/changes"), {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({
      device_id: sync.deviceId,
      changes,
    }),
  }));
  return payload.current_revision;
}

export async function getTeamRevision(sync: SyncState, token: string): Promise<number> {
  const payload = await readResponse<TeamRevisionResponse>(await fetch(apiUrl(sync.serverUrl, "/team/revision"), {
    headers: authHeaders(token),
  }));
  return payload.current_revision;
}
