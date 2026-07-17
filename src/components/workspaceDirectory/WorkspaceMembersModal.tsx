import { X } from "lucide-react";
import type { Account, WorkspaceMembership, WorkspaceType } from "../../types";
import type { WorkspaceDirectoryCard } from "./workspaceDirectoryModel";
import { workspaceTypeLabel } from "./workspaceDirectoryModel";
import { WorkspaceMemberListPanel } from "./WorkspaceMemberListPanel";

type WorkspaceMembersModalProps = {
  selectedCard: WorkspaceDirectoryCard;
  currentAccount?: Account;
  selectedMembers: WorkspaceMembership[];
  selectedWorkspaceType: WorkspaceType;
  selectedOwnerAccountId: string;
  selectedMemberDraft: { email: string };
  canManageSelectedWorkspaceMembers: boolean;
  canChangeSelectedWorkspaceOwner: boolean;
  updateWorkspaceMemberRole: (member: WorkspaceMembership, checked: boolean) => Promise<void>;
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
  selectedMemberDraft,
  canManageSelectedWorkspaceMembers,
  canChangeSelectedWorkspaceOwner,
  updateWorkspaceMemberRole,
  updateWorkspaceMemberDraft,
  inviteWorkspaceMember,
  unbindWorkspaceMember,
  closeModal,
}: WorkspaceMembersModalProps) {
  return (
    <div className="modal-backdrop" role="presentation" onClick={closeModal}>
      <section
        className="modal-panel workspace-project-modal workspace-member-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`${selectedCard.workspace.name} 成员管理`}
        onClick={(event) => event.stopPropagation()}
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
          <WorkspaceMemberListPanel
            selectedCard={selectedCard}
            currentAccount={currentAccount}
            selectedMembers={selectedMembers}
            selectedWorkspaceType={selectedWorkspaceType}
            selectedOwnerAccountId={selectedOwnerAccountId}
            selectedMemberDraft={selectedMemberDraft}
            canManageSelectedWorkspaceMembers={canManageSelectedWorkspaceMembers}
            canChangeSelectedWorkspaceOwner={canChangeSelectedWorkspaceOwner}
            updateWorkspaceMemberRole={updateWorkspaceMemberRole}
            updateWorkspaceMemberDraft={updateWorkspaceMemberDraft}
            inviteWorkspaceMember={inviteWorkspaceMember}
            unbindWorkspaceMember={unbindWorkspaceMember}
          />
        </div>
      </section>
    </div>
  );
}
