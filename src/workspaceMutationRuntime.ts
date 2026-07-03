import {
  updateWorkspace as updateWorkspaceDetails,
  updateWorkspaceMembership as updateWorkspaceMembershipDetails,
} from "./sync";
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
      const updatedWorkspace = await updateWorkspaceDetails(source.sync, token, workspaceId, {
        name,
        type: input.type,
        ownerAccountId: input.ownerAccountId,
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
      await updateWorkspaceMembershipDetails(source.sync, token, workspaceId, membershipId, input);
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
