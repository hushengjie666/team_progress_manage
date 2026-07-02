import { ensureTodayPlan } from "./appModel";
import {
  acceptProjectInvitation,
  acceptWorkspaceInvitation,
  fetchPlatformAccounts,
  fetchProjectInvitations,
  fetchWorkspaceInvitations,
  fetchWorkspaces,
  inviteProjectMember as sendProjectInvitation,
  inviteWorkspaceMember as sendWorkspaceInvitation,
  updateWorkspace as updateWorkspaceDetails,
  updateWorkspaceMembership as updateWorkspaceMembershipDetails,
  type AuthSession,
} from "./sync";
import { bindAccountToMembers } from "./authModel";
import { loadTeamState } from "./teamApi";
import type { Account, AppState, ProjectInvitation, ProjectMemberRole, WorkspaceInvitation, WorkspaceMembershipUpdateInput, WorkspaceUpdateInput } from "./types";

type SetState = (updater: AppState | null | ((current: AppState | null) => AppState | null)) => void;

export type WorkspaceAccountMetadata = {
  platformAccounts: Account[];
  workspaceInvitations: WorkspaceInvitation[];
  projectInvitations: ProjectInvitation[];
};

export type WorkspaceAccountRuntimeOptions = {
  getState: () => AppState | null;
  setState: SetState;
  setToast: (message: string) => void;
  setPlatformAccounts: (accounts: Account[]) => void;
  setWorkspaceInvitations: (invitations: WorkspaceInvitation[]) => void;
  setProjectInvitations: (invitations: ProjectInvitation[]) => void;
};

export type WorkspaceAccountRuntime = {
  refreshPlatformAccounts: (source?: AppState | null) => Promise<Account[]>;
  refreshWorkspaceInvitations: (source?: AppState | null) => Promise<WorkspaceInvitation[]>;
  refreshProjectInvitations: (source?: AppState | null) => Promise<ProjectInvitation[]>;
  inviteWorkspaceMember: (workspaceId: string, email: string) => void;
  inviteProjectMember: (input: { workspaceId?: string; projectId: string; email: string; roles: ProjectMemberRole[] }) => void;
  updateWorkspace: (workspaceId: string, input: WorkspaceUpdateInput) => Promise<boolean>;
  updateWorkspaceMembership: (workspaceId: string, membershipId: string, input: WorkspaceMembershipUpdateInput) => Promise<boolean>;
  acceptPendingWorkspaceInvitation: (invitationId: string) => void;
  acceptPendingProjectInvitation: (invitationId: string) => void;
};

export type WorkspaceSessionLoadOptions = {
  resetRuntime?: boolean;
};

export type WorkspaceSessionLoadResult = WorkspaceAccountMetadata & {
  state: AppState;
};

const tokenForState = (state?: AppState | null) => state?.auth.token ?? state?.sync.token;

export function isSuperAdminAccount(account?: Account) {
  return account?.id === "account_admin" || account?.email?.trim().toLowerCase() === "admin";
}

export async function loadWorkspaceAccountMetadata(state: AppState, token = tokenForState(state)): Promise<WorkspaceAccountMetadata> {
  if (!token) {
    return { platformAccounts: [], workspaceInvitations: [], projectInvitations: [] };
  }

  const [platformAccounts, workspaceInvitations, projectInvitations] = await Promise.all([
    isSuperAdminAccount(state.auth.account)
      ? fetchPlatformAccounts(state.sync, token).catch(() => [])
      : Promise.resolve([]),
    fetchWorkspaceInvitations(state.sync, token).catch(() => []),
    fetchProjectInvitations(state.sync, token).catch(() => []),
  ]);

  return { platformAccounts, workspaceInvitations, projectInvitations };
}

