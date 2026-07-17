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
import { loadTeamData } from "../../src/teamApi.js";
import { submitTeamDomainCommand, type TeamDomainCommand } from "../../src/teamDomainCommands.js";
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

  protected async runBusinessCommand(command: TeamDomainCommand) {
    const session = await this.ensureSession();
    const before = await this.authenticatedState();
    await submitTeamDomainCommand(before.backend, session.token, command);
    const savedAt = new Date().toISOString();
    const state = await loadTeamData({
      ...before,
      backend: { ...before.backend, lastSavedAt: savedAt },
    });
    return { state, savedAt };
  }

  protected async prepareMutation<T>(fn: StateMutation<T>) {
    const before = await this.authenticatedState();
    return { before, output: fn(before, new Date().toISOString()) };
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
    const { backend, token } = await this.backendAndToken();
    this.setSession(await switchWorkspace(backend, token, workspaceId));
    return this.getCurrentAccount();
  }

  async createWorkspace(name: string) {
    const { backend, token } = await this.backendAndToken();
    this.setSession(await createWorkspace(backend, token, name));
    return this.getCurrentAccount();
  }

  async updateWorkspace(workspaceId: string, input: WorkspaceUpdateInput) {
    const { backend, token } = await this.backendAndToken();
    return updateWorkspace(backend, token, workspaceId, input);
  }

  async updateWorkspaceMembership(workspaceId: string, membershipId: string, input: WorkspaceMembershipUpdateInput) {
    const { backend, token } = await this.backendAndToken();
    return updateWorkspaceMembership(backend, token, workspaceId, membershipId, input);
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
    return updatePlatformAccount(backend, token, accountId, input);
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
    return updateMemberAccount(state.backend, state.auth.token ?? state.backend.token ?? "", memberId, {
      ...input,
      workspaceId,
    });
  }
}
