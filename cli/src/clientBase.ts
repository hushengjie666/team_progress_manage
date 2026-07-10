import { bindAccountToMembers } from "../../src/authModel.js";
import { createInitialState } from "../../src/seed.js";
import {
  acceptProjectInvitation,
  acceptWorkspaceInvitation,
  createMemberAccount,
  createPlatformAccount,
  createWorkspace,
  deleteProjectInvitation,
  deleteWorkspaceInvitation,
  fetchPlatformAccounts,
  fetchProjectInvitations,
  fetchWorkspaceInvitations,
  fetchWorkspaces,
  getAuthStatus,
  inviteProjectMember,
  inviteWorkspaceMember,
  loginToWorkspace,
  switchWorkspace,
  updateMemberAccount,
  updatePlatformAccount,
  updateWorkspace,
  updateWorkspaceMembership,
  type AuthSession,
  type MemberAccountPayload,
  type PlatformAccountPayload,
} from "../../src/teamBackend.js";
import { loadTeamData, saveTeamDataChanges } from "../../src/teamApi.js";
import type { AppState, ProjectMemberRole, WorkspaceMembershipUpdateInput, WorkspaceUpdateInput } from "../../src/types.js";
import type { TimeManageCliConfig } from "./config.js";

export type StateMutation<T> = (state: AppState, timestamp: string) => { state: AppState; result: T };

export class TimeManageBaseClient {
  private session?: AuthSession;

  constructor(protected readonly config: TimeManageCliConfig) {}

  private backendState(session?: AuthSession): AppState {
    const state = createInitialState();
    return {
      ...state,
      auth: session
        ? {
            status: "authenticated",
            token: session.token,
            expiresAt: session.expiresAt,
            account: session.account,
            workspace: session.workspace,
            membership: session.membership,
            workspaces: session.workspaces,
            workspaceMemberships: [],
            bootstrapped: true,
            message: "CLI 已登录团队后台",
          }
        : state.auth,
      backend: {
        ...state.backend,
        serverUrl: this.config.serverUrl,
        username: session?.account.email ?? this.config.email,
        deviceId: this.config.deviceId,
        token: session?.token,
        status: session ? "ready" : "idle",
        message: session ? "CLI 已连接团队后台" : "CLI 尚未登录团队后台",
      },
    };
  }

  protected async ensureSession() {
    if (this.session && new Date(this.session.expiresAt).getTime() > Date.now() + 60_000) return this.session;
    this.session = await loginToWorkspace(this.backendState().backend, this.config.email, this.config.password);
    return this.session;
  }

  protected async authenticatedState() {
    const session = await this.ensureSession();
    const base = this.backendState(session);
    const workspaces = await fetchWorkspaces(base.backend, session.token);
    const auth = {
      ...base.auth,
      status: "authenticated" as const,
      token: session.token,
      expiresAt: session.expiresAt,
      account: session.account,
      workspace: session.workspace,
      membership: session.membership,
      workspaces: workspaces.workspaces,
      workspaceMemberships: workspaces.memberships,
      bootstrapped: true,
      message: "CLI 已登录团队后台",
    };
    const local = bindAccountToMembers({ ...base, auth }, auth);
    return bindAccountToMembers(await loadTeamData(local), auth);
  }

  private async writeState(before: AppState, nextState: AppState) {
    const session = await this.ensureSession();
    const timestamp = new Date().toISOString();
    const stateToSave = {
      ...nextState,
      auth: {
        ...nextState.auth,
        status: "authenticated" as const,
        token: session.token,
        expiresAt: session.expiresAt,
        account: session.account,
        workspace: session.workspace,
        membership: session.membership,
      },
      backend: {
        ...nextState.backend,
        serverUrl: this.config.serverUrl,
        username: session.account.email,
        deviceId: this.config.deviceId,
        token: session.token,
        lastSavedAt: timestamp,
        status: "ready" as const,
        message: "CLI 已写入团队后台",
      },
      updatedAt: timestamp,
    };
    return saveTeamDataChanges(stateToSave.backend, session.token, before, stateToSave);
  }

  protected async mutate<T>(_preferredProjectId: string | undefined, fn: StateMutation<T>) {
    const timestamp = new Date().toISOString();
    const before = await this.authenticatedState();
    const output = fn(before, timestamp);
    const saved = await this.writeState(before, output.state);
    return { state: saved, result: output.result, savedAt: saved.backend.lastSavedAt };
  }

  protected async backendAndToken() {
    const session = await this.ensureSession();
    return { backend: this.backendState(session).backend, token: session.token, session };
  }

  protected setSession(session: AuthSession) {
    this.session = session;
  }

  async health() {
    const status = await getAuthStatus(this.config.serverUrl);
    return {
      ok: true,
      serverUrl: this.config.serverUrl,
      bootstrapped: status.bootstrapped,
      workspaceId: status.workspace_id,
      workspaceName: status.workspace_name,
    };
  }

  async getBackendDiagnostics() {
    const session = await this.ensureSession();
    const state = await this.authenticatedState();
    return {
      serverUrl: this.config.serverUrl,
      deviceId: this.config.deviceId,
      account: {
        id: session.account.id,
        email: session.account.email,
        name: session.account.name,
      },
      workspace: state.auth.workspace,
      counts: {
        workspaces: state.auth.workspaces?.length ?? 0,
        workspaceMemberships: state.auth.workspaceMemberships?.length ?? 0,
        projects: state.projects.length,
        projectMembers: state.projectMembers.length,
        tasks: state.tasks.length,
        dailyPlans: state.dailyPlans.length,
        workSessions: state.workSessions.length,
        executionSignals: state.executionSignals.length,
        interruptions: state.interruptions.length,
        taskTemplates: state.taskTemplates.length,
      },
      backend: {
        lastLoadedAt: state.backend.lastLoadedAt,
        lastSavedAt: state.backend.lastSavedAt,
        status: state.backend.status,
        message: state.backend.message,
      },
    };
  }