export async function loadAuthenticatedWorkspaceSession(
  source: AppState,
  session: AuthSession,
  message: string,
  options: WorkspaceSessionLoadOptions = {},
): Promise<WorkspaceSessionLoadResult> {
  const token = session.token;
  let managedWorkspaces = session.workspaces;
  let workspaceMemberships = source.auth.workspaceMemberships ?? [];
  try {
    const payload = await fetchWorkspaces(source.sync, token);
    managedWorkspaces = payload.workspaces;
    workspaceMemberships = payload.memberships;
  } catch {
    workspaceMemberships = source.auth.workspaceMemberships ?? [];
  }
  const base = options.resetRuntime
    ? {
        ...source,
        activeTimer: undefined,
      }
    : source;
  const bound = bindAccountToMembers(base, {
    status: "authenticated",
    token: session.token,
    expiresAt: session.expiresAt,
    account: session.account,
    workspace: session.workspace,
    membership: session.membership,
    workspaces: managedWorkspaces,
    workspaceMemberships,
    bootstrapped: true,
    message,
  });
  const metadata = await loadWorkspaceAccountMetadata(bound, token);
  return {
    state: ensureTodayPlan(await loadTeamState(bound)),
    platformAccounts: metadata.platformAccounts,
    workspaceInvitations: metadata.workspaceInvitations,
    projectInvitations: metadata.projectInvitations,
  };
}

