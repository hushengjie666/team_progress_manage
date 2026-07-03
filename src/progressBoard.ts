import type { AppState, Task, WorkSession } from "./types";
import type { ProgressBoard, ProgressBoardTask } from "./progressBoardTypes";
import { expectedStartForTask, stalledTaskRisks } from "./progressBoardRisks";

export type {
  ProgressBoard,
  ProgressBoardActiveSession,
  ProgressBoardSection,
  ProgressBoardSectionKind,
  ProgressBoardTask,
  StalledTaskRisk,
  StalledTaskRiskKind,
} from "./progressBoardTypes";
export { expectedStartForTask, stalledTaskRisks } from "./progressBoardRisks";

const memberName = (state: AppState, memberId?: string) =>
  memberId ? state.projectMembers.find((member) => member.id === memberId)?.name : undefined;

const boardTask = (state: AppState, task: Task, detail: string): ProgressBoardTask => ({
  taskId: task.id,
  title: task.title,
  executorName: memberName(state, task.primaryExecutorMemberId),
  progressPercent: task.progressPercent ?? 0,
  progressNote: task.progressNote,
  expectedStartAt: expectedStartForTask(state, task),
  expectedFinishAt: task.expectedFinishAt,
  detail,
});

const isBlockedTask = (task: Task) => /阻塞|卡住|blocked|blocker|等待/i.test(`${task.progressNote ?? ""} ${task.reviewReturnReason ?? ""}`);

const nearExpectedFinish = (task: Task, now: Date) => {
  if (!task.expectedFinishAt || (task.progressPercent ?? 0) >= 100) return false;
  const finish = new Date(task.expectedFinishAt).getTime();
  if (Number.isNaN(finish)) return false;
  const diff = finish - now.getTime();
  return diff >= 0 && diff <= 24 * 3_600_000;
};

const hasAnyWorkSession = (sessions: WorkSession[], task: Task) =>
  sessions.some((session) => session.taskId === task.id);

export const buildProgressBoard = (state: AppState, projectId: string, now = new Date()): ProgressBoard => {
  const project = state.projects.find((item) => item.id === projectId) ?? state.projects[0];
  const tasks = state.tasks.filter((task) => task.projectId === project?.id && task.status !== "archived" && task.status !== "split");
  const progressTasks = tasks.filter((task) => task.status !== "archived" && task.status !== "split");
  const totalWeight = progressTasks.reduce((sum, task) => sum + Math.max(1, task.estimatePomodoros || 1), 0);
  const weightedProgress = totalWeight
    ? Math.round(progressTasks.reduce((sum, task) => sum + (task.progressPercent ?? (task.status === "completed" ? 100 : 0)) * Math.max(1, task.estimatePomodoros || 1), 0) / totalWeight)
    : 0;
  const projectSessions = state.workSessions.filter((session) =>
    session.status === "active" && tasks.some((task) => task.id === session.taskId),
  );
  const stalledByTask = new Map(stalledTaskRisks(state, now).filter((risk) => tasks.some((task) => task.id === risk.taskId)).map((risk) => [risk.taskId, risk]));
  const assignedNotStarted = tasks
    .filter((task) => task.primaryExecutorMemberId && task.status !== "completed" && task.status !== "pending_review" && !hasAnyWorkSession(state.workSessions, task))
    .map((task) => boardTask(state, task, stalledByTask.get(task.id)?.detail ?? "已分配，但还没有工作会话。"));
  const assignedNotStartedIds = new Set(assignedNotStarted.map((task) => task.taskId));
  const stalled = tasks
    .filter((task) => stalledByTask.has(task.id) && !assignedNotStartedIds.has(task.id))
    .map((task) => boardTask(state, task, stalledByTask.get(task.id)?.detail ?? "任务出现停滞风险。"));
  const stalledIds = new Set(stalled.map((task) => task.taskId));
  const blocked = tasks
    .filter((task) => !assignedNotStartedIds.has(task.id) && !stalledIds.has(task.id) && isBlockedTask(task))
    .map((task) => boardTask(state, task, task.reviewReturnReason ? `退回原因：${task.reviewReturnReason}` : "进展说明显示任务被阻塞。"));
  const blockedIds = new Set(blocked.map((task) => task.taskId));
  const pendingReview = tasks
    .filter((task) => task.status === "pending_review" && !blockedIds.has(task.id))
    .map((task) => boardTask(state, task, "等待项目负责人验收。"));
  const pendingReviewIds = new Set(pendingReview.map((task) => task.taskId));
  const nearFinish = tasks
    .filter((task) =>
      !assignedNotStartedIds.has(task.id) &&
      !stalledIds.has(task.id) &&
      !blockedIds.has(task.id) &&
      !pendingReviewIds.has(task.id) &&
      nearExpectedFinish(task, now)
    )
    .map((task) => boardTask(state, task, "预计完成时间将在 24 小时内到达。"));
  const riskIds = new Set([...assignedNotStartedIds, ...stalledIds, ...blockedIds, ...pendingReviewIds, ...nearFinish.map((task) => task.taskId)]);
  const normal = tasks
    .filter((task) => task.status !== "completed" && !riskIds.has(task.id))
    .map((task) => boardTask(state, task, "正常推进。"));

  return {
    projectId: project?.id ?? "",
    projectName: project?.name ?? "未命名项目",
    projectProgress: weightedProgress,
    activeSessions: projectSessions.map((session) => {
      const task = tasks.find((item) => item.id === session.taskId);
      return {
        workSessionId: session.id,
        taskId: session.taskId,
        taskTitle: task?.title ?? "未知任务",
        executorName: memberName(state, session.executorMemberId),
        startedAt: session.startedAt,
        elapsedSeconds: Math.max(0, Math.round((now.getTime() - new Date(session.startedAt).getTime()) / 1000)),
      };
    }),
    sections: [
      { kind: "assigned_not_started", title: "已分配未开始", tasks: assignedNotStarted },
      { kind: "stalled", title: "停滞风险", tasks: stalled },
      { kind: "blocked", title: "阻塞任务", tasks: blocked },
      { kind: "pending_review", title: "待验收", tasks: pendingReview },
      { kind: "near_finish", title: "临近预计完成", tasks: nearFinish },
      { kind: "normal", title: "正常工作", tasks: normal },
    ],
  };
};
