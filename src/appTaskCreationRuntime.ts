import { addTaskToTodayInState } from "./workSessionTransitions";
import { createProjectTaskInState, type ProjectTaskInput } from "./projectDetail";
import { uid } from "./seed";
import { createTaskFromDraft, moveCommittedTaskInState } from "./appTaskState";
import {
  createDailyPlanForDate,
  currentAccountDailyPlanForDate,
  initialDraft,
  nowIso,
  removeTaskFromTodayInState,
  today,
} from "./appModel";
import type { AppTaskActionsRuntime, AppTaskActionsRuntimeOptions } from "./appTaskActionsTypes";
import type { DailyPlan } from "./types";

type AppTaskCreationRuntime = Pick<
  AppTaskActionsRuntime,
  "addTask" | "createProjectTask" | "commitTask" | "removeCommittedTask" | "moveCommittedTask" | "scheduleTaskForDate"
>;

type AppTaskCreationRuntimeOptions = Pick<
  AppTaskActionsRuntimeOptions,
  "getState" | "getCurrentProjectId" | "getDraft" | "updateState" | "setDraft" | "setToast"
>;

export function createAppTaskCreationRuntime({
  getState,
  getCurrentProjectId,
  getDraft,
  updateState,
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
    updateState((value) => ({ ...value, tasks: [task, ...value.tasks], updatedAt: timestamp }));
    setDraft(initialDraft);
    setToast(task.estimatePomodoros > 7 ? "已添加，但建议拆分这个大任务" : "任务已进入活动清单");
  };

  const createProjectTask = (projectId: string, input: ProjectTaskInput) => {
    const timestamp = nowIso();
    updateState((value) => createProjectTaskInState(value, projectId, input, timestamp));
    setToast("项目任务已创建");
  };

  const commitTask = (taskId: string) => {
    updateState((value) => addTaskToTodayInState(value, taskId, nowIso()));
    setToast("已加入工作队列");
  };

  const removeCommittedTask = (taskId: string) => {
    const timestamp = nowIso();
    updateState((value) => removeTaskFromTodayInState(value, taskId, timestamp));
  };

  const moveCommittedTask = (taskId: string, direction: -1 | 1) => {
    const timestamp = nowIso();
    updateState((value) => moveCommittedTaskInState(value, taskId, direction, timestamp));
  };

  const scheduleTaskForDate = (date: string, taskId: string) => {
    const timestamp = nowIso();
    if (date === today()) {
      updateState((value) => addTaskToTodayInState(value, taskId, timestamp));
      setToast("已加入工作队列");
      return;
    }
    updateState((value) => {
      const existing = currentAccountDailyPlanForDate(value, date);
      const plan: DailyPlan = existing ?? {
        ...createDailyPlanForDate(value, date, timestamp),
        capacityPomodoros: value.rewardState.dailyGoal,
        recommendedCapacityPomodoros: value.rewardState.dailyGoal,
        suggestedCapacityPomodoros: value.rewardState.dailyGoal,
        overloadAcknowledged: false,
      };
      const nextPlan = {
        ...plan,
        committedTaskIds: Array.from(new Set([...plan.committedTaskIds, taskId])),
        updatedAt: timestamp,
      };
      return {
        ...value,
        tasks: value.tasks.map((task) => (task.id === taskId && task.status === "pool" ? { ...task, status: "committed", updatedAt: timestamp } : task)),
        dailyPlans: existing ? value.dailyPlans.map((item) => (item.id === nextPlan.id ? nextPlan : item)) : [nextPlan, ...value.dailyPlans],
        updatedAt: timestamp,
      };
    });
    setToast("任务已排入日历计划");
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