export function createWorkspaceAccountRuntime({
  getState,
  setState,
  setToast,
  setPlatformAccounts,
  setWorkspaceInvitations,
  setProjectInvitations,
}: WorkspaceAccountRuntimeOptions): WorkspaceAccountRuntime {
  const refreshPlatformAccounts = async (source = getState()) => {
    const token = tokenForState(source);
    if (!source || !token || !isSuperAdminAccount(source.auth.account)) {
      setPlatformAccounts([]);
      return [];
    }
    const accounts = await fetchPlatformAccounts(source.sync, token);
    setPlatformAccounts(accounts);
    return accounts;
  };

  const refreshWorkspaceInvitations = async (source = getState()) => {
    const token = tokenForState(source);
    if (!source || !token) {
      setWorkspaceInvitations([]);
      return [];
    }
    const invitations = await fetchWorkspaceInvitations(source.sync, token);
    setWorkspaceInvitations(invitations);
    return invitations;
  };

  const refreshProjectInvitations = async (source = getState()) => {
    const token = tokenForState(source);
    if (!source || !token) {
      setProjectInvitations([]);
      return [];
    }
    const invitations = await fetchProjectInvitations(source.sync, token);
    setProjectInvitations(invitations);
    return invitations;
  };

  const inviteWorkspaceMember = (workspaceId: string, email: string) => {
    const source = getState();
    const token = tokenForState(source);
    const normalizedEmail = email.trim().toLowerCase();
    if (!source || !token) {
      setToast("请先登录后台后再发送邀请");
      return;
    }
    if (!workspaceId || !normalizedEmail) {
      setToast("请输入成员登录账号");
      return;
    }
    void sendWorkspaceInvitation(source.sync, token, workspaceId, normalizedEmail)
      .then((invitation) => {
        setToast(`已向 ${invitation.inviteeEmail} 发送工作区邀请`);
      })
      .catch((error) => {
        setToast(error instanceof Error ? error.message : "工作区邀请发送失败");
      });
  };

  const inviteProjectMember = (input: { workspaceId?: string; projectId: string; email: string; roles: ProjectMemberRole[] }) => {
    const source = getState();
    const token = tokenForState(source);
    const normalizedEmail = input.email.trim().toLowerCase();
    if (!source || !token) {
      setToast("请先登录后台后再发送邀请");
      return;
    }
    if (!input.projectId || !normalizedEmail) {
      setToast("请输入成员登录账号");
      return;
    }
    void sendProjectInvitation(source.sync, token, {
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      email: normalizedEmail,
      roles: input.roles.length ? input.roles : ["executor"],
    })
      .then((invitation) => {
        setToast(`已向 ${invitation.inviteeEmail} 发送项目邀请`);
      })
      .catch((error) => {
        setToast(error instanceof Error ? error.message : "项目邀请发送失败");
      });
  };

  const updateWorkspace = async (workspaceId: string, input: WorkspaceUpdateInput) => {
    const source = getState();
    const token = tokenForState(source);
    const name = input.name.trim();
    if (!source || !token) {
      setToast("请先登录后台后再编辑工作区");
      return false;
    }
    if (!workspaceId || !name) {
      setToast("工作区名称不能为空");
      return false;
    }
    try {
      const updatedWorkspace = await updateWorkspaceDetails(source.sync, token, workspaceId, {
        name,
        type: input.type,
        ownerAccountId: input.ownerAccountId,
      });
      const workspacePayload = await fetchWorkspaces(source.sync, token);
      const nextWithWorkspaces = {
        ...source,
        auth: {
          ...source.auth,
          workspace: source.auth.workspace?.id === updatedWorkspace.id ? updatedWorkspace : source.auth.workspace,
          workspaces: workspacePayload.workspaces,
          workspaceMemberships: workspacePayload.memberships,
        },
      };
      const loaded = ensureTodayPlan(await loadTeamState(nextWithWorkspaces));
      setState(loaded);
      setToast("工作区已更新");
      return true;
    } catch (error) {
      setToast(error instanceof Error ? error.message : "工作区更新失败");
      return false;
    }
  };

  const updateWorkspaceMembership = async (workspaceId: string, membershipId: string, input: WorkspaceMembershipUpdateInput) => {
    const source = getState();
    const token = tokenForState(source);
    if (!source || !token) {
      setToast("请先登录后台后再编辑工作区成员");
      return false;
    }
    if (!workspaceId || !membershipId) {
      setToast("请选择要操作的工作区成员");
      return false;
    }
    try {
      await updateWorkspaceMembershipDetails(source.sync, token, workspaceId, membershipId, input);
      const workspacePayload = await fetchWorkspaces(source.sync, token);
      const nextWithWorkspaces = {
        ...source,
        auth: {
          ...source.auth,
          workspaces: workspacePayload.workspaces,
          workspaceMemberships: workspacePayload.memberships,
        },
      };
      const loaded = ensureTodayPlan(await loadTeamState(nextWithWorkspaces));
      setState(loaded);
      setToast(input.status === "disabled" ? "工作区成员已解除绑定" : "工作区成员已更新");
      return true;
    } catch (error) {
      setToast(error instanceof Error ? error.message : "工作区成员更新失败");
      return false;
    }
  };

  const acceptPendingWorkspaceInvitation = (invitationId: string) => {
    const source = getState();
    const token = tokenForState(source);
    if (!source || !token) {
      setToast("请先登录后台后再处理邀请");
      return;
    }
    void acceptWorkspaceInvitation(source.sync, token, invitationId)
      .then(async (invitation) => {
        const workspacePayload = await fetchWorkspaces(source.sync, token);
        const nextWithWorkspaces = {
          ...source,
          auth: {
            ...source.auth,
            workspaces: workspacePayload.workspaces,
            workspaceMemberships: workspacePayload.memberships,
          },
        };
        const loaded = ensureTodayPlan(await loadTeamState(nextWithWorkspaces));
        setState(loaded);
        await refreshWorkspaceInvitations(loaded);
        await refreshProjectInvitations(loaded);
        setToast(`已加入 ${invitation.workspaceName}`);
      })
      .catch((error) => {
        setToast(error instanceof Error ? error.message : "工作区邀请处理失败");
      });
  };

  const acceptPendingProjectInvitation = (invitationId: string) => {
    const source = getState();
    const token = tokenForState(source);
    if (!source || !token) {
      setToast("请先登录后台后再处理邀请");
      return;
    }
    void acceptProjectInvitation(source.sync, token, invitationId)
      .then(async (invitation) => {
        const workspacePayload = await fetchWorkspaces(source.sync, token);
        const nextWithWorkspaces = {
          ...source,
          auth: {
            ...source.auth,
            workspaces: workspacePayload.workspaces,
            workspaceMemberships: workspacePayload.memberships,
          },
        };
        const loaded = ensureTodayPlan(await loadTeamState(nextWithWorkspaces));
        setState(loaded);
        await refreshProjectInvitations(loaded);
        setToast(`已加入项目 ${invitation.projectName}`);
      })
      .catch((error) => {
        setToast(error instanceof Error ? error.message : "项目邀请处理失败");
      });
  };

  return {
    refreshPlatformAccounts,
    refreshWorkspaceInvitations,
    refreshProjectInvitations,
    inviteWorkspaceMember,
    inviteProjectMember,
    updateWorkspace,
    updateWorkspaceMembership,
    acceptPendingWorkspaceInvitation,
    acceptPendingProjectInvitation,
  };
}
