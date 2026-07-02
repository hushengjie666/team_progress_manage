import type {
  AppState,
  Account,
  BlockProfile,
  DailyPlan,
  FocusSession,
  Interruption,
  Onboarding,
  Project,
  ProjectInvitation,
  ProjectMember,
  ProjectMemberRole,
  RewardState,
  Settings,
  StrictViolation,
  SyncConflict,
  SyncState,
  Task,
  Workspace,
  WorkspaceInvitation,
  WorkspaceMembership,
  WorkspaceMembershipUpdateInput,
  WorkspaceUpdateInput,
  WorkSession,
  ExecutionSignal,
} from "./types";
import { normalizeAppStatePayload } from "./storage";
import { applySyncRowToState } from "./syncEntityMerge";
import { ensureTodayPlan } from "./appModel";

type SyncEntity =
  | "settings"
  | "onboarding"
  | "reward_state"
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
  workspace_id?: string;
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

export const REQUIRED_FULL_RECONCILE_VERSION = 3;

interface LoginResponse {
  token: string;
  user_id: string;
  expires_at: string;
  account: ServerAccount;
  workspace: ServerWorkspace;
  membership?: ServerWorkspaceMembership;
  workspaces?: ServerWorkspace[];
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
  type?: "private" | "shared";
  owner_account_id?: string;
  created_at: string;
  updated_at: string;
}

interface ServerWorkspaceMembership {
  id: string;
  workspace_id: string;
  account_id: string;
  name: string;
  email: string;
  role: "owner" | "admin" | "member";
  status: "active" | "disabled";
  created_at: string;
  updated_at: string;
}

interface ServerWorkspaceInvitation {
  id: string;
  workspace_id: string;
  workspace_name: string;
  workspace_type?: "private" | "shared";
  inviter_account_id: string;
  inviter_name: string;
  inviter_email: string;
  invitee_account_id: string;
  invitee_email: string;
  status: "pending" | "accepted" | "cancelled";
  created_at: string;
  updated_at: string;
  accepted_at?: string;
}

interface ServerProjectInvitation {
  id: string;
  workspace_id: string;
  workspace_name: string;
  project_id: string;
  project_name: string;
  inviter_account_id: string;
  inviter_name: string;
  inviter_email: string;
  invitee_account_id: string;
  invitee_email: string;
  roles: ProjectMemberRole[];
  status: "pending" | "accepted" | "cancelled";
  created_at: string;
  updated_at: string;
  accepted_at?: string;
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
  membership?: WorkspaceMembership;
  workspaces: Workspace[];
}

export interface BootstrapPayload {
  workspaceName: string;
  name: string;
  email: string;
  password: string;
}

export interface MemberAccountPayload {
  workspaceId?: string;
  projectId?: string;
  name: string;
  email: string;
  password: string;
  roles: ProjectMember["roles"];
  status?: "active" | "disabled";
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

interface RevisionResponse {
  current_revision: number;
}

interface WorkspacesResponse {
  workspaces: ServerWorkspace[];
  memberships?: ServerWorkspaceMembership[];
}

interface WorkspaceResponse {
  workspace: ServerWorkspace;
}

interface WorkspaceMembershipResponse {
  membership: ServerWorkspaceMembership;
}

interface WorkspaceInvitationsResponse {
  invitations: ServerWorkspaceInvitation[];
}

interface WorkspaceInvitationResponse {
  invitation: ServerWorkspaceInvitation;
}

interface ProjectInvitationsResponse {
  invitations: ServerProjectInvitation[];
}

interface ProjectInvitationResponse {
  invitation: ServerProjectInvitation;
}

interface PlatformAccountsResponse {
  accounts: ServerAccount[];
}

interface PlatformAccountResponse {
  account: ServerAccount;
}

export interface PlatformAccountPayload {
  name?: string;
  email?: string;
  password?: string;
  status?: "active" | "disabled";
}

export interface SyncRevisionEvent {
  workspace_id: string;
  current_revision: number;
  device_id?: string;
  time: string;
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

export function createSyncEventSource(sync: SyncState, token?: string): EventSource | undefined {
  const authToken = token ?? sync.token;
  if (!authToken || typeof EventSource === "undefined") return undefined;
  const url = new URL(apiUrl(sync.serverUrl, "/sync/events"));
  url.searchParams.set("token", authToken);
  url.searchParams.set("device_id", sync.deviceId);
  return new EventSource(url.toString());
}

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
      throw new Error("无法连接团队后台，请检查服务地址是否正确，并确认后台服务已启动");
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
  type: workspace.type === "private" ? "private" : "shared",
  ownerAccountId: workspace.owner_account_id || undefined,
  createdAt: workspace.created_at,
  updatedAt: workspace.updated_at,
});

