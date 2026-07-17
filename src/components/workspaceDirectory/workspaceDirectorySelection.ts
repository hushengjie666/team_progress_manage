import { visibleWorkspaceMembers } from "../../accessControl";
import type { Account, WorkspaceMembership } from "../../types";
import { inferWorkspaceOwnerAccountId, type WorkspaceDirectoryCard, type WorkspaceModalState } from "./workspaceDirectoryModel";

export type WorkspaceMemberDrafts = Record<string, { email: string }>;

export const buildWorkspaceDirectorySelection = ({
  activeModal,
  directoryCards,
  workspaceMemberships,
  currentAccount,
  workspaceMemberDrafts,
}: {
  activeModal: WorkspaceModalState | null;
  directoryCards: WorkspaceDirectoryCard[];
  workspaceMemberships: WorkspaceMembership[];
  currentAccount?: Account;
  workspaceMemberDrafts: WorkspaceMemberDrafts;
}) => {
  const selectedCard = directoryCards.find((card) => card.workspace.id === activeModal?.workspaceId);
  const selectedAllMembers = selectedCard
    ? visibleWorkspaceMembers(selectedCard.workspace, workspaceMemberships, currentAccount)
    : [];
  const selectedMembers = selectedAllMembers.filter((member) => member.status === "active");
  const selectedWorkspaceType = selectedCard?.workspace.type ?? "shared";
  const selectedCurrentMembership = selectedAllMembers.find((membership) => membership.accountId === currentAccount?.id);
  const selectedCurrentMembershipIsActive = selectedCurrentMembership?.status === "active";
  const canEditSelectedWorkspace = Boolean(selectedCurrentMembershipIsActive);
  const canManageSelectedWorkspaceMembers = Boolean(
    selectedCurrentMembershipIsActive &&
    (selectedCurrentMembership?.role === "owner" || selectedCurrentMembership?.role === "admin"),
  );
  const canChangeSelectedWorkspaceType = Boolean(
    selectedCurrentMembershipIsActive && selectedCurrentMembership?.role === "owner" && selectedWorkspaceType !== "private",
  );
  const canChangeSelectedWorkspaceOwner = Boolean(
    selectedCurrentMembershipIsActive && selectedCurrentMembership?.role === "owner" && selectedWorkspaceType === "shared",
  );
  const selectedOwnerAccountId = selectedCard
    ? inferWorkspaceOwnerAccountId(selectedCard.workspace, selectedAllMembers, currentAccount?.id)
    : "";
  const selectedMemberDraft = selectedCard ? workspaceMemberDrafts[selectedCard.workspace.id] ?? { email: "" } : { email: "" };

  return {
    selectedCard,
    selectedMembers,
    selectedWorkspaceType,
    selectedOwnerAccountId,
    selectedMemberDraft,
    canEditSelectedWorkspace,
    canManageSelectedWorkspaceMembers,
    canChangeSelectedWorkspaceType,
    canChangeSelectedWorkspaceOwner,
  };
};
