import {
  fetchWorkspaceRestrictionImpact,
  updateWorkspace as updateWorkspaceDetails,
  updateWorkspaceMembership as updateWorkspaceMembershipDetails,
} from "./teamBackend";
import { tokenForState } from "./workspaceAccountMetadata";
import type { WorkspaceAccountRuntime, WorkspaceAccountRuntimeOptions } from "./workspaceAccountTypes";
import { loadStateWithFreshWorkspaces } from "./workspaceRuntimeState";
import type { WorkspaceMembershipUpdateInput, WorkspaceUpdateInput } from "./types";

type WorkspaceMutationRuntime = Pick<
  WorkspaceAccountRuntime,
  "updateWorkspace" | "updateWorkspaceMembership"
>;

type WorkspaceMutationRuntimeOptions = Pick<
  WorkspaceAccountRuntimeOptions,
  "getState" | "setState" | "setToast"
>;

export function createWorkspaceMutationRuntime({
  getState,
  setState,
  setToast,
}: WorkspaceMutationRuntimeOptions): WorkspaceMutationRuntime {
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
      const currentWorkspace = source.auth.workspaces?.find((item) => item.id === workspaceId);
      let confirmRestrictMembers = input.confirmRestrictMembers;
      if (currentWorkspace?.type === "shared" && input.type === "private" && !confirmRestrictMembers) {
        const impact = await fetchWorkspaceRestrictionImpact(source.backend, token, workspaceId);
        confirmRestrictMembers = window.confirm(
          `转为私人工作区将停用 ${impact.activeMembers} 名成员并取消 ${impact.pendingInvitations} 个待处理邀请，是否继续？`,
        );
        if (!confirmRestrictMembers) return false;
      }
      const updatedWorkspace = await updateWorkspaceDetails(source.backend, token, workspaceId, {
        name,
        type: input.type,
        ownerAccountId: input.ownerAccountId,
        confirmRestrictMembers,
      });
      const loaded = await loadStateWithFreshWorkspaces(source, token, updatedWorkspace);
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
      await updateWorkspaceMembershipDetails(source.backend, token, workspaceId, membershipId, input);
      const loaded = await loadStateWithFreshWorkspaces(source, token);
      setState(loaded);
      setToast(input.status === "disabled" ? "工作区成员已解除绑定" : "工作区成员已更新");
      return true;
    } catch (error) {
      setToast(error instanceof Error ? error.message : "工作区成员更新失败");
      return false;
    }
  };

  return {
    updateWorkspace,
    updateWorkspaceMembership,
  };
}
