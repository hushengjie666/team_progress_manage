import { ChevronRight } from "lucide-react";
import type { ProjectOverviewCard } from "../../projectOverview";
import type { TaskStatus } from "../../types";

const projectStatusLabels: Record<TaskStatus, string> = {
  pool: "任务池",
  committed: "已安排",
  in_progress: "进行中",
  pending_review: "待验收",
  completed: "已完成",
  split: "已拆分",
  archived: "已归档",
};

const projectStatusOrder: TaskStatus[] = ["pool", "committed", "in_progress", "pending_review", "completed", "split", "archived"];

const projectWorkspaceBadgeLabel = (card: ProjectOverviewCard) => (
  (card.workspaceType ?? "shared") === "private" ? "私人" : `协作 · ${card.workspaceName}`
);

export function ProjectOverviewCardHeader({ card }: { card: ProjectOverviewCard }) {
  return (
    <div className="project-overview-card-header">
      <div>
        <h2 className="project-overview-title-line">
          <span>{card.name}</span>
          {card.workspaceName && (
            <span className="workspace-source-badge">
              {projectWorkspaceBadgeLabel(card)}
            </span>
          )}
        </h2>
        <p>{card.description || "这个项目还没有说明。"}</p>
      </div>
      <div className="project-overview-progress-inline" aria-label={`项目进度 ${card.progressPercent}%`}>
        <strong>{card.progressPercent}%</strong>
        <span>进度</span>
      </div>
    </div>
  );
}

export function ProjectOverviewCardProgressMeter({ progressPercent }: { progressPercent: number }) {
  return (
    <div className="project-overview-meter">
      <span style={{ width: `${Math.max(0, Math.min(100, progressPercent))}%` }} />
    </div>
  );
}

export function ProjectOverviewCardMetrics({ card }: { card: ProjectOverviewCard }) {
  return (
    <div className="project-overview-metrics">
      <div>
        <span>任务</span>
        <strong>{card.taskCount}</strong>
      </div>
      <div>
        <span>成员</span>
        <strong>{card.memberCount}</strong>
      </div>
      <div className={card.riskCount > 0 ? "metric-danger metric-strong" : ""}>
        <span>风险</span>
        <strong>{card.riskCount}</strong>
      </div>
      <div className={card.pendingReviewCount > 0 ? "metric-warning metric-strong" : ""}>
        <span>待验收</span>
        <strong>{card.pendingReviewCount}</strong>
      </div>
    </div>
  );
}

export function ProjectOverviewCardStatusStrip({ card }: { card: ProjectOverviewCard }) {
  const activeStatuses = projectStatusOrder.filter((status) => card.statusCounts[status] > 0);
  return (
    <div className="project-status-strip">
      {(activeStatuses.length > 0 ? activeStatuses : ["pool" as TaskStatus]).map((status) => (
        <div className={`project-status-pill status-${status}`} key={status}>
          <span>{projectStatusLabels[status]}</span>
          <strong>{card.statusCounts[status]}</strong>
        </div>
      ))}
    </div>
  );
}

export function ProjectOverviewCardSignals({ card }: { card: ProjectOverviewCard }) {
  return (
    <div className="project-overview-signal">
      <span className={card.assignedNotStartedCount > 0 ? "signal-warning" : ""}>
        未开始 {card.assignedNotStartedCount}
      </span>
      <span className={card.activeSessionCount > 0 ? "signal-live" : ""}>
        工作会话 {card.activeSessionCount}
      </span>
    </div>
  );
}

export function ProjectOverviewCardActions({ openProject }: { openProject: () => void }) {
  return (
    <div className="project-overview-actions">
      <button
        className="primary-button"
        onClick={(event) => {
          event.stopPropagation();
          openProject();
        }}
        type="button"
      >
        进入项目
        <ChevronRight size={16} />
      </button>
    </div>
  );
}
