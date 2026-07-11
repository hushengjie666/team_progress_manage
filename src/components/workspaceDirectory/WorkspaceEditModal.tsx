import type { Dispatch, SetStateAction } from "react";
import { X } from "lucide-react";
import type { WorkspaceMembership, WorkspaceType, WorkspaceUpdateInput } from "../../types";
import type { WorkspaceDirectoryCard } from "./workspaceDirectoryModel";
import { workspaceTypeLabel } from "./workspaceDirectoryModel";
import { WorkspaceEditForm } from "./WorkspaceEditForm";
import type { WorkspaceEditWarning } from "./workspaceDirectoryModalModel";

type WorkspaceEditModalProps = {
  selectedCard: WorkspaceDirectoryCard;
  selectedMembers: WorkspaceMembership[];
  selectedWorkspaceType: WorkspaceType;
  selectedOwnerAccountId: string;
  workspaceEditDraft: WorkspaceUpdateInput;
  setWorkspaceEditDraft: Dispatch<SetStateAction<WorkspaceUpdateInput>>;
  workspaceEditWarning: WorkspaceEditWarning;
  setWorkspaceEditWarning: Dispatch<SetStateAction<WorkspaceEditWarning>>;
  canEditSelectedWorkspace: boolean;
  canChangeSelectedWorkspaceType: boolean;
  startWorkspaceEdit: () => void;
  saveWorkspaceEdit: () => Promise<void>;
  closeModal: () => void;
};

export function WorkspaceEditModal({
  selectedCard,
  selectedMembers,
  selectedWorkspaceType,
  selectedOwnerAccountId,
  workspaceEditDraft,
  setWorkspaceEditDraft,
  workspaceEditWarning,
  setWorkspaceEditWarning,
  canEditSelectedWorkspace,
  canChangeSelectedWorkspaceType,
  startWorkspaceEdit,
  saveWorkspaceEdit,
  closeModal,
}: WorkspaceEditModalProps) {
  return (
    <div className="modal-backdrop" role="presentation" onClick={closeModal}>
      <section
        className="modal-panel workspace-project-modal workspace-edit-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`${selectedCard.workspace.name} 工作区资料`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-heading">
          <div>
            <p className="eyebrow">{workspaceTypeLabel(selectedCard.workspace)}</p>
            <h2>{selectedCard.workspace.name}</h2>
            <span>维护工作区名称、属性和创建人信息。</span>
          </div>
          <button className="icon-button" onClick={closeModal} aria-label="关闭">
            <X size={18} />
          </button>
        </div>

        <div className="workspace-edit-modal-body">
          <WorkspaceEditForm
            selectedCard={selectedCard}
            selectedMembers={selectedMembers}
            selectedWorkspaceType={selectedWorkspaceType}
            selectedOwnerAccountId={selectedOwnerAccountId}
            workspaceEditDraft={workspaceEditDraft}
            setWorkspaceEditDraft={setWorkspaceEditDraft}
            workspaceEditWarning={workspaceEditWarning}
            setWorkspaceEditWarning={setWorkspaceEditWarning}
            canEditSelectedWorkspace={canEditSelectedWorkspace}
            canChangeSelectedWorkspaceType={canChangeSelectedWorkspaceType}
            startWorkspaceEdit={startWorkspaceEdit}
            saveWorkspaceEdit={saveWorkspaceEdit}
          />
        </div>
      </section>
    </div>
  );
}
