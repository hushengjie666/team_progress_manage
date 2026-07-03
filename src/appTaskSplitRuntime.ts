import { buildSplitTaskText, splitTaskInState } from "./appTaskSplitState";
import { nowIso } from "./appModel";
import { uid } from "./seed";
import type { AppTaskActionsRuntime, AppTaskActionsRuntimeOptions } from "./appTaskActionsTypes";

type AppTaskSplitRuntime = Pick<
  AppTaskActionsRuntime,
  "splitTask" | "confirmSplitTask"
>;

type AppTaskSplitRuntimeOptions = Pick<
  AppTaskActionsRuntimeOptions,
  "getState" | "getPendingSplit" | "updateState" | "setToast" | "setSelectedTaskId" | "setPendingSplit"
>;

export function createAppTaskSplitRuntime({
  getState,
  getPendingSplit,
  updateState,
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

    const timestamp = nowIso();
    let newTaskCount = 0;
    updateState((value) => {
      const result = splitTaskInState(value, task, titles, timestamp, () => uid("task"));
      newTaskCount = result.newTasks.length;
      return result.state;
    });
    setSelectedTaskId(task.id);
    setPendingSplit(null);
    setToast(`已拆分为 ${newTaskCount} 个子任务`);
  };

  return {
    splitTask,
    confirmSplitTask,
  };
}
