import { buildSplitTaskText } from "./appTaskSplitState";
import type { AppTaskActionsRuntime, AppTaskActionsRuntimeOptions } from "./appTaskActionsTypes";

type AppTaskSplitRuntime = Pick<
  AppTaskActionsRuntime,
  "splitTask" | "confirmSplitTask"
>;

type AppTaskSplitRuntimeOptions = Pick<
  AppTaskActionsRuntimeOptions,
  "getState" | "getPendingSplit" | "runTeamCommand" | "setToast" | "setSelectedTaskId" | "setPendingSplit"
>;

export function createAppTaskSplitRuntime({
  getState,
  getPendingSplit,
  runTeamCommand,
  setToast,
  setSelectedTaskId,
  setPendingSplit,
}: AppTaskSplitRuntimeOptions): AppTaskSplitRuntime {
  const splitTask = (taskId: string) => {
    const task = getState().tasks.find((item) => item.id === taskId);
    if (!task) return;
    setPendingSplit({ task, text: buildSplitTaskText(task) });
  };

  const confirmSplitTask = () => {
    const pendingSplit = getPendingSplit();
    if (!pendingSplit) return;
    const task = pendingSplit.task;
    const titles = pendingSplit.text
      .split(/[\n,，]+/)
      .map((item) => item.trim())
      .filter(Boolean);
    if (titles.length < 2) {
      setToast("至少需要两个子任务标题");
      return;
    }

    void runTeamCommand({
      kind: "action",
      resource: "tasks",
      id: task.id,
      action: "split",
      workspaceId: task.workspaceId,
      payload: { child_titles: titles },
      idempotencyKey: `split:${task.id}:${titles.join("|")}`,
    }).then((saved) => {
      if (!saved) return;
      setSelectedTaskId(task.id);
      setPendingSplit(null);
      setToast(`已拆分为 ${titles.length} 个子任务`);
    });
  };

  return {
    splitTask,
    confirmSplitTask,
  };
}
