import { ChevronRight } from "lucide-react";
import type { Project } from "../../types";
import type { WorkspaceDirectoryCard } from "./workspaceDirectoryModel";

type WorkspaceProjectManagementListProps = {
  selectedCard: WorkspaceDirectoryCard;
  projectsById: Map<string, Project>;
  openProjectDetail: (projectId: string) => void;
};

export function WorkspaceProjectManagementList({
  selectedCard,
  projectsById,
  openProjectDetail,
}: WorkspaceProjectManagementListProps) {
  return (
    <div className="workspace-project-list">
      {selectedCard.projects.map((projectCard) => {
        const project = projectsById.get(projectCard.projectId);
        if (!project) return null;
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
