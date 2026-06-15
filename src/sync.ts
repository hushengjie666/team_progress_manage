import type {
  AppState,
  Account,
  BlockProfile,
  DailyPlan,
  FocusSession,
  Interruption,
  Onboarding,
  Project,
  ProjectMember,
  RewardState,
  Settings,
  StrictViolation,
  SyncConflict,
  SyncState,
  Task,
  TeamMember,
  Workspace,
  WorkSession,
  ExecutionSignal,
} from "./types";

type SyncEntity =
  | "settings"
  | "onboarding"
  | "reward_state"
  | "team_member"
  | "project"
  | "project_member"
  | "task"
  | "work_session"
  | "execution_signal"
  | "daily_plan"
  | "focus_session"
  | "interruption"
  | "strict_violation"
  | "block_profile";

type SyncPayload =
  | Settings
  | Onboarding
  | RewardState
  | TeamMember
  | Project
  | ProjectMember
  | Task
  | WorkSession
  | ExecutionSignal
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
  account: ServerAccount;
  workspace: ServerWorkspace;
}

interface ServerAccount {
  id: string;
  workspace_id: string;
  name: string;
  email: string;
  disabled_at?: string;
  created_at: string;
  updated_at: string;
}

interface ServerWorkspace {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface AuthStatusResponse {
  bootstrapped: boolean;
  workspace_id?: string;
  workspace_name?: string;
}

export interface AuthSession {
  token: string;
  expiresAt: string;
  account: Account;
  workspace: Workspace;
}

export interface BootstrapPayload {
  workspaceName: string;
  name: string;
  email: string;
  password: string;
}

export interface MemberAccountPayload {
  projectId?: string;
  name: string;
  email: string;
  password: string;
  roles: ProjectMember["roles"];
}

interface MemberResponse {
  member: SyncRow;
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
  const candidates = [
    "updatedAt",
    "reviewAcceptedAt",
    "reviewReturnedAt",
    "reviewSubmittedAt",
    "endedAt",
    "pausedAt",
    "startedAt",
    "createdAt",
    "completedAt",
  ];
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

const shouldAcceptRemoteOnboarding = (remote: SyncRow, local: Onboarding, stateUpdatedAt: string) => {
  const remotePayload = remote.payload;
  if (local.completed && isObject(remotePayload) && remotePayload.completed === false) return false;
  return shouldAcceptRemote(remote, local, stateUpdatedAt);
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

const requestJson = async <T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> => {
  try {
    const response = await fetch(input, init);
    return readResponse<T>(response);
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error("无法连接团队服务，请检查服务地址是否正确，并确认同步服务已启动");
    }
    throw error;
  }
};

const mapAccount = (account: ServerAccount): Account => ({
  id: account.id,
  workspaceId: account.workspace_id,
  name: account.name,
  email: account.email,
  disabledAt: account.disabled_at || undefined,
  createdAt: account.created_at,
  updatedAt: account.updated_at,
});

const mapWorkspace = (workspace: ServerWorkspace): Workspace => ({
  id: workspace.id,
  name: workspace.name,
  createdAt: workspace.created_at,
  updatedAt: workspace.updated_at,
});

const sessionFromLogin = (payload: LoginResponse): AuthSession => ({
  token: payload.token,
  expiresAt: payload.expires_at,
  account: mapAccount(payload.account),
  workspace: mapWorkspace(payload.workspace),
});

export async function getAuthStatus(serverUrl: string): Promise<AuthStatusResponse> {
  return requestJson<AuthStatusResponse>(apiUrl(serverUrl, "/auth/status"));
}

export async function bootstrapWorkspace(sync: SyncState, payload: BootstrapPayload): Promise<AuthSession> {
  const payloadResponse = await requestJson<LoginResponse>(apiUrl(sync.serverUrl, "/auth/bootstrap"), {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      workspace_name: payload.workspaceName,
      name: payload.name,
      email: payload.email,
      password: payload.password,
      device_id: sync.deviceId,
    }),
  });
  return sessionFromLogin(payloadResponse);
}