const mapWorkspaceMembership = (membership: ServerWorkspaceMembership): WorkspaceMembership => ({
  id: membership.id,
  workspaceId: membership.workspace_id,
  accountId: membership.account_id,
  name: membership.name,
  email: membership.email,
  role: membership.role,
  status: membership.status,
  createdAt: membership.created_at,
  updatedAt: membership.updated_at,
});

const mapWorkspaceInvitation = (invitation: ServerWorkspaceInvitation): WorkspaceInvitation => ({
  id: invitation.id,
  workspaceId: invitation.workspace_id,
  workspaceName: invitation.workspace_name,
  workspaceType: invitation.workspace_type === "private" ? "private" : "shared",
  inviterAccountId: invitation.inviter_account_id,
  inviterName: invitation.inviter_name,
  inviterEmail: invitation.inviter_email,
  inviteeAccountId: invitation.invitee_account_id,
  inviteeEmail: invitation.invitee_email,
  status: invitation.status,
  createdAt: invitation.created_at,
  updatedAt: invitation.updated_at,
  acceptedAt: invitation.accepted_at || undefined,
});

const mapProjectInvitation = (invitation: ServerProjectInvitation): ProjectInvitation => ({
  id: invitation.id,
  workspaceId: invitation.workspace_id,
  workspaceName: invitation.workspace_name,
  projectId: invitation.project_id,
  projectName: invitation.project_name,
  inviterAccountId: invitation.inviter_account_id,
  inviterName: invitation.inviter_name,
  inviterEmail: invitation.inviter_email,
  inviteeAccountId: invitation.invitee_account_id,
  inviteeEmail: invitation.invitee_email,
  roles: invitation.roles?.length ? invitation.roles : ["executor"],
  status: invitation.status,
  createdAt: invitation.created_at,
  updatedAt: invitation.updated_at,
  acceptedAt: invitation.accepted_at || undefined,
});

