import type { Task, TaskStatus } from "./types";

export const projectTaskStatusColumns: { status: TaskStatus; title: string }[] = [
  { status: "pool", title: "任务池" },
  { status: "committed", title: "已安排" },
  { status: "in_progress", title: "进行中" },
  { status: "pending_review", title: "待验收" },
  { status: "completed", title: "已完成" },
  { status: "split", title: "已拆分" },
  { status: "archived", title: "已归档" },
];

const statusTitleByStatus = Object.fromEntries(projectTaskStatusColumns.map((column) => [column.status, column.title])) as Record<TaskStatus, string>;

export const stageTaskStatusLabel = (status: TaskStatus) => {
  if (status === "in_progress") return "已开始";
  return statusTitleByStatus[status];
};

export const stageTaskStatePills = (status: TaskStatus, isActive: boolean) => {
  const pills: { className: string; label: string }[] = [];
  if (isActive) pills.push({ className: "running", label: "执行中" });
  if (status === "pending_review") pills.push({ className: "review", label: "待验收" });
  return pills;
};

export const stageTaskCardClassName = (status: TaskStatus, isActive: boolean, isTodayTask: boolean) => {
  const emphasis = isActive ? "active" : status === "pending_review" ? "review" : isTodayTask ? "today" : "";
  return ["project-stage-task-card", emphasis].filter(Boolean).join(" ");
};

export const stageTaskSortRank = (status: TaskStatus, isActive: boolean, isTodayTask: boolean) => {
  if (status === "pending_review") return 0;
  if (isActive) return 1;
  if (isTodayTask) return 2;
  return 3;
};

export const taskBelongsToAnyProjectMember = (task: Task, memberIds: Set<string>) =>
  Boolean((task.primaryExecutorMemberId && memberIds.has(task.primaryExecutorMemberId)) || (task.collaboratorMemberIds ?? []).some((id) => memberIds.has(id)));
