import type { Account, WorkspaceMembership, WorkspaceType, WorkspaceUpdateInput } from "../../types";
import type { WorkspaceDirectoryCard } from "./workspaceDirectoryModel";
import {
  canUnbindWorkspaceMember,
  updateWorkspaceMemberDrafts,
  workspaceEditDraftFor,
  workspaceEditSaveInput,
  workspaceOwnerSelectionDraft,
  workspaceOwnerSelectionInput,
  type WorkspaceEditWarning,
} from "./workspaceDirectoryModalModel";
import type { WorkspaceMemberDrafts } from "./workspaceDirectorySelection";

type Setter<T> = (value: T | ((current: T) => T)) => void;

type WorkspaceDirectoryModalActionOptions = {
  selectedCard?: WorkspaceDirectoryCard;
  selectedMembers: WorkspaceMembership[];
  selectedWorkspaceType: WorkspaceType;
  selectedOwnerAccountId: string;
  canEditSelectedWorkspace: boolean;
  canChangeSelectedWorkspaceOwner: boolean;
  currentAccount?: Account;
  workspaceEditDraft: WorkspaceUpdateInput;
  setWorkspaceEditDraft: Setter<WorkspaceUpdateInput>;
  setWorkspaceEditWarning: Setter<WorkspaceEditWarning>;
  setWorkspaceMemberDrafts: Setter<WorkspaceMemberDrafts>;
  updateWorkspace: (workspaceId: string, input: WorkspaceUpdateInput) => Promise<boolean>;
  updateWorkspaceMembership: (workspaceId: string, membershipId: string, input: { status: WorkspaceMembership["status"] }) => Promise<boolean>;
};

export function createWorkspaceDirectoryModalActions({
  selectedCard,
  selectedMembers,
  selectedWorkspaceType,
  selectedOwnerAccountId,
  canEditSelectedWorkspace,
  canChangeSelectedWorkspaceOwner,
  currentAccount,
  workspaceEditDraft,
  setWorkspaceEditDraft,
  setWorkspaceEditWarning,
  setWorkspaceMemberDrafts,
  updateWorkspace,
  updateWorkspaceMembership,
}: WorkspaceDirectoryModalActionOptions) {
  const startWorkspaceEdit = () => {
    if (!selectedCard) return;
    setWorkspaceEditDraft(workspaceEditDraftFor(selectedCard.workspace, selectedMembers, currentAccount));
    setWorkspaceEditWarning({});
  };

  const saveWorkspaceEdit = async () => {
    if (!selectedCard) return;
    const { input, warning } = workspaceEditSaveInput({
      draft: workspaceEditDraft,
      selectedWorkspaceType,
      selectedOwnerAccountId,
    });
    if (!input) {
      setWorkspaceEditWarning(warning ?? {});
      return;
    }
    const saved = await updateWorkspace(selectedCard.workspace.id, input);
    if (saved) setWorkspaceEditWarning({});
  };

  const selectWorkspaceOwner = async (accountId: string, checked: boolean) => {
    if (!selectedCard || !checked || accountId === selectedOwnerAccountId || !canChangeSelectedWorkspaceOwner) return;
    setWorkspaceEditDraft(workspaceOwnerSelectionDraft({
      draft: workspaceEditDraft,
      selectedCard,
      selectedWorkspaceType,
      ownerAccountId: accountId,
    }));
    await updateWorkspace(selectedCard.workspace.id, workspaceOwnerSelectionInput({
      draft: workspaceEditDraft,
      selectedCard,
      selectedWorkspaceType,
      ownerAccountId: accountId,
    }));
  };

  const unbindWorkspaceMember = async (member: WorkspaceMembership) => {
    if (!selectedCard || !canUnbindWorkspaceMember({
      member,
      selectedOwnerAccountId,
      currentAccount,
      canEditSelectedWorkspace,
      selectedWorkspaceType,
    })) {
      return;
    }
    await updateWorkspaceMembership(selectedCard.workspace.id, member.id, { status: "disabled" });
  };

  const updateWorkspaceMemberDraft = (workspaceId: string, patch: Partial<{ email: string }>) => {
    setWorkspaceMemberDrafts((current) => updateWorkspaceMemberDrafts(current, workspaceId, patch));
  };

  return {
    startWorkspaceEdit,
    saveWorkspaceEdit,
    selectWorkspaceOwner,
    unbindWorkspaceMember,
    updateWorkspaceMemberDraft,
  };
}
