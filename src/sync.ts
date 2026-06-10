import type {
  AppState,
  BlockProfile,
  DailyPlan,
  FocusSession,
  Interruption,
  Onboarding,
  RewardState,
  Settings,
  StrictViolation,
  SyncConflict,
  SyncState,
  Task,
} from "./types";

type SyncEntity =
  | "settings"
  | "onboarding"
  | "reward_state"
  | "task"
  | "daily_plan"
  | "focus_session"
  | "interruption"
  | "strict_violation"
  | "block_profile";

type SyncPayload =
  | Settings
  | Onboarding
  | RewardState
  | Task
  | DailyPlan
  | FocusSession
  | Interruption
  | StrictViolation
  | BlockProfile;

export interface SyncChange {
  entity: SyncEntity;
  id: string;
  device_id: string;
  updated_at: string;
  deleted_at?: string;
  payload: SyncPayload | Record<string, never>;
}

export interface SyncRow extends SyncChange {
  revision: number;
  version: number;
}

interface LoginResponse {
  token: string;
  user_id: string;
  expires_at: string;
}

interface PushResponse {
  accepted: SyncRow[];
  conflicts: SyncRow[];
  current_revision: number;
}

interface PullResponse {
  changes: SyncRow[];
  current_revision: number;
}

const singletonEntities: SyncEntity[] = ["settings", "onboarding", "reward_state"];

const apiUrl = (serverUrl: string, path: string) => `${serverUrl.replace(/\/+$/, "")}${path}`;

const nowIso = () => new Date().toISOString();

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const timestampFor = (entity: SyncEntity, payload: unknown, fallback: string) => {
  if (!isObject(payload)) return fallback;
  const candidates = ["updatedAt", "endedAt", "startedAt", "createdAt", "completedAt"];
  for (const key of candidates) {
    const value = payload[key];
    if (typeof value === "string" && value) return value;
  }
  return fallback;
};

const localTimestampFor = (entity: SyncEntity, value: SyncPayload, stateUpdatedAt: string) => {
  if (singletonEntities.includes(entity)) return stateUpdatedAt;
  return timestampFor(entity, value, stateUpdatedAt);
};

const shouldAcceptRemote = (remote: SyncRow, local?: SyncPayload, stateUpdatedAt = "") => {
  if (!local) return true;
  return remote.updated_at >= localTimestampFor(remote.entity, local, stateUpdatedAt);
};

const withStatus = (sync: SyncState, patch: Partial<SyncState>): SyncState => ({
  ...sync,
  ...patch,
  tombstones: patch.tombstones ?? sync.tombstones ?? [],
  conflicts: patch.conflicts ?? sync.conflicts ?? [],
});

const authHeaders = (token?: string) => ({
  "Content-Type": "application/json",
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
});

const readResponse = async <T>(response: Response): Promise<T> => {
  if (response.ok) return response.json() as Promise<T>;
  let message = `${response.status} ${response.statusText}`;
  try {
    const body = (await response.json()) as { error?: string };
    if (body.error) message = body.error;
  } catch {
    const text = await response.text().catch(() => "");
    if (text) message = text;
  }
  throw new Error(message);
};

export async function loginToSyncServer(sync: SyncState, password: string): Promise<SyncState> {
  const response = await fetch(apiUrl(sync.serverUrl, "/auth/login"), {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      username: sync.username.trim(),
      password,
      device_id: sync.deviceId,
    }),
  });
  const payload = await readResponse<LoginResponse>(response);
  return withStatus(sync, {
    enabled: true,
    token: payload.token,
    status: "idle",
    message: `已登录同步服务，有效期至 ${new Date(payload.expires_at).toLocaleString()}`,
  });
}

