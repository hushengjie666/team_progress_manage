import { ChevronRight, Save } from "lucide-react";
import { taskStageModeOptions } from "../../appModel";
import type { Project, TaskStageMode } from "../../types";
import type { ProjectEditDraft, WorkspaceDirectoryCard } from "./workspaceDirectoryModel";

type WorkspaceProjectManagementListProps = {
  selectedCard: WorkspaceDirectoryCard;
  projectsById: Map<string, Project>;
  projectEditDraftFor: (project: Project) => ProjectEditDraft;
  updateProjectEditDraft: (project: Project, patch: Partial<ProjectEditDraft>) => void;
  projectEditWarnings: Record<string, string>;
  saveProjectEdit: (project: Project) => void;
  openProjectDetail: (projectId: string) => void;
};

export function WorkspaceProjectManagementList({
  selectedCard,
  projectsById,
  projectEditDraftFor,
  updateProjectEditDraft,
  projectEditWarnings,
  saveProjectEdit,
  openProjectDetail,
}: WorkspaceProjectManagementListProps) {
  return (
    <div className="workspace-project-list">
      {selectedCard.projects.map((projectCard) => {
        const project = projectsById.get(projectCard.projectId);
        if (!project) return null;
        const projectEditDraft = projectEditDraftFor(project);
        return (
          <article className="workspace-project-management-card" key={project.id}>
            <div className="workspace-project-management-head">
              <div>
                <strong>{project.name}</strong>
                <span>{project.description || "这个项目还没有说明。"}</span>
              </div>
              <button className="secondary-button" onClick={() => openProjectDetail(project.id)} type="button">
                进入项目
                <ChevronRight size={16} />
              </button>
            </div>
            <div className="workspace-project-edit-grid">
              <label>
                项目名称
                <input
                  aria-invalid={Boolean(projectEditWarnings[project.id])}
                  value={projectEditDraft.name}
                  onChange={(event) => updateProjectEditDraft(project, { name: event.target.value })}
                />
                {projectEditWarnings[project.id] && <span className="field-error">{projectEditWarnings[project.id]}</span>}
              </label>
              <label>
                项目类型
                <select
                  value={projectEditDraft.taskStageMode ?? "software"}
                  onChange={(event) => updateProjectEditDraft(project, { taskStageMode: event.target.value as TaskStageMode })}
                >
                  {taskStageModeOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label>
                项目说明
                <input
                  value={projectEditDraft.description}
                  onChange={(event) => updateProjectEditDraft(project, { description: event.target.value })}
                />
              </label>
              <button className="secondary-button" onClick={() => saveProjectEdit(project)} type="button">
                <Save size={16} />
                保存项目
              </button>
            </div>
            <div className="workspace-project-card-metrics">
              <span>任务 {projectCard.taskCount}</span>
              <span>成员 {projectCard.memberCount}</span>
              <span>进度 {projectCard.progressPercent}%</span>
              {projectCard.pendingReviewCount > 0 && <span className="metric-warning">待验收 {projectCard.pendingReviewCount}</span>}
              {projectCard.riskCount > 0 && <span className="metric-danger">风险 {projectCard.riskCount}</span>}
            </div>
          </article>
        );
      })}
      {selectedCard.projects.length === 0 && <p className="empty">当前账号在这个工作区下还没有可见项目。</p>}
    </div>
  );
}