export async function loginToWorkspace(sync: SyncState, email: string, password: string): Promise<AuthSession> {
  const payload = await requestJson<LoginResponse>(apiUrl(sync.serverUrl, "/auth/login"), {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      email: email.trim(),
      password,
      device_id: sync.deviceId,
    }),
  });
  return sessionFromLogin(payload);
}

export async function loginToSyncServer(sync: SyncState, password: string): Promise<SyncState> {
  const payload = await loginToWorkspace(sync, sync.username, password);
  return withStatus(sync, {
    enabled: true,
    username: payload.account.email,
    token: payload.token,
    status: "idle",
    message: `已登录团队工作区，有效期至 ${new Date(payload.expiresAt).toLocaleString()}`,
  });
}

export async function createMemberAccount(sync: SyncState, token: string, payload: MemberAccountPayload): Promise<ProjectMember> {
  const result = await requestJson<MemberResponse>(apiUrl(sync.serverUrl, "/members"), {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({
      project_id: payload.projectId,
      name: payload.name,
      email: payload.email,
      password: payload.password,
      roles: payload.roles,
    }),
  });
  return result.member.payload as ProjectMember;
}

export async function createTeamMemberAccount(
  sync: SyncState,
  token: string,
  payload: Omit<MemberAccountPayload, "projectId" | "roles">,
): Promise<TeamMember> {
  const result = await requestJson<MemberResponse>(apiUrl(sync.serverUrl, "/members"), {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({
      name: payload.name,
      email: payload.email,
      password: payload.password,
    }),
  });
  return result.member.payload as TeamMember;
}

export async function updateMemberAccount(
  sync: SyncState,
  token: string,
  memberId: string,
  payload: Partial<Omit<MemberAccountPayload, "projectId">>,
): Promise<ProjectMember> {
  const result = await requestJson<MemberResponse>(apiUrl(sync.serverUrl, `/members/${encodeURIComponent(memberId)}`), {
    method: "PATCH",
    headers: authHeaders(token),
    body: JSON.stringify({
      name: payload.name,
      email: payload.email,
      password: payload.password,
      roles: payload.roles,
    }),
  });
  return result.member.payload as ProjectMember;
}