export function flattenStateToChanges(state: AppState): SyncChange[] {
  const deviceID = state.sync.deviceId;
  const changes: SyncChange[] = [
    {
      entity: "settings",
      id: "default",
      device_id: deviceID,
      updated_at: state.updatedAt,
      payload: state.settings,
    },
    {
      entity: "onboarding",
      id: "default",
      device_id: deviceID,
      updated_at: state.updatedAt,
      payload: state.onboarding,
    },
    {
      entity: "reward_state",
      id: "default",
      device_id: deviceID,
      updated_at: state.updatedAt,
      payload: state.rewardState,
    },
    ...state.tasks.map((task) => ({
      entity: "task" as const,
      id: task.id,
      device_id: deviceID,
      updated_at: task.updatedAt,
      payload: task,
    })),
    ...state.dailyPlans.map((plan) => ({
      entity: "daily_plan" as const,
      id: plan.id,
      device_id: deviceID,
      updated_at: plan.updatedAt,
      payload: plan,
    })),
    ...state.focusSessions.map((session) => ({
      entity: "focus_session" as const,
      id: session.id,
      device_id: deviceID,
      updated_at: session.endedAt ?? session.startedAt,
      payload: session,
    })),
    ...state.interruptions.map((interruption) => ({
      entity: "interruption" as const,
      id: interruption.id,
      device_id: deviceID,
      updated_at: interruption.resolvedAt ?? interruption.createdAt,
      payload: interruption,
    })),
    ...state.strictViolations.map((violation) => ({
      entity: "strict_violation" as const,
      id: violation.id,
      device_id: deviceID,
      updated_at: violation.createdAt,
      payload: violation,
    })),
    ...state.blockProfiles.map((profile) => ({
      entity: "block_profile" as const,
      id: profile.id,
      device_id: deviceID,
      updated_at: profile.updatedAt,
      payload: profile,
    })),
  ];

  for (const tombstone of state.sync.tombstones ?? []) {
    changes.push({
      entity: tombstone.entity as SyncEntity,
      id: tombstone.id,
      device_id: deviceID,
      updated_at: tombstone.deletedAt,
      deleted_at: tombstone.deletedAt,
      payload: {},
    });
  }

  return changes;
}

const localPayloadFor = (state: AppState, row: SyncRow): SyncPayload | undefined => {
  if (row.entity === "settings") return state.settings;
  if (row.entity === "onboarding") return state.onboarding;
  if (row.entity === "reward_state") return state.rewardState;
  if (row.entity === "task") return state.tasks.find((item) => item.id === row.id);
  if (row.entity === "daily_plan") return state.dailyPlans.find((item) => item.id === row.id);
  if (row.entity === "focus_session") return state.focusSessions.find((item) => item.id === row.id);
  if (row.entity === "interruption") return state.interruptions.find((item) => item.id === row.id);
  if (row.entity === "strict_violation") return state.strictViolations.find((item) => item.id === row.id);
  if (row.entity === "block_profile") return state.blockProfiles.find((item) => item.id === row.id);
  return undefined;
};

const conflictFromRow = (state: AppState, row: SyncRow): SyncConflict => {
  const local = localPayloadFor(state, row);
  return {
    entity: row.entity,
    id: row.id,
    localUpdatedAt: local ? localTimestampFor(row.entity, local, state.updatedAt) : undefined,
    remoteUpdatedAt: row.updated_at,
    revision: row.revision,
    remotePayload: row.payload,
  };
};

const upsert = <T extends { id: string }>(items: T[], incoming: T, updatedAt: string, stateUpdatedAt: string) => {
  const existing = items.find((item) => item.id === incoming.id);
  if (!existing) return [incoming, ...items];
  return items.map((item) => (item.id === incoming.id && updatedAt >= timestampFor("task", item, stateUpdatedAt) ? incoming : item));
};

const removeById = <T extends { id: string }>(items: T[], id: string) => items.filter((item) => item.id !== id);

