import type { AppTaskActionsRuntime, AppTaskActionsRuntimeOptions } from "./appTaskActionsTypes";

type AppTaskReviewRuntime = Pick<
  AppTaskActionsRuntime,
  "completeTask" | "acceptTask" | "returnTaskForReview"
>;

type AppTaskReviewRuntimeOptions = Pick<
  AppTaskActionsRuntimeOptions,
  "getState" | "runTeamCommand" | "setToast" | "setSelectedTaskId" | "setPreferredFocusTaskId"
>;

export function createAppTaskReviewRuntime({
  getState,
  runTeamCommand,
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
    void runTeamCommand({ kind: "action", resource: "tasks", id: taskId, action: "submit-review", workspaceId: task.workspaceId });
    setPreferredFocusTaskId(taskId);
    setToast("已提交验收，等待项目负责人确认");
  };

  const acceptTask = (taskId: string) => {
    const task = getState().tasks.find((item) => item.id === taskId);
    if (!task) return;
    void runTeamCommand({ kind: "action", resource: "tasks", id: taskId, action: "accept-review", workspaceId: task.workspaceId, idempotencyKey: `accept-review:${taskId}` });
    setSelectedTaskId((current) => (current === taskId ? null : current));
    setToast("验收通过，任务已完成");
  };

  const returnTaskForReview = (taskId: string, reason: string) => {
    const task = getState().tasks.find((item) => item.id === taskId);
    if (!task) return;
    void runTeamCommand({ kind: "action", resource: "tasks", id: taskId, action: "return-review", workspaceId: task.workspaceId, payload: { reason } });
    setToast("已退回任务并记录原因");
  };

  return {
    completeTask,
    acceptTask,
    returnTaskForReview,
  };
}
