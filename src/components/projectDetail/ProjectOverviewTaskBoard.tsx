import { Eye, UserRoundPen } from "lucide-react";
import { labelPriority, taskStageOptionsForMode } from "../../appModel";
import {
  stageTaskCardClassName,
  stageTaskSortRank,
  stageTaskStatePills,
  stageTaskStatusLabel,
} from "../../projectTaskDisplay";
import type { ProjectMember, Task, TaskStageMode, TaskStatus } from "../../types";

export function ProjectOverviewTaskBoard(props: {
  tasks: Task[];
  members: ProjectMember[];
  todayTaskIds: string[];
  selectTask: (taskId: string) => void;
  activeTaskIds: string[];
  taskStageMode: TaskStageMode;
}) {
  const activeTaskIdSet = new Set(props.activeTaskIds);
  const todayTaskIdSet = new Set(props.todayTaskIds);
  const membersById = new Map(props.members.map((member) => [member.id, member]));
  const statusOrder: Record<TaskStatus, number> = {
    in_progress: 0,
    pending_review: 1,
    committed: 2,
    pool: 3,
    completed: 4,
    split: 5,
    archived: 6,
  };
  const sortedTasks = (tasks: Task[]) => [...tasks].sort((left, right) => {
    const leftRank = stageTaskSortRank(left.status, activeTaskIdSet.has(left.id), todayTaskIdSet.has(left.id));
    const rightRank = stageTaskSortRank(right.status, activeTaskIdSet.has(right.id), todayTaskIdSet.has(right.id));
    if (leftRank !== rightRank) return leftRank - rightRank;
    const statusDelta = statusOrder[left.status] - statusOrder[right.status];
    if (statusDelta !== 0) return statusDelta;
    return left.sortOrder - right.sortOrder;
  });

  const renderStageTask = (task: Task) => {
    const isActive = activeTaskIdSet.has(task.id);
    const showsActiveState = isActive && task.status === "in_progress";
    const isTodayTask = todayTaskIdSet.has(task.id);
    const statusLabel = stageTaskStatusLabel(task.status);
    const statePills = stageTaskStatePills(task.status, showsActiveState);
    const executorName = task.primaryExecutorMemberId ? membersById.get(task.primaryExecutorMemberId)?.name ?? "已分配" : undefined;
    return (
      <button
        className={stageTaskCardClassName(task.status, showsActiveState, isTodayTask)}
        key={task.id}
        onClick={() => props.selectTask(task.id)}
        type="button"
      >
        <div className="project-stage-task-main">
          <strong>{task.title}</strong>
          <span>{statusLabel} · {labelPriority[task.priority]} · {task.progressPercent ?? 0}% · {task.actualPomodoros}/{task.estimatePomodoros} 番茄</span>
        </div>
        {showsActiveState && (
          <span className="working-indicator" aria-label="当前任务执行中">
            <UserRoundPen size={32} />
          </span>
        )}
        <div className="project-stage-task-tags">
          {executorName ? <span className="task-info-pill assignee">{executorName}</span> : <span className="task-info-pill muted">未分配</span>}
          {isTodayTask && <span className="task-info-pill today">今日</span>}
          {statePills.map((pill) => (
            <span className={`task-info-pill ${pill.className}`} key={pill.className}>{pill.label}</span>
          ))}
          <Eye size={14} />
        </div>
      </button>
    );
  };

  return (
    <section className="project-stage-overview">
      {taskStageOptionsForMode(props.taskStageMode).map((stage) => {
        const stageTasks = sortedTasks(props.tasks.filter((task) => task.stage === stage.value));
        return (
          <div className="project-stage-row" key={stage.value}>
            <div className="project-stage-label">
              <strong>{stage.label}</strong>
              <span>{stageTasks.length}</span>
            </div>
            <div className="project-stage-task-list">
              {stageTasks.length === 0 && <p className="project-stage-empty">暂无任务</p>}
              {stageTasks.map(renderStageTask)}
            </div>
          </div>
        );
      })}
    </section>
  );
}
