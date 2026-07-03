import { useState } from "react";
import { ChevronRight, Play } from "lucide-react";
import type { WorkspaceViewModel } from "../../workbenchModel";
import type { ActiveTimer, Task } from "../../types";
import { MyProjectTaskFilterPanel } from "./MyProjectTaskFilterPanel";
import { TaskColumn } from "./WorkbenchTaskColumns";

type WorkspaceWorkbenchColumnsProps = {
  myProjectTaskCards: WorkspaceViewModel["myProjectTaskCards"];
  poolWorkbenchTasks: Task[];
  committedWorkbenchTasks: Task[];
  selectedWorkbenchProjectIds: string[];
  toggleWorkbenchProject: (projectId: string) => void;
  activeTimer?: ActiveTimer;
  commitTask: (taskId: string) => void;
  removeCommittedTask: (taskId: string) => void;
  completeTask: (taskId: string) => void;
  deleteTask: (taskId: string) => void;
  selectTask: (taskId: string | null) => void;
  moveCommittedTask: (taskId: string, direction: -1 | 1) => void;
  splitTask: (taskId: string) => void;
  beginFocus: (taskId: string) => void;
};

const isUnassignedTask = (task: Task) =>
  !task.primaryExecutorMemberId && (task.collaboratorMemberIds ?? []).length === 0;

export function WorkspaceWorkbenchColumns({
  myProjectTaskCards,
  poolWorkbenchTasks,
  committedWorkbenchTasks,
  selectedWorkbenchProjectIds,
  toggleWorkbenchProject,
  activeTimer,
  commitTask,
  removeCommittedTask,
  completeTask,
  deleteTask,
  selectTask,
  moveCommittedTask,
  splitTask,
  beginFocus,
}: WorkspaceWorkbenchColumnsProps) {
  const [showUnassignedPoolTasks, setShowUnassignedPoolTasks] = useState(true);
  const visiblePoolWorkbenchTasks = showUnassignedPoolTasks
    ? poolWorkbenchTasks
    : poolWorkbenchTasks.filter((task) => !isUnassignedTask(task));
  const hiddenUnassignedPoolTaskCount = poolWorkbenchTasks.length - visiblePoolWorkbenchTasks.length;

  return (
    <>
      <MyProjectTaskFilterPanel
        cards={myProjectTaskCards}
        selectedProjectIds={selectedWorkbenchProjectIds}
        toggleProject={toggleWorkbenchProject}
      />

      <TaskColumn
        title="活动清单"
        eyebrow="待安排任务池"
        titleAccessory={(
          <span className="task-title-accessory">
            <button
              className={showUnassignedPoolTasks ? "unassigned-toggle active" : "unassigned-toggle"}
              onClick={() => setShowUnassignedPoolTasks((value) => !value)}
              role="switch"
              type="button"
              aria-checked={showUnassignedPoolTasks}
            >
              <span>显示未分配</span>
              <i aria-hidden="true" />
            </button>
            <span className="toggle-tooltip" role="tooltip">
              默认显示未分配任务；关闭后隐藏没有执行人和协作者的任务。
              {!showUnassignedPoolTasks && hiddenUnassignedPoolTaskCount > 0 ? ` 当前已隐藏 ${hiddenUnassignedPoolTaskCount} 个。` : ""}
            </span>
          </span>
        )}
        tasks={visiblePoolWorkbenchTasks}
        empty={
          !showUnassignedPoolTasks && hiddenUnassignedPoolTaskCount > 0
            ? "未分配任务已隐藏，当前没有已分配的待安排任务。"
            : selectedWorkbenchProjectIds.length > 0 ? "所选项目里暂无待安排任务。" : "暂无待安排任务。"
        }
        actionLabel="加入队列"
        actionIcon={<ChevronRight size={15} />}
        onAction={commitTask}
        onDelete={deleteTask}
        onSelect={selectTask}
        onSplit={splitTask}
        activeTimer={activeTimer}
      />

      <TaskColumn
        title="工作队列"
        eyebrow="今日准备执行"
        tasks={committedWorkbenchTasks}
        empty={selectedWorkbenchProjectIds.length > 0 ? "所选项目里暂无今日准备执行的任务。" : "暂无今日准备执行的任务。"}
        actionLabel="开始"
        actionIcon={<Play size={15} />}
        onAction={beginFocus}
        onRemove={removeCommittedTask}
        onComplete={completeTask}
        onSelect={selectTask}
        onSplit={splitTask}
        onMove={moveCommittedTask}
        activeTimer={activeTimer}
      />
    </>
  );
}
