import type { Account, Workspace, WorkspaceMembership, WorkspaceUpdateInput } from "../../types";
import {
  inferWorkspaceOwnerAccountId,
  workspaceTypeForEditSave,
} from "./workspaceDirectoryModel";
import type { WorkspaceMemberDrafts } from "./workspaceDirectorySelection";

export type WorkspaceEditWarning = { name?: string; owner?: string };

export const emptyWorkspaceEditDraft = (): WorkspaceUpdateInput => ({
  name: "",
  type: "shared",
  ownerAccountId: "",
});

export const workspaceEditDraftFor = (
  workspace: Workspace,
  members: WorkspaceMembership[],
  currentAccount?: Account,
): WorkspaceUpdateInput => ({
  name: workspace.name,
  type: workspace.type ?? "shared",
  ownerAccountId: inferWorkspaceOwnerAccountId(workspace, members, currentAccount?.id),
});

export const workspaceEditSaveInput = ({
  draft,
  selectedWorkspaceType,
  selectedOwnerAccountId,
}: {
  draft: WorkspaceUpdateInput;
  selectedWorkspaceType: WorkspaceUpdateInput["type"];
  selectedOwnerAccountId: string;
}): { input?: WorkspaceUpdateInput; warning?: WorkspaceEditWarning } => {
  const name = draft.name.trim();
  if (!name) return { warning: { name: "工作区名称不能为空" } };

  const ownerAccountId = draft.ownerAccountId?.trim() || selectedOwnerAccountId;

  return {
    input: {
      name,
      type: workspaceTypeForEditSave(selectedWorkspaceType, draft.type),
      ownerAccountId,
    },
  };
};

export const canUnbindWorkspaceMember = ({
  member,
  selectedOwnerAccountId,
  currentAccount,
  canEditSelectedWorkspace,
  selectedWorkspaceType,
}: {
  member: WorkspaceMembership;
  selectedOwnerAccountId: string;
  currentAccount?: Account;
  canEditSelectedWorkspace: boolean;
  selectedWorkspaceType: WorkspaceUpdateInput["type"];
}) => {
  if (!canEditSelectedWorkspace || selectedWorkspaceType === "private") return false;
  const isCreator = member.accountId === selectedOwnerAccountId;
  const isOwner = member.role === "owner";
  const isCurrentAccount = member.accountId === currentAccount?.id;
  return !isCreator && !isOwner && !isCurrentAccount;
};

export const updateWorkspaceMemberDrafts = (
  current: WorkspaceMemberDrafts,
  workspaceId: string,
  patch: Partial<{ email: string }>,
): WorkspaceMemberDrafts => {
  const previous = current[workspaceId] ?? { email: "" };
  return {
    ...current,
    [workspaceId]: { ...previous, ...patch },
  };
};
