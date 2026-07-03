import {
  acceptProjectInvitation,
  acceptWorkspaceInvitation,
  inviteProjectMember as sendProjectInvitation,
  inviteWorkspaceMember as sendWorkspaceInvitation,
} from "./sync";
import type { ProjectMemberRole } from "./types";
import { tokenForState } from "./workspaceAccountMetadata";
import type { WorkspaceAccountRuntimeOptions } from "./workspaceAccountTypes";
import { loadStateWithFreshWorkspaces } from "./workspaceRuntimeState";
import type { createWorkspaceInvitationRefreshers } from "./workspaceInvitationRefresh";

type WorkspaceInvitationRefreshers = ReturnType<typeof createWorkspaceInvitationRefreshers>;

type WorkspaceInvitationCommandOptions = Pick<
  WorkspaceAccountRuntimeOptions,
  "getState" | "setState" | "setToast"
> & WorkspaceInvitationRefreshers;

export function createWorkspaceInvitationCommands({
  getState,
  setState,
  setToast,
  refreshWorkspaceInvitations,
  refreshProjectInvitations,
}: WorkspaceInvitationCommandOptions) {
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

  const acceptPendingWorkspaceInvitation = (invitationId: string) => {
    const source = getState();
    const token = tokenForState(source);
    if (!source || !token) {
      setToast("请先登录后台后再处理邀请");
      return;
    }
    void acceptWorkspaceInvitation(source.sync, token, invitationId)
      .then(async (invitation) => {
        const loaded = await loadStateWithFreshWorkspaces(source, token);
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
        const loaded = await loadStateWithFreshWorkspaces(source, token);
        setState(loaded);
        await refreshProjectInvitations(loaded);
        setToast(`已加入项目 ${invitation.projectName}`);
      })
      .catch((error) => {
        setToast(error instanceof Error ? error.message : "项目邀请处理失败");
      });
  };

  return {
    inviteWorkspaceMember,
    inviteProjectMember,
    acceptPendingWorkspaceInvitation,
    acceptPendingProjectInvitation,
  };
}
