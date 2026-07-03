import { useMemo, useState } from "react";
import type { ProjectOverviewCard } from "../../projectOverview";
import type {
  Account,
  Project,
  TaskStageMode,
  Workspace,
  WorkspaceMembership,
  WorkspaceMembershipUpdateInput,
  WorkspaceUpdateInput,
} from "../../types";
import { buildWorkspaceDirectoryCards, type WorkspaceModalState } from "./workspaceDirectoryModel";
import { useWorkspaceDirectoryModalState } from "./useWorkspaceDirectoryModalState";
import { useWorkspaceProjectDrafts } from "./useWorkspaceProjectDrafts";

export type WorkspaceDirectoryViewProps = {
  projects: Project[];
  workspaces: Workspace[];
  workspaceMemberships: WorkspaceMembership[];
  currentAccount?: Account;
  projectCards: ProjectOverviewCard[];
  createWorkspace: (name: string) => void;
  updateWorkspace: (workspaceId: string, input: WorkspaceUpdateInput) => Promise<boolean>;
  updateWorkspaceMembership: (workspaceId: string, membershipId: string, input: WorkspaceMembershipUpdateInput) => Promise<boolean>;
  inviteWorkspaceMember: (workspaceId: string, email: string) => void;
  createProject: (name: string, description: string, workspaceId?: string, taskStageMode?: TaskStageMode) => void;
  openProjectDetail: (projectId: string) => void;
};

export function useWorkspaceDirectoryController({
  projects,
  workspaces,
  workspaceMemberships,
  currentAccount,
  projectCards,
  createWorkspace,
  updateWorkspace,
  updateWorkspaceMembership,
  createProject,
}: WorkspaceDirectoryViewProps) {
  const [workspaceDraft, setWorkspaceDraft] = useState("");

  const projectsById = useMemo(() => new Map(projects.map((project) => [project.id, project])), [projects]);
  const directoryCards = useMemo(
    () => buildWorkspaceDirectoryCards({ workspaces, workspaceMemberships, currentAccount, projectCards }),
    [workspaces, workspaceMemberships, currentAccount, projectCards],
  );
  const modal = useWorkspaceDirectoryModalState({
    workspaces,
    workspaceMemberships,
    currentAccount,
    directoryCards,
    updateWorkspace,
    updateWorkspaceMembership,
  });
  const projectDrafts = useWorkspaceProjectDrafts({ selectedCard: modal.selectedCard, createProject });

  const submitWorkspace = () => {
    const name = workspaceDraft.trim();
    if (!name) return;
    createWorkspace(name);
    setWorkspaceDraft("");
  };

  const openWorkspaceModal = (workspaceId: string, kind: WorkspaceModalState["kind"]) => {
    modal.openWorkspaceModal(workspaceId, kind);
    projectDrafts.setProjectDraftWarning("");
  };

  const closeModal = () => {
    modal.closeModal();
    projectDrafts.setProjectDraftWarning("");
  };

  return {
    workspaceDraft,
    setWorkspaceDraft,
    projectDraft: projectDrafts.projectDraft,
    setProjectDraft: projectDrafts.setProjectDraft,
    projectDraftWarning: projectDrafts.projectDraftWarning,
    setProjectDraftWarning: projectDrafts.setProjectDraftWarning,
    workspaceEditDraft: modal.workspaceEditDraft,
    setWorkspaceEditDraft: modal.setWorkspaceEditDraft,
    workspaceEditWarning: modal.workspaceEditWarning,
    setWorkspaceEditWarning: modal.setWorkspaceEditWarning,
    projectsById,
    directoryCards,
    selectedCard: modal.selectedCard,
    selectedMembers: modal.selectedMembers,
    selectedWorkspaceType: modal.selectedWorkspaceType,
    selectedOwnerAccountId: modal.selectedOwnerAccountId,
    selectedMemberDraft: modal.selectedMemberDraft,
    activeModal: modal.activeModal,
    canEditSelectedWorkspace: modal.canEditSelectedWorkspace,
    canChangeSelectedWorkspaceType: modal.canChangeSelectedWorkspaceType,
    canChangeSelectedWorkspaceOwner: modal.canChangeSelectedWorkspaceOwner,
    openWorkspaceModal,
    closeModal,
    submitWorkspace,
    submitProject: projectDrafts.submitProject,
    startWorkspaceEdit: modal.startWorkspaceEdit,
    saveWorkspaceEdit: modal.saveWorkspaceEdit,
    updateWorkspaceMemberRole: modal.updateWorkspaceMemberRole,
    unbindWorkspaceMember: modal.unbindWorkspaceMember,
    updateWorkspaceMemberDraft: modal.updateWorkspaceMemberDraft,
  };
}
