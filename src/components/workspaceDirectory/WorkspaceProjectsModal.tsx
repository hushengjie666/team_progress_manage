import { X } from "lucide-react";
import type { Project } from "../../types";
import type { WorkspaceDirectoryCard } from "./workspaceDirectoryModel";
import { workspaceTypeLabel } from "./workspaceDirectoryModel";
import type { ProjectDraft } from "./useWorkspaceProjectDrafts";
import { WorkspaceProjectCreateForm } from "./WorkspaceProjectCreateForm";
import { WorkspaceProjectManagementList } from "./WorkspaceProjectManagementList";

export function WorkspaceProjectsModal({
  selectedCard,
  projectsById,
  projectDraft,
  setProjectDraft,
  projectDraftWarning,
  setProjectDraftWarning,
  submitProject,
  openProjectDetail,
  closeModal,
}: {
  selectedCard: WorkspaceDirectoryCard;
  projectsById: Map<string, Project>;
  projectDraft: ProjectDraft;
  setProjectDraft: (draft: ProjectDraft) => void;
  projectDraftWarning: string;
  setProjectDraftWarning: (warning: string) => void;
  submitProject: () => void;
  openProjectDetail: (projectId: string) => void;
  closeModal: () => void;
}) {
  return (
    <div className="modal-backdrop" role="presentation" onClick={closeModal}>
      <section
        className="modal-panel workspace-project-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`${selectedCard.workspace.name} 项目管理`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-heading">
          <div>
            <p className="eyebrow">{workspaceTypeLabel(selectedCard.workspace)}</p>
            <h2>{selectedCard.workspace.name}</h2>
            <span>这里只展示当前账号有权限访问的项目，可在此新增项目；已有项目请进入项目页面维护。</span>
          </div>
          <button className="icon-button" onClick={closeModal} aria-label="关闭">
            <X size={18} />
          </button>
        </div>

        <WorkspaceProjectCreateForm
          projectDraft={projectDraft}
          setProjectDraft={setProjectDraft}
          projectDraftWarning={projectDraftWarning}
          setProjectDraftWarning={setProjectDraftWarning}
          submitProject={submitProject}
        />

        <WorkspaceProjectManagementList
          selectedCard={selectedCard}
          projectsById={projectsById}
          openProjectDetail={openProjectDetail}
        />
      </section>
    </div>
  );
}