const sessionFromLogin = (payload: LoginResponse): AuthSession => ({
  token: payload.token,
  expiresAt: payload.expires_at,
  account: mapAccount(payload.account),
  workspace: mapWorkspace(payload.workspace),
  membership: payload.membership ? mapWorkspaceMembership(payload.membership) : undefined,
  workspaces: (payload.workspaces ?? [payload.workspace]).map(mapWorkspace),
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

export async function switchWorkspace(sync: SyncState, token: string, workspaceId: string): Promise<AuthSession> {
  const payload = await requestJson<LoginResponse>(apiUrl(sync.serverUrl, "/auth/switch-workspace"), {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({
      workspace_id: workspaceId,
      device_id: sync.deviceId,
    }),
  });
  return sessionFromLogin(payload);
}

export async function createWorkspace(sync: SyncState, token: string, name: string): Promise<AuthSession> {
  const payload = await requestJson<LoginResponse>(apiUrl(sync.serverUrl, "/workspaces"), {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({
      name,
      type: "shared",
      device_id: sync.deviceId,
    }),
  });
  return sessionFromLogin(payload);
}

export async function fetchWorkspaces(sync: SyncState, token: string): Promise<{ workspaces: Workspace[]; memberships: WorkspaceMembership[] }> {
  const payload = await requestJson<WorkspacesResponse>(apiUrl(sync.serverUrl, "/workspaces"), {
    headers: authHeaders(token),
  });
  return {
    workspaces: payload.workspaces.map(mapWorkspace),
    memberships: (payload.memberships ?? []).map(mapWorkspaceMembership),
  };
}

export async function updateWorkspace(
  sync: SyncState,
  token: string,
  workspaceId: string,
  input: WorkspaceUpdateInput,
): Promise<Workspace> {
  const payload = await requestJson<WorkspaceResponse>(apiUrl(sync.serverUrl, `/workspaces/${encodeURIComponent(workspaceId)}`), {
    method: "PATCH",
    headers: authHeaders(token),
    body: JSON.stringify({
      name: input.name,
      type: input.type ?? "shared",
      owner_account_id: input.ownerAccountId,
    }),
  });
  return mapWorkspace(payload.workspace);
}

export async function updateWorkspaceMembership(
  sync: SyncState,
  token: string,
  workspaceId: string,
  membershipId: string,
  input: WorkspaceMembershipUpdateInput,
): Promise<WorkspaceMembership> {
  const payload = await requestJson<WorkspaceMembershipResponse>(
    apiUrl(sync.serverUrl, `/workspaces/${encodeURIComponent(workspaceId)}/members/${encodeURIComponent(membershipId)}`),
    {
      method: "PATCH",
      headers: authHeaders(token),
      body: JSON.stringify({
        status: input.status,
      }),
    },
  );
  return mapWorkspaceMembership(payload.membership);
}

export async function fetchWorkspaceInvitations(sync: SyncState, token: string): Promise<WorkspaceInvitation[]> {
  const payload = await requestJson<WorkspaceInvitationsResponse>(apiUrl(sync.serverUrl, "/workspace-invitations"), {
    headers: authHeaders(token),
  });
  return payload.invitations.map(mapWorkspaceInvitation);
}

export async function inviteWorkspaceMember(
  sync: SyncState,
  token: string,
  workspaceId: string,
  email: string,
): Promise<WorkspaceInvitation> {
  const payload = await requestJson<WorkspaceInvitationResponse>(apiUrl(sync.serverUrl, "/workspace-invitations"), {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({
      workspace_id: workspaceId,
      email,
    }),
  });
  return mapWorkspaceInvitation(payload.invitation);
}

export async function acceptWorkspaceInvitation(sync: SyncState, token: string, invitationId: string): Promise<WorkspaceInvitation> {
  const payload = await requestJson<WorkspaceInvitationResponse>(
    apiUrl(sync.serverUrl, `/workspace-invitations/${encodeURIComponent(invitationId)}/accept`),
    {
      method: "POST",
      headers: authHeaders(token),
    },
  );
  return mapWorkspaceInvitation(payload.invitation);
}

export async function fetchProjectInvitations(sync: SyncState, token: string): Promise<ProjectInvitation[]> {
  const payload = await requestJson<ProjectInvitationsResponse>(apiUrl(sync.serverUrl, "/project-invitations"), {
    headers: authHeaders(token),
  });
  return payload.invitations.map(mapProjectInvitation);
}

export async function inviteProjectMember(
  sync: SyncState,
  token: string,
  input: { workspaceId?: string; projectId: string; email: string; roles: ProjectMemberRole[] },
): Promise<ProjectInvitation> {
  const payload = await requestJson<ProjectInvitationResponse>(apiUrl(sync.serverUrl, "/project-invitations"), {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({
      workspace_id: input.workspaceId,
      project_id: input.projectId,
      email: input.email,
      roles: input.roles.length ? input.roles : ["executor"],
    }),
  });
  return mapProjectInvitation(payload.invitation);
}

export async function acceptProjectInvitation(sync: SyncState, token: string, invitationId: string): Promise<ProjectInvitation> {
  const payload = await requestJson<ProjectInvitationResponse>(
    apiUrl(sync.serverUrl, `/project-invitations/${encodeURIComponent(invitationId)}/accept`),
    {
      method: "POST",
      headers: authHeaders(token),
    },
  );
  return mapProjectInvitation(payload.invitation);
}

export async function fetchPlatformAccounts(sync: SyncState, token: string): Promise<Account[]> {
  const payload = await requestJson<PlatformAccountsResponse>(apiUrl(sync.serverUrl, "/admin/accounts"), {
    headers: authHeaders(token),
  });
  return payload.accounts.map(mapAccount);
}

export async function createPlatformAccount(
  sync: SyncState,
  token: string,
  payload: Required<Pick<PlatformAccountPayload, "name" | "email" | "password">> & Pick<PlatformAccountPayload, "status">,
): Promise<Account> {
  const result = await requestJson<PlatformAccountResponse>(apiUrl(sync.serverUrl, "/admin/accounts"), {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({
      name: payload.name,
      email: payload.email,
      password: payload.password,
      status: payload.status,
    }),
  });
  return mapAccount(result.account);
}

export async function updatePlatformAccount(
  sync: SyncState,
  token: string,
  accountId: string,
  payload: PlatformAccountPayload,
): Promise<Account> {
  const result = await requestJson<PlatformAccountResponse>(apiUrl(sync.serverUrl, `/admin/accounts/${encodeURIComponent(accountId)}`), {
    method: "PATCH",
    headers: authHeaders(token),
    body: JSON.stringify({
      name: payload.name,
      email: payload.email,
      password: payload.password,
      status: payload.status,
    }),
  });
  return mapAccount(result.account);
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

export async function getSyncRevision(sync: SyncState, token?: string): Promise<number> {
  const authToken = token ?? sync.token;
  if (!authToken) throw new Error("请先登录团队工作区");
  const payload = await requestJson<RevisionResponse>(apiUrl(sync.serverUrl, "/sync/revision"), {
    headers: authHeaders(authToken),
  });
  return payload.current_revision;
}

export async function createMemberAccount(sync: SyncState, token: string, payload: MemberAccountPayload): Promise<ProjectMember> {
  const result = await requestJson<MemberResponse>(apiUrl(sync.serverUrl, "/members"), {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({
      project_id: payload.projectId,
      workspace_id: payload.workspaceId,
      name: payload.name,
      email: payload.email,
      password: payload.password,
      roles: payload.roles,
    }),
  });
  return result.member.payload as ProjectMember;
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
      workspace_id: payload.workspaceId,
      email: payload.email,
      password: payload.password,
      roles: payload.roles,
    }),
  });
  return result.member.payload as ProjectMember;
}

