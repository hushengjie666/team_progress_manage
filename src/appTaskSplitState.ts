import { resolveMemberIdForProject } from "./memberIdentity";
import type { AppState, Task } from "./types";
import { emptyTaskDefaults, getTodayPlan } from "./appModel";
import { workspaceIdForTask } from "./dailyPlanScope";

export function buildSplitTaskText(task: Task) {
  const partCount = Math.min(Math.max(2, task.estimatePomodoros), 8);
  return Array.from({ length: partCount }, (_, index) => `${task.title} ${index + 1}`).join("\n");
}

export function splitTaskInState(
  state: AppState,
  task: Task,
  titles: string[],
  timestamp: string,
  createTaskId: () => string,
): { state: AppState; newTasks: Task[] } {
  const currentPlan = getTodayPlan(state);
  const committed = task.status === "committed" || currentPlan.committedTaskIds.includes(task.id);
  const workspaceId = workspaceIdForTask(state, task);
  const estimatePerTask = Math.max(1, Math.ceil(task.estimatePomodoros / titles.length));
  const newTasks: Task[] = titles.map((title, index) => ({
    id: createTaskId(),
    workspaceId,
    title,
    notes: `由「${task.title}」拆分而来。`,
    tags: task.tags,
    projectId: task.projectId,
    project: task.project,
    creatorMemberId: resolveMemberIdForProject(state, task.projectId) ?? task.creatorMemberId,
    primaryExecutorMemberId: task.primaryExecutorMemberId,
    collaboratorMemberIds: task.collaboratorMemberIds ?? [],
    expectedStartAt: task.expectedStartAt,
    expectedFinishAt: task.expectedFinishAt,
    progressPercent: 0,
    progressNote: "",
    priority: task.priority,
    severity: task.severity,
    stage: task.stage,
    estimatePomodoros: estimatePerTask,
    status: committed ? "committed" : "pool",
    ...emptyTaskDefaults(timestamp, task.sortOrder + index + 1),
    dueAt: task.dueAt,
    reminderAt: index === 0 ? task.reminderAt : undefined,
    repeatRule: task.repeatRule,
    repeatIntervalDays: task.repeatIntervalDays,
  }));

  return {
    newTasks,
    state: {
      ...state,
      tasks: [
        ...newTasks,
        ...state.tasks.map((item) =>
          item.id === task.id
            ? {
                ...item,
                status: "split" as const,
                notes: [
                  item.notes,
                  `已拆分为：${titles.join("、")}。`,
                ].filter(Boolean).join("\n"),
                updatedAt: timestamp,
              }
            : item,
        ),
      ],
      dailyPlans: state.dailyPlans.map((plan) => ({
        ...plan,
        committedTaskIds: plan.committedTaskIds.flatMap((id) => (id === task.id ? newTasks.map((item) => item.id) : [id])),
        updatedAt: plan.committedTaskIds.includes(task.id) ? timestamp : plan.updatedAt,
      })),
      updatedAt: timestamp,
    },
  };
}
