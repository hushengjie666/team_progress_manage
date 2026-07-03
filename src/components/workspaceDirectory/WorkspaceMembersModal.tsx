import type { Dispatch, SetStateAction } from "react";
import { X } from "lucide-react";
import type { Account, WorkspaceMembership, WorkspaceType, WorkspaceUpdateInput } from "../../types";
import type { WorkspaceDirectoryCard } from "./workspaceDirectoryModel";
import { workspaceTypeLabel } from "./workspaceDirectoryModel";
import { WorkspaceEditForm } from "./WorkspaceEditForm";
import { WorkspaceMemberListPanel } from "./WorkspaceMemberListPanel";
import type { WorkspaceEditWarning } from "./workspaceDirectoryModalModel";

type WorkspaceMembersModalProps = {
  selectedCard: WorkspaceDirectoryCard;
  currentAccount?: Account;
  selectedMembers: WorkspaceMembership[];
  selectedWorkspaceType: WorkspaceType;
  selectedOwnerAccountId: string;
  editingOwnerAccountId: string;
  selectedMemberDraft: { email: string };
  workspaceEditDraft: WorkspaceUpdateInput;
  setWorkspaceEditDraft: Dispatch<SetStateAction<WorkspaceUpdateInput>>;
  workspaceEditWarning: WorkspaceEditWarning;
  setWorkspaceEditWarning: Dispatch<SetStateAction<WorkspaceEditWarning>>;
  canEditSelectedWorkspace: boolean;
  canChangeSelectedWorkspaceType: boolean;
  canChangeSelectedWorkspaceOwner: boolean;
  startWorkspaceEdit: () => void;
  saveWorkspaceEdit: () => Promise<void>;
  selectWorkspaceOwner: (accountId: string, checked: boolean) => Promise<void>;
  updateWorkspaceMemberDraft: (workspaceId: string, patch: Partial<{ email: string }>) => void;
  inviteWorkspaceMember: (workspaceId: string, email: string) => void;
  unbindWorkspaceMember: (member: WorkspaceMembership) => Promise<void>;
  closeModal: () => void;
};

export function WorkspaceMembersModal({
  selectedCard,
  currentAccount,
  selectedMembers,
  selectedWorkspaceType,
  selectedOwnerAccountId,
  editingOwnerAccountId,
  selectedMemberDraft,
  workspaceEditDraft,
  setWorkspaceEditDraft,
  workspaceEditWarning,
  setWorkspaceEditWarning,
  canEditSelectedWorkspace,
  canChangeSelectedWorkspaceType,
  canChangeSelectedWorkspaceOwner,
  startWorkspaceEdit,
  saveWorkspaceEdit,
  selectWorkspaceOwner,
  updateWorkspaceMemberDraft,
  inviteWorkspaceMember,
  unbindWorkspaceMember,
  closeModal,
}: WorkspaceMembersModalProps) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={closeModal}>
      <section
        className="modal-panel workspace-project-modal workspace-member-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`${selectedCard.workspace.name} 成员管理`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-heading">
          <div>
            <p className="eyebrow">{workspaceTypeLabel(selectedCard.workspace)}</p>
            <h2>{selectedCard.workspace.name}</h2>
            <span>协作工作区成员默认可见该工作区全部项目；私人工作区不支持添加成员。</span>
          </div>
          <button className="icon-button" onClick={closeModal} aria-label="关闭">
            <X size={18} />
          </button>
        </div>

        <div className="workspace-member-modal-body">
          <WorkspaceEditForm
            selectedCard={selectedCard}
            selectedMembers={selectedMembers}
            selectedWorkspaceType={selectedWorkspaceType}
            selectedOwnerAccountId={selectedOwnerAccountId}
            editingOwnerAccountId={editingOwnerAccountId}
            workspaceEditDraft={workspaceEditDraft}
            setWorkspaceEditDraft={setWorkspaceEditDraft}
            workspaceEditWarning={workspaceEditWarning}
            setWorkspaceEditWarning={setWorkspaceEditWarning}
            canEditSelectedWorkspace={canEditSelectedWorkspace}
            canChangeSelectedWorkspaceType={canChangeSelectedWorkspaceType}
            canChangeSelectedWorkspaceOwner={canChangeSelectedWorkspaceOwner}
            startWorkspaceEdit={startWorkspaceEdit}
            saveWorkspaceEdit={saveWorkspaceEdit}
          />
          <WorkspaceMemberListPanel
            selectedCard={selectedCard}
            currentAccount={currentAccount}
            selectedMembers={selectedMembers}
            selectedWorkspaceType={selectedWorkspaceType}
            editingOwnerAccountId={editingOwnerAccountId}
            selectedMemberDraft={selectedMemberDraft}
            canEditSelectedWorkspace={canEditSelectedWorkspace}
            canChangeSelectedWorkspaceOwner={canChangeSelectedWorkspaceOwner}
            selectWorkspaceOwner={selectWorkspaceOwner}
            updateWorkspaceMemberDraft={updateWorkspaceMemberDraft}
            inviteWorkspaceMember={inviteWorkspaceMember}
            unbindWorkspaceMember={unbindWorkspaceMember}
          />
        </div>
      </section>
    </div>
  );
}
