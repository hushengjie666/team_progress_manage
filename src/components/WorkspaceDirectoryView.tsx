import { WorkspaceDirectoryHome } from "./workspaceDirectory/WorkspaceDirectoryHome";
import { WorkspaceMembersModal } from "./workspaceDirectory/WorkspaceMembersModal";
import { WorkspaceProjectsModal } from "./workspaceDirectory/WorkspaceProjectsModal";
import {
  useWorkspaceDirectoryController,
  type WorkspaceDirectoryViewProps,
} from "./workspaceDirectory/useWorkspaceDirectoryController";

export { countActiveWorkspaceMembers, workspaceTypeForEditSave } from "./workspaceDirectory/workspaceDirectoryModel";

export function WorkspaceDirectoryView(props: WorkspaceDirectoryViewProps) {
  const {
    currentAccount,
    inviteWorkspaceMember,
    openProjectDetail,
  } = props;
  const directory = useWorkspaceDirectoryController(props);

  return (
    <div className="workspace-directory-layout">
      <WorkspaceDirectoryHome
        workspaceDraft={directory.workspaceDraft}
        setWorkspaceDraft={directory.setWorkspaceDraft}
        submitWorkspace={directory.submitWorkspace}
        directoryCards={directory.directoryCards}
        openWorkspaceModal={directory.openWorkspaceModal}
      />

      {directory.selectedCard && directory.activeModal?.kind === "projects" && (
        <WorkspaceProjectsModal
          selectedCard={directory.selectedCard}
          projectsById={directory.projectsById}
          projectDraft={directory.projectDraft}
          setProjectDraft={directory.setProjectDraft}
          projectDraftWarning={directory.projectDraftWarning}
          setProjectDraftWarning={directory.setProjectDraftWarning}
          submitProject={directory.submitProject}
          projectEditDraftFor={directory.projectEditDraftFor}
          updateProjectEditDraft={directory.updateProjectEditDraft}
          projectEditWarnings={directory.projectEditWarnings}
          saveProjectEdit={directory.saveProjectEdit}
          openProjectDetail={openProjectDetail}
          closeModal={directory.closeModal}
        />
      )}

      {directory.selectedCard && directory.activeModal?.kind === "members" && (
        <WorkspaceMembersModal
          selectedCard={directory.selectedCard}
          currentAccount={currentAccount}
          selectedMembers={directory.selectedMembers}
          selectedWorkspaceType={directory.selectedWorkspaceType}
          selectedOwnerAccountId={directory.selectedOwnerAccountId}
          editingOwnerAccountId={directory.editingOwnerAccountId}
          selectedMemberDraft={directory.selectedMemberDraft}
          workspaceEditDraft={directory.workspaceEditDraft}
          setWorkspaceEditDraft={directory.setWorkspaceEditDraft}
          workspaceEditWarning={directory.workspaceEditWarning}
          setWorkspaceEditWarning={directory.setWorkspaceEditWarning}
          canEditSelectedWorkspace={directory.canEditSelectedWorkspace}
          canChangeSelectedWorkspaceType={directory.canChangeSelectedWorkspaceType}
          canChangeSelectedWorkspaceOwner={directory.canChangeSelectedWorkspaceOwner}
          startWorkspaceEdit={directory.startWorkspaceEdit}
          saveWorkspaceEdit={directory.saveWorkspaceEdit}
          selectWorkspaceOwner={directory.selectWorkspaceOwner}
          updateWorkspaceMemberDraft={directory.updateWorkspaceMemberDraft}
          inviteWorkspaceMember={inviteWorkspaceMember}
          unbindWorkspaceMember={directory.unbindWorkspaceMember}
          closeModal={directory.closeModal}
        />
      )}
    </div>
  );
}