const isAfter = (value: string, baseline?: string) => !baseline || value > baseline;

const activeWorkSessionTaskIds = (state: AppState) =>
  new Set(
    state.workSessions
      .filter((session) => session.status === "active" || session.status === "paused")
      .map((session) => session.taskId),
  );

export function flattenStateToChanges(state: AppState, options: { changedAfter?: string } = {}): SyncChange[] {
  const deviceID = state.sync.deviceId;
  const changedAfter = options.changedAfter;
  const activeTaskIds = activeWorkSessionTaskIds(state);
  const currentWorkspaceId = state.auth.workspace?.id;
  const projectWorkspaceIds = new Map(state.projects.map((project) => [project.id, project.workspaceId ?? currentWorkspaceId]));
  const taskWorkspaceIds = new Map(
    state.tasks.map((task) => [task.id, task.workspaceId ?? projectWorkspaceIds.get(task.projectId) ?? currentWorkspaceId]),
  );
  const workspaceIdForPayload = (payload: unknown, fallback?: string) => {
    if (isObject(payload) && typeof payload.workspaceId === "string" && payload.workspaceId.trim()) {
      return payload.workspaceId;
    }
    return fallback;
  };
  const changes: SyncChange[] = [
    {
      workspace_id: currentWorkspaceId,
      entity: "settings",
      id: "default",
      device_id: deviceID,
      updated_at: state.updatedAt,
      payload: state.settings,
    },
    {
      workspace_id: currentWorkspaceId,
      entity: "onboarding",
      id: "default",
      device_id: deviceID,
      updated_at: state.updatedAt,
      payload: state.onboarding,
    },
    {
      workspace_id: currentWorkspaceId,
      entity: "reward_state",
      id: "default",
      device_id: deviceID,
      updated_at: state.updatedAt,
      payload: state.rewardState,
    },
    ...state.projects.map((project) => ({
      workspace_id: workspaceIdForPayload(project, currentWorkspaceId),
      entity: "project" as const,
      id: project.id,
      device_id: deviceID,
      updated_at: project.updatedAt,
      payload: project,
    })),
    ...state.projectMembers.map((member) => ({
      workspace_id: workspaceIdForPayload(member, projectWorkspaceIds.get(member.projectId) ?? currentWorkspaceId),
      entity: "project_member" as const,
      id: member.id,
      device_id: deviceID,
      updated_at: member.updatedAt,
      payload: member,
    })),
    ...state.tasks.map((task) => ({
      workspace_id: workspaceIdForPayload(task, projectWorkspaceIds.get(task.projectId) ?? currentWorkspaceId),
      entity: "task" as const,
      id: task.id,
      device_id: deviceID,
      updated_at: task.updatedAt,
      payload: task,
    })),
    ...state.workSessions.map((session) => ({
      workspace_id: workspaceIdForPayload(session, taskWorkspaceIds.get(session.taskId) ?? currentWorkspaceId),
      entity: "work_session" as const,
      id: session.id,
      device_id: deviceID,
      updated_at: session.updatedAt,
      payload: session,
    })),
    ...state.executionSignals.map((signal) => ({
      workspace_id: workspaceIdForPayload(signal, taskWorkspaceIds.get(signal.taskId) ?? currentWorkspaceId),
      entity: "execution_signal" as const,
      id: signal.id,
      device_id: deviceID,
      updated_at: signal.createdAt,
      payload: signal,
    })),
    ...state.dailyPlans.map((plan) => ({
      workspace_id: workspaceIdForPayload(plan, currentWorkspaceId),
      entity: "daily_plan" as const,
      id: plan.id,
      device_id: deviceID,
      updated_at: plan.updatedAt,
      payload: plan,
    })),
    ...state.focusSessions.map((session) => ({
      workspace_id: workspaceIdForPayload(session, session.taskId ? taskWorkspaceIds.get(session.taskId) : currentWorkspaceId),
      entity: "focus_session" as const,
      id: session.id,
      device_id: deviceID,
      updated_at: session.endedAt ?? session.startedAt,
      payload: session,
    })),
    ...state.interruptions.map((interruption) => ({
      workspace_id: workspaceIdForPayload(interruption, interruption.taskId ? taskWorkspaceIds.get(interruption.taskId) : currentWorkspaceId),
      entity: "interruption" as const,
      id: interruption.id,
      device_id: deviceID,
      updated_at: interruption.resolvedAt ?? interruption.createdAt,
      payload: interruption,
    })),
    ...state.strictViolations.map((violation) => ({
      workspace_id: workspaceIdForPayload(violation, violation.taskId ? taskWorkspaceIds.get(violation.taskId) : currentWorkspaceId),
      entity: "strict_violation" as const,
      id: violation.id,
      device_id: deviceID,
      updated_at: violation.createdAt,
      payload: violation,
    })),
    ...state.blockProfiles.map((profile) => ({
      workspace_id: workspaceIdForPayload(profile, currentWorkspaceId),
      entity: "block_profile" as const,
      id: profile.id,
      device_id: deviceID,
      updated_at: profile.updatedAt,
      payload: profile,
    })),
  ];

  for (const tombstone of state.sync.tombstones ?? []) {
    if (!isAfter(tombstone.deletedAt, changedAfter)) continue;
    changes.push({
      workspace_id: tombstone.workspaceId ?? currentWorkspaceId,
      entity: tombstone.entity as SyncEntity,
      id: tombstone.id,
      device_id: deviceID,
      updated_at: tombstone.deletedAt,
      deleted_at: tombstone.deletedAt,
      payload: {},
    });
  }

  return changes.filter((change) => {
    if (isAfter(change.updated_at, changedAfter)) return true;
    if (change.entity === "work_session" && (change.payload as WorkSession).status !== "ended") return true;
    if (change.entity === "task" && activeTaskIds.has(change.id)) return true;
    return false;
  });
}

