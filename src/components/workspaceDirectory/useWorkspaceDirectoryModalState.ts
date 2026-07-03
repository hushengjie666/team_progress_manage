import { useMemo, useState } from "react";
import type { Account, Workspace, WorkspaceMembership, WorkspaceMembershipUpdateInput, WorkspaceUpdateInput } from "../../types";
import {
  type WorkspaceDirectoryCard,
  type WorkspaceModalState,
} from "./workspaceDirectoryModel";
import {
  emptyWorkspaceEditDraft,
  workspaceEditDraftFor,
  type WorkspaceEditWarning,
} from "./workspaceDirectoryModalModel";
import { createWorkspaceDirectoryModalActions } from "./workspaceDirectoryModalActions";
import { buildWorkspaceDirectorySelection, type WorkspaceMemberDrafts } from "./workspaceDirectorySelection";

export function useWorkspaceDirectoryModalState({
  workspaces,
  workspaceMemberships,
  currentAccount,
  directoryCards,
  updateWorkspace,
  updateWorkspaceMembership,
}: {
  workspaces: Workspace[];
  workspaceMemberships: WorkspaceMembership[];
  currentAccount?: Account;
  directoryCards: WorkspaceDirectoryCard[];
  updateWorkspace: (workspaceId: string, input: WorkspaceUpdateInput) => Promise<boolean>;
  updateWorkspaceMembership: (workspaceId: string, membershipId: string, input: WorkspaceMembershipUpdateInput) => Promise<boolean>;
}) {
  const [activeModal, setActiveModal] = useState<WorkspaceModalState | null>(null);
  const [workspaceEditDraft, setWorkspaceEditDraft] = useState<WorkspaceUpdateInput>(emptyWorkspaceEditDraft);
  const [workspaceEditWarning, setWorkspaceEditWarning] = useState<WorkspaceEditWarning>({});
  const [workspaceMemberDrafts, setWorkspaceMemberDrafts] = useState<WorkspaceMemberDrafts>({});

  const selection = useMemo(
    () => buildWorkspaceDirectorySelection({
      activeModal,
      directoryCards,
      workspaceMemberships,
      currentAccount,
      workspaceMemberDrafts,
    }),
    [activeModal, directoryCards, workspaceMemberships, currentAccount, workspaceMemberDrafts],
  );
  const {
    selectedCard,
    selectedMembers,
    selectedWorkspaceType,
    selectedOwnerAccountId,
    canEditSelectedWorkspace,
    canChangeSelectedWorkspaceOwner,
  } = selection;
  const actions = createWorkspaceDirectoryModalActions({
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
  });

  const openWorkspaceModal = (workspaceId: string, kind: WorkspaceModalState["kind"]) => {
    const workspace = workspaces.find((item) => item.id === workspaceId);
    const members = workspaceMemberships.filter((membership) => membership.workspaceId === workspaceId);
    setActiveModal({ workspaceId, kind });
    setWorkspaceEditWarning({});
    if (workspace) {
      setWorkspaceEditDraft(workspaceEditDraftFor(workspace, members, currentAccount));
    }
  };

  const closeModal = () => {
    setActiveModal(null);
    setWorkspaceEditWarning({});
    setWorkspaceEditDraft(emptyWorkspaceEditDraft());
  };

  return {
    activeModal,
    workspaceEditDraft,
    setWorkspaceEditDraft,
    workspaceEditWarning,
    setWorkspaceEditWarning,
    ...selection,
    openWorkspaceModal,
    closeModal,
    ...actions,
  };
}
