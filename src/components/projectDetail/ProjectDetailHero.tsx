import type { ProjectDetailTab } from "../ProjectDetailView";

export function ProjectDetailHero({
  projectName,
  workspaceTagLabel,
  activeTab,
  canShowProjectMemberManagement,
  setActiveTab,
  progressPercent,
  taskCount,
  memberCount,
  pendingReviewCount,
}: {
  projectName: string;
  workspaceTagLabel: string;
  activeTab: ProjectDetailTab;
  canShowProjectMemberManagement: boolean;
  setActiveTab: (tab: ProjectDetailTab) => void;
  progressPercent: number;
  taskCount: number;
  memberCount: number;
  pendingReviewCount: number;
}) {
  return (
    <section className="band project-detail-hero">
      <div className="segmented project-detail-tabs">
        {([
          ["overview", "概览"],
          ["schedule", "排期日历"],
          ["tasks", "任务"],
          ["members", "成员管理"],
          ["settings", "设置"],
        ] as const).filter(([tab]) => canShowProjectMemberManagement || tab !== "members").map(([tab, label]) => (
          <button className={activeTab === tab ? "active" : ""} key={tab} onClick={() => setActiveTab(tab)}>
            {label}
          </button>
        ))}
      </div>
      <div className="project-detail-identity" aria-label={`当前项目 ${projectName}，所属${workspaceTagLabel}`}>
        <strong title={projectName}>{projectName}</strong>
        <span title={workspaceTagLabel}>{workspaceTagLabel}</span>
      </div>
      <div className="project-detail-stats">
        <Metric label="进度" value={`${progressPercent}%`} />
        <Metric label="任务" value={`${taskCount}`} />
        <Metric label="成员" value={`${memberCount}`} />
        <Metric label="待验收" value={`${pendingReviewCount}`} />
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