  async getCurrentAccount() {
    const state = await this.authenticatedState();
    return {
      account: state.auth.account,
      workspace: state.auth.workspace,
      membership: state.auth.membership,
    };
  }

  async listWorkspaces() {
    const { backend, token } = await this.backendAndToken();
    return fetchWorkspaces(backend, token);
  }

  async switchWorkspace(workspaceId: string) {
    const { backend, token, session } = await this.backendAndToken();
    this.setSession(await switchWorkspace(backend, token, workspaceId, session.account.revision));
    return this.getCurrentAccount();
  }

  async createWorkspace(name: string) {
    const { backend, token } = await this.backendAndToken();
    this.setSession(await createWorkspace(backend, token, name));
    return this.getCurrentAccount();
  }

  async updateWorkspace(workspaceId: string, input: WorkspaceUpdateInput) {
    const { backend, token } = await this.backendAndToken();
    const workspace = (await fetchWorkspaces(backend, token)).workspaces.find((item) => item.id === workspaceId);
    return updateWorkspace(backend, token, workspaceId, { ...input, expectedRevision: input.expectedRevision ?? workspace?.revision });
  }

  async updateWorkspaceMembership(workspaceId: string, membershipId: string, input: WorkspaceMembershipUpdateInput) {
    const { backend, token } = await this.backendAndToken();
    const membership = (await fetchWorkspaces(backend, token)).memberships.find((item) => item.id === membershipId);
    return updateWorkspaceMembership(backend, token, workspaceId, membershipId, { ...input, expectedRevision: input.expectedRevision ?? membership?.revision });
  }

  async listPlatformAccounts() {
    const { backend, token } = await this.backendAndToken();
    return fetchPlatformAccounts(backend, token);
  }

  async createPlatformAccount(input: Required<Pick<PlatformAccountPayload, "name" | "email" | "password">> & Pick<PlatformAccountPayload, "status">) {
    const { backend, token } = await this.backendAndToken();
    return createPlatformAccount(backend, token, input);
  }

  async updatePlatformAccount(accountId: string, input: PlatformAccountPayload) {
    const { backend, token } = await this.backendAndToken();
    const account = (await fetchPlatformAccounts(backend, token)).find((item) => item.id === accountId);
    return updatePlatformAccount(backend, token, accountId, { ...input, expectedRevision: input.expectedRevision ?? account?.revision });
  }

  async disablePlatformAccount(accountId: string) {
    return this.updatePlatformAccount(accountId, { status: "disabled" });
  }

  async updatePlatformAccountPassword(accountId: string, password: string) {
    return this.updatePlatformAccount(accountId, { password });
  }

  async listWorkspaceInvitations() {
    const { backend, token } = await this.backendAndToken();
    return fetchWorkspaceInvitations(backend, token);
  }

  async inviteWorkspaceMember(workspaceId: string, email: string) {
    const { backend, token } = await this.backendAndToken();
    return inviteWorkspaceMember(backend, token, workspaceId, email);
  }

  async acceptWorkspaceInvitation(invitationId: string) {
    const { backend, token } = await this.backendAndToken();
    return acceptWorkspaceInvitation(backend, token, invitationId);
  }

  async deleteWorkspaceInvitation(invitationId: string) {
    const { backend, token } = await this.backendAndToken();
    return deleteWorkspaceInvitation(backend, token, invitationId);
  }

  async listProjectInvitations() {
    const { backend, token } = await this.backendAndToken();
    return fetchProjectInvitations(backend, token);
  }

  async inviteProjectMember(input: { workspaceId?: string; projectId: string; email: string; roles: ProjectMemberRole[] }) {
    const { backend, token } = await this.backendAndToken();
    return inviteProjectMember(backend, token, input);
  }

  async acceptProjectInvitation(invitationId: string) {
    const { backend, token } = await this.backendAndToken();
    return acceptProjectInvitation(backend, token, invitationId);
  }

  async deleteProjectInvitation(invitationId: string) {
    const { backend, token } = await this.backendAndToken();
    return deleteProjectInvitation(backend, token, invitationId);
  }

  async createMemberAccount(input: MemberAccountPayload) {
    const { backend, token } = await this.backendAndToken();
    return createMemberAccount(backend, token, input);
  }

  async updateMemberAccount(memberId: string, input: Partial<Omit<MemberAccountPayload, "projectId">>) {
    const state = await this.authenticatedState();
    const member = state.projectMembers.find((item) => item.id === memberId);
    const project = member ? state.projects.find((item) => item.id === member.projectId) : undefined;
    const workspaceId = input.workspaceId ?? project?.workspaceId ?? state.auth.workspace?.id ?? "";
    const revision = state.backend.businessRowRevisions?.[`${workspaceId}:project_member:${memberId}`];
    return updateMemberAccount(state.backend, state.auth.token ?? state.backend.token ?? "", memberId, {
      ...input,
      workspaceId,
      expectedRevision: input.expectedRevision ?? revision,
    });
  }
}