export function syncableStateFingerprint(state: AppState): string {
  return JSON.stringify(
    flattenStateToChanges(state).map((change) => ({
      workspaceId: change.workspace_id,
      entity: change.entity,
      id: change.id,
      updatedAt: singletonEntities.includes(change.entity) ? undefined : change.updated_at,
      deletedAt: change.deleted_at,
      payload: change.payload,
    })),
  );
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

const hasLocalChangeAfterSyncStarted = (entity: SyncEntity, source: SyncPayload | undefined, latest: SyncPayload, sourceStateUpdatedAt: string) => {
  if (!source) return true;
  return localTimestampFor(entity, latest, sourceStateUpdatedAt) > localTimestampFor(entity, source, sourceStateUpdatedAt);
};

const mergeEntityListIntoLatest = <T extends { id: string }>(
  entity: SyncEntity,
  latestItems: T[],
  sourceItems: T[],
  syncedItems: T[],
  sourceStateUpdatedAt: string,
) => {
  const latestById = new Map(latestItems.map((item) => [item.id, item]));
  const sourceById = new Map(sourceItems.map((item) => [item.id, item]));
  const syncedById = new Map(syncedItems.map((item) => [item.id, item]));
  const merged: T[] = [];
  const seen = new Set<string>();

  for (const item of syncedItems) {
    const latest = latestById.get(item.id);
    const source = sourceById.get(item.id);
    seen.add(item.id);
    if (!latest && source) continue;
    if (latest && hasLocalChangeAfterSyncStarted(entity, source as unknown as SyncPayload | undefined, latest as unknown as SyncPayload, sourceStateUpdatedAt)) {
      merged.push(latest);
    } else {
      merged.push(item);
    }
  }

  for (const latest of latestItems) {
    if (seen.has(latest.id)) continue;
    const source = sourceById.get(latest.id);
    if (hasLocalChangeAfterSyncStarted(entity, source as unknown as SyncPayload | undefined, latest as unknown as SyncPayload, sourceStateUpdatedAt)) {
      merged.push(latest);
    }
  }

  return merged;
};

export function mergeSyncedStateIntoLatest(latest: AppState, source: AppState, synced: AppState): AppState {
  const latestHasLocalSingletonChanges = latest.updatedAt > source.updatedAt;
  const syncedTombstoneKeys = new Set((synced.sync.tombstones ?? []).map((item) => `${item.entity}:${item.id}`));
  const localTombstones = (latest.sync.tombstones ?? []).filter((item) => !syncedTombstoneKeys.has(`${item.entity}:${item.id}`));
  return normalizeAppStatePayload({
    ...synced,
    auth: latest.auth,
    activeTimer: latest.activeTimer,
    nativeCapabilities: latest.nativeCapabilities,
    settings: latestHasLocalSingletonChanges ? latest.settings : synced.settings,
    onboarding: latestHasLocalSingletonChanges ? latest.onboarding : synced.onboarding,
    rewardState: latestHasLocalSingletonChanges ? latest.rewardState : synced.rewardState,
    projects: mergeEntityListIntoLatest("project", latest.projects, source.projects, synced.projects, source.updatedAt),
    projectMembers: mergeEntityListIntoLatest("project_member", latest.projectMembers, source.projectMembers, synced.projectMembers, source.updatedAt),
    tasks: mergeEntityListIntoLatest("task", latest.tasks, source.tasks, synced.tasks, source.updatedAt),
    workSessions: mergeEntityListIntoLatest("work_session", latest.workSessions, source.workSessions, synced.workSessions, source.updatedAt),
    executionSignals: mergeEntityListIntoLatest("execution_signal", latest.executionSignals, source.executionSignals, synced.executionSignals, source.updatedAt),
    dailyPlans: mergeEntityListIntoLatest("daily_plan", latest.dailyPlans, source.dailyPlans, synced.dailyPlans, source.updatedAt),
    focusSessions: mergeEntityListIntoLatest("focus_session", latest.focusSessions, source.focusSessions, synced.focusSessions, source.updatedAt),
    interruptions: mergeEntityListIntoLatest("interruption", latest.interruptions, source.interruptions, synced.interruptions, source.updatedAt),
    strictViolations: mergeEntityListIntoLatest("strict_violation", latest.strictViolations, source.strictViolations, synced.strictViolations, source.updatedAt),
    blockProfiles: mergeEntityListIntoLatest("block_profile", latest.blockProfiles, source.blockProfiles, synced.blockProfiles, source.updatedAt),
    sync: {
      ...synced.sync,
      tombstones: [...(synced.sync.tombstones ?? []), ...localTombstones],
    },
    updatedAt: latest.updatedAt > source.updatedAt ? latest.updatedAt : synced.updatedAt,
  });
}

export function mergeRowsIntoState(
  state: AppState,
  rows: SyncRow[],
  currentRevision: number,
  options: { forceRemote?: boolean; fullPulledAt?: string; fullReconcileVersion?: number } = {},
): AppState {
  let next = { ...state };
  let tombstones = [...(state.sync.tombstones ?? [])];

  for (const row of rows) {
    const result = applySyncRowToState(next, row, tombstones, { forceRemote: options.forceRemote });
    next = result.state;
    tombstones = result.tombstones;
  }

  const timestamp = nowIso();
  return normalizeAppStatePayload({
    ...next,
    sync: withStatus(next.sync, {
      lastPulledRevision: currentRevision,
      lastFullPulledAt: options.fullPulledAt ?? next.sync.lastFullPulledAt,
      lastFullReconcileVersion: options.fullReconcileVersion ?? next.sync.lastFullReconcileVersion,
      tombstones,
      lastSyncedAt: timestamp,
    }),
    updatedAt: timestamp,
  });
}

export async function syncAppState(state: AppState): Promise<AppState> {
  const source = ensureTodayPlan(state);
  const token = source.auth.token ?? source.sync.token;
  if (!token) throw new Error("请先登录团队工作区");
  const syncStartedAt = nowIso();
  const needsFullReconcile = source.sync.lastFullReconcileVersion !== REQUIRED_FULL_RECONCILE_VERSION;
  const changes = source.sync.lastSyncedAt ? flattenStateToChanges(source, { changedAfter: source.sync.lastSyncedAt }) : [];
  const pushResponse = await fetch(apiUrl(source.sync.serverUrl, "/sync/push"), {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({
      device_id: source.sync.deviceId,
      changes,
    }),
  });
  const pushed = await readResponse<PushResponse>(pushResponse);

  const pullSince = needsFullReconcile ? 0 : source.sync.lastPulledRevision;
  const pullResponse = await fetch(apiUrl(source.sync.serverUrl, `/sync/pull?since=${pullSince}`), {
    headers: authHeaders(token),
  });
  const pulled = await readResponse<PullResponse>(pullResponse);
  const merged = mergeRowsIntoState(source, pulled.changes, pulled.current_revision, {
    forceRemote: needsFullReconcile,
    fullPulledAt: needsFullReconcile ? syncStartedAt : undefined,
    fullReconcileVersion: needsFullReconcile ? REQUIRED_FULL_RECONCILE_VERSION : undefined,
  });
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
      conflicts: pushed.conflicts.map((row) => conflictFromRow(source, row)),
      retryCount: 0,
      nextRetryAt: undefined,
      lastSyncedAt: syncStartedAt,
      lastFullPulledAt: merged.sync.lastFullPulledAt,
      lastFullReconcileVersion: merged.sync.lastFullReconcileVersion,
      lastPulledRevision: Math.max(pushed.current_revision, pulled.current_revision),
      tombstones,
    }),
  };
}
