import { deriveRewardState } from "./domain";
import { generateRecurringTask } from "./recurrence";
import { resolveMemberIdForProject } from "./memberIdentity";
import { nowIso } from "./appModel";
import {
  acceptTaskInState,
  returnTaskForReviewInState,
  submitTaskForReviewInState,
} from "./teamProgress";
import type { AppTaskActionsRuntime, AppTaskActionsRuntimeOptions } from "./appTaskActionsTypes";
import type { AppState } from "./types";

type AppTaskReviewRuntime = Pick<
  AppTaskActionsRuntime,
  "completeTask" | "acceptTask" | "returnTaskForReview"
>;

type AppTaskReviewRuntimeOptions = Pick<
  AppTaskActionsRuntimeOptions,
  "getState" | "updateState" | "setToast" | "setSelectedTaskId" | "setPreferredFocusTaskId"
>;

const actorMemberIdForTask = (state: AppState, taskId: string) => {
  const task = state.tasks.find((item) => item.id === taskId);
  return task ? resolveMemberIdForProject(state, task.projectId) : undefined;
};

export function createAppTaskReviewRuntime({
  getState,
  updateState,
  setToast,
  setSelectedTaskId,
  setPreferredFocusTaskId,
}: AppTaskReviewRuntimeOptions): AppTaskReviewRuntime {
  const completeTask = (taskId: string) => {
    const task = getState().tasks.find((item) => item.id === taskId);
    if (!task) return;
    if (task.status === "pending_review") {
      setToast("该任务已提交验收，等待项目负责人确认");
      return;
    }
    if (task.status === "completed") {
      setToast("任务已完成，无需重复提交");
      return;
    }
    if (task.status === "pool") {
      setToast("请先加入工作队列或开始执行后再提交验收");
      return;
    }
    if (task.status === "split" || task.status === "archived") {
      setToast("当前状态不能提交验收");
      return;
    }
    const timestamp = nowIso();
    updateState((value) => submitTaskForReviewInState(value, taskId, actorMemberIdForTask(value, taskId), timestamp));
    setPreferredFocusTaskId(taskId);
    setToast("已提交验收，等待项目负责人确认");
  };

  const acceptTask = (taskId: string) => {
    const timestamp = nowIso();
    updateState((value) => {
      const acceptedState = acceptTaskInState(value, taskId, actorMemberIdForTask(value, taskId), timestamp);
      const acceptedTask = acceptedState.tasks.find((task) => task.id === taskId && task.status === "completed");
      const recurringTask = acceptedTask ? generateRecurringTask(acceptedTask, timestamp) : null;
      const nextState = {
        ...acceptedState,
        tasks: recurringTask ? [...acceptedState.tasks, recurringTask] : acceptedState.tasks,
        updatedAt: timestamp,
      };
      return {
        ...nextState,
        rewardState: deriveRewardState(nextState, timestamp),
      };
    });
    setSelectedTaskId((current) => (current === taskId ? null : current));
    setToast("验收通过，任务已完成");
  };

  const returnTaskForReview = (taskId: string, reason: string) => {
    const timestamp = nowIso();
    updateState((value) => returnTaskForReviewInState(value, taskId, reason, actorMemberIdForTask(value, taskId), timestamp));
    setToast("已退回任务并记录原因");
  };

  return {
    completeTask,
    acceptTask,
    returnTaskForReview,
  };
}
