import type { ProjectDetailModel } from "../../projectDetail";
import type { TaskStageMode } from "../../types";
import { ScheduleCalendarView } from "../ScheduleCalendarView";

type ProjectDetailScheduleTabProps = {
  projectName: string;
  allProjectTasks: ProjectDetailModel["allProjectTasks"];
  projectMembers: ProjectDetailModel["projectMembers"];
  activeProjectTaskIds: string[];
  todayTaskIds: string[];
  taskStageMode: TaskStageMode;
  selectTask: (taskId: string | null) => void;
};

export function ProjectDetailScheduleTab({
  projectName,
  allProjectTasks,
  projectMembers,
  activeProjectTaskIds,
  todayTaskIds,
  taskStageMode,
  selectTask,
}: ProjectDetailScheduleTabProps) {
  return (
    <section className="band project-schedule-panel">
      <ScheduleCalendarView
        tasks={allProjectTasks}
        members={projectMembers}
        activeTaskIds={activeProjectTaskIds}
        todayTaskIds={todayTaskIds}
        taskStageMode={taskStageMode}
        embedded
        title={`${projectName}排期`}
        subtitle="按阶段查看当前项目任务的排期、负责人、今日任务和运行状态。"
        openTask={selectTask}
      />
    </section>
  );
}
