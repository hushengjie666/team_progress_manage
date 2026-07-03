import {
  acceptProjectInvitation,
  acceptWorkspaceInvitation,
  inviteProjectMember as sendProjectInvitation,
  inviteWorkspaceMember as sendWorkspaceInvitation,
} from "./sync";
import type { ProjectInvitation, ProjectMemberRole, WorkspaceInvitation } from "./types";
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
  const errorMessage = (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback;

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
        setToast(errorMessage(error, "工作区邀请发送失败"));
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
        setToast(errorMessage(error, "项目邀请发送失败"));
      });
  };

  const acceptPendingWorkspaceInvitation = (invitationId: string) => {
    const source = getState();
    const token = tokenForState(source);
    if (!source || !token) {
      setToast("请先登录后台后再处理邀请");
      return;
    }
    void (async () => {
      let invitation: WorkspaceInvitation;
      try {
        invitation = await acceptWorkspaceInvitation(source.sync, token, invitationId);
      } catch (error) {
        setToast(errorMessage(error, "工作区邀请处理失败"));
        return;
      }
      try {
        const loaded = await loadStateWithFreshWorkspaces(source, token);
        setState(loaded);
        await refreshWorkspaceInvitations(loaded);
        await refreshProjectInvitations(loaded);
        setToast(`已加入 ${invitation.workspaceName}`);
      } catch {
        setToast(`已加入 ${invitation.workspaceName}，刷新工作区数据失败，请刷新页面`);
      }
    })();
  };

  const acceptPendingProjectInvitation = (invitationId: string) => {
    const source = getState();
    const token = tokenForState(source);
    if (!source || !token) {
      setToast("请先登录后台后再处理邀请");
      return;
    }
    void (async () => {
      let invitation: ProjectInvitation;
      try {
        invitation = await acceptProjectInvitation(source.sync, token, invitationId);
      } catch (error) {
        setToast(errorMessage(error, "项目邀请处理失败"));
        return;
      }
      try {
        const loaded = await loadStateWithFreshWorkspaces(source, token);
        setState(loaded);
        await refreshProjectInvitations(loaded);
        setToast(`已加入项目 ${invitation.projectName}`);
      } catch {
        setToast(`已加入项目 ${invitation.projectName}，刷新项目数据失败，请刷新页面`);
      }
    })();
  };

  return {
    inviteWorkspaceMember,
    inviteProjectMember,
    acceptPendingWorkspaceInvitation,
    acceptPendingProjectInvitation,
  };
}