export async function updateTeamMemberAccount(
  sync: SyncState,
  token: string,
  memberId: string,
  payload: Partial<Omit<MemberAccountPayload, "projectId" | "roles">>,
): Promise<TeamMember> {
  const result = await requestJson<MemberResponse>(apiUrl(sync.serverUrl, `/members/${encodeURIComponent(memberId)}`), {
    method: "PATCH",
    headers: authHeaders(token),
    body: JSON.stringify({
      name: payload.name,
      email: payload.email,
      password: payload.password,
    }),
  });
  return result.member.payload as TeamMember;
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
    ...state.projects.map((project) => ({
      entity: "project" as const,
      id: project.id,
      device_id: deviceID,
      updated_at: project.updatedAt,
      payload: project,
    })),
    ...state.teamMembers.map((member) => ({
      entity: "team_member" as const,
      id: member.id,
      device_id: deviceID,
      updated_at: member.updatedAt,
      payload: member,
    })),
    ...state.projectMembers.map((member) => ({
      entity: "project_member" as const,
      id: member.id,
      device_id: deviceID,
      updated_at: member.updatedAt,
      payload: member,
    })),
    ...state.tasks.map((task) => ({
      entity: "task" as const,
      id: task.id,
      device_id: deviceID,
      updated_at: task.updatedAt,
      payload: task,
    })),
    ...state.workSessions.map((session) => ({
      entity: "work_session" as const,
      id: session.id,
      device_id: deviceID,
      updated_at: session.updatedAt,
      payload: session,
    })),
    ...state.executionSignals.map((signal) => ({
      entity: "execution_signal" as const,
      id: signal.id,
      device_id: deviceID,
      updated_at: signal.createdAt,
      payload: signal,
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
  if (row.entity === "project") return state.projects.find((item) => item.id === row.id);
  if (row.entity === "project_member") return state.projectMembers.find((item) => item.id === row.id);
  if (row.entity === "task") return state.tasks.find((item) => item.id === row.id);
  if (row.entity === "work_session") return state.workSessions.find((item) => item.id === row.id);
  if (row.entity === "execution_signal") return state.executionSignals.find((item) => item.id === row.id);
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

const upsert = <T extends { id: string }>(entity: SyncEntity, items: T[], incoming: T, updatedAt: string, stateUpdatedAt: string) => {
  const existing = items.find((item) => item.id === incoming.id);
  if (!existing) return [incoming, ...items];
  return items.map((item) => (item.id === incoming.id && updatedAt >= timestampFor(entity, item, stateUpdatedAt) ? incoming : item));
};

const removeById = <T extends { id: string }>(items: T[], id: string) => items.filter((item) => item.id !== id);
const removeMemberReferences = (tasks: Task[], memberId: string) =>
  tasks.map((task) => ({
    ...task,
    creatorMemberId: task.creatorMemberId === memberId ? undefined : task.creatorMemberId,
    primaryExecutorMemberId: task.primaryExecutorMemberId === memberId ? undefined : task.primaryExecutorMemberId,
    collaboratorMemberIds: task.collaboratorMemberIds?.filter((id) => id !== memberId) ?? [],
  }));

export function mergeRowsIntoState(state: AppState, rows: SyncRow[], currentRevision: number): AppState {
  let next = { ...state };
  let tombstones = [...(state.sync.tombstones ?? [])];

  for (const row of rows) {
    if (row.device_id === state.sync.deviceId) continue;

    if (row.deleted_at) {
      if (row.entity === "project") {
        next = { ...next, projects: removeById(next.projects, row.id) };
      } else if (row.entity === "team_member") {
        next = { ...next, teamMembers: removeById(next.teamMembers, row.id) };
      } else if (row.entity === "project_member") {
        const projectMembers = removeById(next.projectMembers, row.id);
        next = {
          ...next,
          projectMembers,
          currentMemberId: next.currentMemberId === row.id ? projectMembers[0]?.id : next.currentMemberId,
          tasks: removeMemberReferences(next.tasks, row.id),
        };
      } else if (row.entity === "task") {
        next = {
          ...next,
          tasks: removeById(next.tasks, row.id),
          dailyPlans: next.dailyPlans.map((plan) => ({
            ...plan,
            committedTaskIds: plan.committedTaskIds.filter((taskId) => taskId !== row.id),
          })),
        };
      } else if (row.entity === "work_session") {
        next = { ...next, workSessions: removeById(next.workSessions, row.id) };
      } else if (row.entity === "execution_signal") {
        next = { ...next, executionSignals: removeById(next.executionSignals, row.id) };
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
    } else if (row.entity === "onboarding" && shouldAcceptRemoteOnboarding(row, next.onboarding, next.updatedAt)) {
      next = { ...next, onboarding: payload as unknown as Onboarding };
    } else if (row.entity === "reward_state" && shouldAcceptRemote(row, next.rewardState, next.updatedAt)) {
      next = { ...next, rewardState: payload as unknown as RewardState };
    } else if (row.entity === "project") {
      const incoming = payload as unknown as Project;
      const existing = next.projects.find((project) => project.id === row.id);
      if (shouldAcceptRemote(row, existing, next.updatedAt)) next = { ...next, projects: upsert(row.entity, next.projects, incoming, row.updated_at, next.updatedAt) };
    } else if (row.entity === "team_member") {
      const incoming = payload as unknown as TeamMember;
      const existing = next.teamMembers.find((member) => member.id === row.id);
      if (shouldAcceptRemote(row, existing, next.updatedAt)) {
        next = {
          ...next,
          teamMembers: upsert(row.entity, next.teamMembers, incoming, row.updated_at, next.updatedAt),
          projectMembers: next.projectMembers.map((member) =>
            member.teamMemberId === incoming.id
              ? { ...member, accountId: incoming.accountId ?? member.accountId, name: incoming.name, email: incoming.email, status: incoming.status ?? member.status }
              : member,
          ),
        };
      }
    } else if (row.entity === "project_member") {
      const incoming = payload as unknown as ProjectMember;
      const existing = next.projectMembers.find((member) => member.id === row.id);
      if (shouldAcceptRemote(row, existing, next.updatedAt)) next = { ...next, projectMembers: upsert(row.entity, next.projectMembers, incoming, row.updated_at, next.updatedAt) };
    } else if (row.entity === "task") {
      const incoming = payload as unknown as Task;
      const existing = next.tasks.find((task) => task.id === row.id);
      if (shouldAcceptRemote(row, existing, next.updatedAt)) next = { ...next, tasks: upsert(row.entity, next.tasks, incoming, row.updated_at, next.updatedAt) };
    } else if (row.entity === "work_session") {
      const incoming = payload as unknown as WorkSession;
      const existing = next.workSessions.find((session) => session.id === row.id);
      if (shouldAcceptRemote(row, existing, next.updatedAt)) {
        next = { ...next, workSessions: upsert(row.entity, next.workSessions, incoming, row.updated_at, next.updatedAt) };
      }
    } else if (row.entity === "execution_signal") {
      const incoming = payload as unknown as ExecutionSignal;
      const existing = next.executionSignals.find((signal) => signal.id === row.id);
      if (shouldAcceptRemote(row, existing, next.updatedAt)) {
        next = { ...next, executionSignals: upsert(row.entity, next.executionSignals, incoming, row.updated_at, next.updatedAt) };
      }
    } else if (row.entity === "daily_plan") {
      const incoming = payload as unknown as DailyPlan;
      const existing = next.dailyPlans.find((plan) => plan.id === row.id);
      if (shouldAcceptRemote(row, existing, next.updatedAt)) {
        next = { ...next, dailyPlans: upsert(row.entity, next.dailyPlans, incoming, row.updated_at, next.updatedAt) };
      }
    } else if (row.entity === "focus_session") {
      const incoming = payload as unknown as FocusSession;
      const existing = next.focusSessions.find((session) => session.id === row.id);
      if (shouldAcceptRemote(row, existing, next.updatedAt)) {
        next = { ...next, focusSessions: upsert(row.entity, next.focusSessions, incoming, row.updated_at, next.updatedAt) };
      }
    } else if (row.entity === "interruption") {
      const incoming = payload as unknown as Interruption;
      const existing = next.interruptions.find((interruption) => interruption.id === row.id);
      if (shouldAcceptRemote(row, existing, next.updatedAt)) {
        next = { ...next, interruptions: upsert(row.entity, next.interruptions, incoming, row.updated_at, next.updatedAt) };
      }
    } else if (row.entity === "strict_violation") {
      const incoming = payload as unknown as StrictViolation;
      const existing = next.strictViolations.find((violation) => violation.id === row.id);
      if (shouldAcceptRemote(row, existing, next.updatedAt)) {
        next = { ...next, strictViolations: upsert(row.entity, next.strictViolations, incoming, row.updated_at, next.updatedAt) };
      }
    } else if (row.entity === "block_profile") {
      const incoming = payload as unknown as BlockProfile;
      const existing = next.blockProfiles.find((profile) => profile.id === row.id);
      if (shouldAcceptRemote(row, existing, next.updatedAt)) {
        next = { ...next, blockProfiles: upsert(row.entity, next.blockProfiles, incoming, row.updated_at, next.updatedAt) };
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
  const token = state.auth.token ?? state.sync.token;
  if (!token) throw new Error("请先登录团队工作区");
  const syncStartedAt = nowIso();
  const changes = flattenStateToChanges(state);
  const pushResponse = await fetch(apiUrl(state.sync.serverUrl, "/sync/push"), {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({
      device_id: state.sync.deviceId,
      changes,
    }),
  });
  const pushed = await readResponse<PushResponse>(pushResponse);

  const pullResponse = await fetch(apiUrl(state.sync.serverUrl, `/sync/pull?since=${state.sync.lastPulledRevision}`), {
    headers: authHeaders(token),
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
