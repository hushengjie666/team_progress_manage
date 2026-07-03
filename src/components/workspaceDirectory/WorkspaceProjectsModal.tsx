import { X } from "lucide-react";
import type { Project } from "../../types";
import type { ProjectEditDraft, WorkspaceDirectoryCard } from "./workspaceDirectoryModel";
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
  projectEditDraftFor,
  updateProjectEditDraft,
  projectEditWarnings,
  saveProjectEdit,
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
  projectEditDraftFor: (project: Project) => ProjectEditDraft;
  updateProjectEditDraft: (project: Project, patch: Partial<ProjectEditDraft>) => void;
  projectEditWarnings: Record<string, string>;
  saveProjectEdit: (project: Project) => void;
  openProjectDetail: (projectId: string) => void;
  closeModal: () => void;
}) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={closeModal}>
      <section
        className="modal-panel workspace-project-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`${selectedCard.workspace.name} 项目管理`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-heading">
          <div>
            <p className="eyebrow">{workspaceTypeLabel(selectedCard.workspace)}</p>
            <h2>{selectedCard.workspace.name}</h2>
            <span>这里只展示当前账号有权限访问的项目，可在此新增项目或维护项目基础资料。</span>
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
          projectEditDraftFor={projectEditDraftFor}
          updateProjectEditDraft={updateProjectEditDraft}
          projectEditWarnings={projectEditWarnings}
          saveProjectEdit={saveProjectEdit}
          openProjectDetail={openProjectDetail}
        />
      </section>
    </div>
  );
}
