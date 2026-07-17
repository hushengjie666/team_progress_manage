import { createProjectTaskInState, type ProjectTaskInput } from "./projectDetail";
import { uid } from "./seed";
import { createTaskFromDraft } from "./appTaskState";
import {
  createDailyPlanForDate,
  initialDraft,
  nowIso,
  today,
} from "./appModel";
import { currentAccountDailyPlanForWorkspaceDate, workspaceIdForTask } from "./dailyPlanScope";
import type { AppTaskActionsRuntime, AppTaskActionsRuntimeOptions } from "./appTaskActionsTypes";

type AppTaskCreationRuntime = Pick<
  AppTaskActionsRuntime,
  "addTask" | "createProjectTask" | "commitTask" | "removeCommittedTask" | "moveCommittedTask" | "scheduleTaskForDate"
>;

type AppTaskCreationRuntimeOptions = Pick<
  AppTaskActionsRuntimeOptions,
  "getState" | "getCurrentProjectId" | "getDraft" | "runTeamCommand" | "setDraft" | "setToast"
>;

export function createAppTaskCreationRuntime({
  getState,
  getCurrentProjectId,
  getDraft,
  runTeamCommand,
  setDraft,
  setToast,
}: AppTaskCreationRuntimeOptions): AppTaskCreationRuntime {
  const addTask = (projectId?: string) => {
    const draft = getDraft();
    const title = draft.title.trim();
    if (!title) {
      setToast("先写一个任务名称");
      return;
    }
    const timestamp = nowIso();
    const task = createTaskFromDraft({
      state: getState(),
      draft,
      projectId,
      currentProjectId: getCurrentProjectId(),
      timestamp,
      taskId: uid("task"),
      sortOrder: Date.now(),
    });
    void runTeamCommand({ kind: "create", entity: "task", workspaceId: task.workspaceId, payload: task as unknown as Record<string, unknown> })
      .then((saved) => {
        if (!saved) return;
        setDraft(initialDraft);
        setToast(task.estimatePomodoros > 7 ? "已添加，但建议拆分这个大任务" : "任务已进入活动清单");
      });
  };

  const createProjectTask = (projectId: string, input: ProjectTaskInput) => {
    const source = getState();
    const next = createProjectTaskInState(source, projectId, input, nowIso());
    const task = next.tasks.find((item) => !source.tasks.some((current) => current.id === item.id));
    if (!task) return;
    void runTeamCommand({ kind: "create", entity: "task", workspaceId: task.workspaceId, payload: task as unknown as Record<string, unknown> })
      .then((saved) => saved && setToast("项目任务已创建"));
  };

  const commitTask = (taskId: string) => {
    const source = getState();
    const task = source.tasks.find((item) => item.id === taskId);
    if (!task) return;
    const workspaceId = workspaceIdForTask(source, task);
    const plan = currentAccountDailyPlanForWorkspaceDate(source, workspaceId, today()) ?? createDailyPlanForDate(source, today(), nowIso(), workspaceId);
    void runTeamCommand({ kind: "action", resource: "daily-plans", id: plan.id, action: "add-task", workspaceId, payload: { task_id: taskId, date: today() } })
      .then((saved) => saved && setToast("已加入工作队列"));
  };

  const removeCommittedTask = (taskId: string) => {
    const source = getState();
    const task = source.tasks.find((item) => item.id === taskId);
    if (!task) return;
    const workspaceId = workspaceIdForTask(source, task);
    const plan = currentAccountDailyPlanForWorkspaceDate(source, workspaceId, today());
    if (plan) void runTeamCommand({ kind: "action", resource: "daily-plans", id: plan.id, action: "remove-task", workspaceId, payload: { task_id: taskId } });
  };

  const moveCommittedTask = (taskId: string, direction: -1 | 1) => {
    const source = getState();
    const task = source.tasks.find((item) => item.id === taskId);
    if (!task) return;
    const workspaceId = workspaceIdForTask(source, task);
    const plan = currentAccountDailyPlanForWorkspaceDate(source, workspaceId, today());
    if (plan) void runTeamCommand({ kind: "action", resource: "daily-plans", id: plan.id, action: "move-task", workspaceId, payload: { task_id: taskId, direction } });
  };

  const scheduleTaskForDate = (date: string, taskId: string) => {
    const source = getState();
    const task = source.tasks.find((item) => item.id === taskId);
    if (!task) return;
    const workspaceId = workspaceIdForTask(source, task);
    const plan = currentAccountDailyPlanForWorkspaceDate(source, workspaceId, date) ?? createDailyPlanForDate(source, date, nowIso(), workspaceId);
    void runTeamCommand({ kind: "action", resource: "daily-plans", id: plan.id, action: "add-task", workspaceId, payload: { task_id: taskId, date } })
      .then((saved) => saved && setToast(date === today() ? "已加入工作队列" : "任务已排入日历计划"));
  };

  return {
    addTask,
    createProjectTask,
    commitTask,
    removeCommittedTask,
    moveCommittedTask,
    scheduleTaskForDate,
  };
}