export function mergeRowsIntoState(state: AppState, rows: SyncRow[], currentRevision: number): AppState {
  let next = { ...state };
  let tombstones = [...(state.sync.tombstones ?? [])];

  for (const row of rows) {
    if (row.device_id === state.sync.deviceId) continue;

    if (row.deleted_at) {
      if (row.entity === "task") {
        next = {
          ...next,
          tasks: removeById(next.tasks, row.id),
          dailyPlans: next.dailyPlans.map((plan) => ({
            ...plan,
            committedTaskIds: plan.committedTaskIds.filter((taskId) => taskId !== row.id),
          })),
        };
      } else if (row.entity === "daily_plan") {
        next = { ...next, dailyPlans: removeById(next.dailyPlans, row.id) };
      } else if (row.entity === "focus_session") {
        next = { ...next, focusSessions: removeById(next.focusSessions, row.id) };
      } else if (row.entity === "interruption") {
        next = { ...next, interruptions: removeById(next.interruptions, row.id) };
      } else if (row.entity === "strict_violation") {
        next = { ...next, strictViolations: removeById(next.strictViolations, row.id) };
      } else if (row.entity === "block_profile") {
        next = { ...next, blockProfiles: removeById(next.blockProfiles, row.id) };
      }
      tombstones = tombstones.filter((item) => !(item.entity === row.entity && item.id === row.id));
      continue;
    }

    const payload = row.payload;
    if (!isObject(payload)) continue;

    if (row.entity === "settings" && shouldAcceptRemote(row, next.settings, next.updatedAt)) {
      next = { ...next, settings: payload as unknown as Settings };
    } else if (row.entity === "onboarding" && shouldAcceptRemote(row, next.onboarding, next.updatedAt)) {
      next = { ...next, onboarding: payload as unknown as Onboarding };
    } else if (row.entity === "reward_state" && shouldAcceptRemote(row, next.rewardState, next.updatedAt)) {
      next = { ...next, rewardState: payload as unknown as RewardState };
    } else if (row.entity === "task") {
      const incoming = payload as unknown as Task;
      const existing = next.tasks.find((task) => task.id === row.id);
      if (shouldAcceptRemote(row, existing, next.updatedAt)) next = { ...next, tasks: upsert(next.tasks, incoming, row.updated_at, next.updatedAt) };
    } else if (row.entity === "daily_plan") {
      const incoming = payload as unknown as DailyPlan;
      const existing = next.dailyPlans.find((plan) => plan.id === row.id);
      if (shouldAcceptRemote(row, existing, next.updatedAt)) {
        next = { ...next, dailyPlans: upsert(next.dailyPlans, incoming, row.updated_at, next.updatedAt) };
      }
    } else if (row.entity === "focus_session") {
      const incoming = payload as unknown as FocusSession;
      const existing = next.focusSessions.find((session) => session.id === row.id);
      if (shouldAcceptRemote(row, existing, next.updatedAt)) {
        next = { ...next, focusSessions: upsert(next.focusSessions, incoming, row.updated_at, next.updatedAt) };
      }
    } else if (row.entity === "interruption") {
      const incoming = payload as unknown as Interruption;
      const existing = next.interruptions.find((interruption) => interruption.id === row.id);
      if (shouldAcceptRemote(row, existing, next.updatedAt)) {
        next = { ...next, interruptions: upsert(next.interruptions, incoming, row.updated_at, next.updatedAt) };
      }
    } else if (row.entity === "strict_violation") {
      const incoming = payload as unknown as StrictViolation;
      const existing = next.strictViolations.find((violation) => violation.id === row.id);
      if (shouldAcceptRemote(row, existing, next.updatedAt)) {
        next = { ...next, strictViolations: upsert(next.strictViolations, incoming, row.updated_at, next.updatedAt) };
      }
    } else if (row.entity === "block_profile") {
      const incoming = payload as unknown as BlockProfile;
      const existing = next.blockProfiles.find((profile) => profile.id === row.id);
      if (shouldAcceptRemote(row, existing, next.updatedAt)) {
        next = { ...next, blockProfiles: upsert(next.blockProfiles, incoming, row.updated_at, next.updatedAt) };
      }
    }
  }

  const timestamp = nowIso();
  return {
    ...next,
    sync: withStatus(next.sync, {
      lastPulledRevision: currentRevision,
      tombstones,
      lastSyncedAt: timestamp,
    }),
    updatedAt: timestamp,
  };
}

export async function syncAppState(state: AppState): Promise<AppState> {
  if (!state.sync.token) throw new Error("请先登录同步服务");
  const syncStartedAt = nowIso();
  const changes = flattenStateToChanges(state);
  const pushResponse = await fetch(apiUrl(state.sync.serverUrl, "/sync/push"), {
    method: "POST",
    headers: authHeaders(state.sync.token),
    body: JSON.stringify({
      device_id: state.sync.deviceId,
      changes,
    }),
  });
  const pushed = await readResponse<PushResponse>(pushResponse);

  const pullResponse = await fetch(apiUrl(state.sync.serverUrl, `/sync/pull?since=${state.sync.lastPulledRevision}`), {
    headers: authHeaders(state.sync.token),
  });
  const pulled = await readResponse<PullResponse>(pullResponse);
  const merged = mergeRowsIntoState(state, pulled.changes, pulled.current_revision);
  const acceptedDeletions = new Set(
    pushed.accepted.filter((row) => row.deleted_at).map((row) => `${row.entity}:${row.id}`),
  );
  const tombstones = (merged.sync.tombstones ?? []).filter((row) => !acceptedDeletions.has(`${row.entity}:${row.id}`));

  return {
    ...merged,
    sync: withStatus(merged.sync, {
      status: "synced",
      message: `已同步 ${pushed.accepted.length} 条本地变更，拉取 ${pulled.changes.length} 条远端变更`,
      conflictCount: pushed.conflicts.length,
      conflicts: pushed.conflicts.map((row) => conflictFromRow(state, row)),
      retryCount: 0,
      nextRetryAt: undefined,
      lastSyncedAt: syncStartedAt,
      lastPulledRevision: Math.max(pushed.current_revision, pulled.current_revision),
      tombstones,
    }),
  };
}
