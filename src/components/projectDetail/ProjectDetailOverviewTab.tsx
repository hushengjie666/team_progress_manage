import { Plus } from "lucide-react";
import type { ProjectDetailModel } from "../../projectDetail";
import type { TaskStageMode } from "../../types";
import { ProjectAcceptedTasksPanel } from "./ProjectAcceptedTasksPanel";
import { ProjectOverviewTaskBoard } from "./ProjectOverviewTaskBoard";
import { ProjectRiskSignalPanel } from "./ProjectRiskSignalPanel";

type ProjectDetailOverviewTabProps = {
  overviewTasks: ProjectDetailModel["overviewTasks"];
  acceptedTasks: ProjectDetailModel["acceptedTasks"];
  projectMembers: ProjectDetailModel["projectMembers"];
  todayTaskIds: string[];
  activeProjectTaskIds: string[];
  taskStageMode: TaskStageMode;
  canEditTasks: boolean;
  board: ProjectDetailModel["board"];
  riskSections: ProjectDetailModel["riskSections"];
  riskTaskCount: number;
  selectTask: (taskId: string | null) => void;
  openCreateTaskDialog: () => void;
};

export function ProjectDetailOverviewTab({
  overviewTasks,
  acceptedTasks,
  projectMembers,
  todayTaskIds,
  activeProjectTaskIds,
  taskStageMode,
  canEditTasks,
  board,
  riskSections,
  riskTaskCount,
  selectTask,
  openCreateTaskDialog,
}: ProjectDetailOverviewTabProps) {
  return (
    <>
      <section className="band project-task-workspace project-overview-task-board">
        <div className="section-title">
          <div className="project-board-title">
            <span className="count-pill">{overviewTasks.length}</span>
            <h2>任务阶段总览</h2>
          </div>
          <button className="primary-button compact-button" disabled={!canEditTasks} onClick={openCreateTaskDialog}>
            <Plus size={16} />
            添加任务
          </button>
        </div>
        <ProjectOverviewTaskBoard
          tasks={overviewTasks}
          members={projectMembers}
          todayTaskIds={todayTaskIds}
          selectTask={selectTask}
          activeTaskIds={activeProjectTaskIds}
          taskStageMode={taskStageMode}
        />
      </section>
      <ProjectRiskSignalPanel
        board={board}
        riskSections={riskSections}
        riskTaskCount={riskTaskCount}
        selectTask={selectTask}
      />
      <ProjectAcceptedTasksPanel
        tasks={acceptedTasks}
        members={projectMembers}
        selectTask={selectTask}
      />
    </>
  );
}
