import { deleteTaskFromState, undoDeleteTaskInState } from "./appTaskDeletionState";
import { nowIso, type DeletedTaskSnapshot } from "./appModel";
import type { AppTaskActionsRuntime, AppTaskActionsRuntimeOptions } from "./appTaskActionsTypes";

type AppTaskDeletionRuntime = Pick<
  AppTaskActionsRuntime,
  "deleteTask" | "confirmDeleteTask" | "undoDeleteTask"
>;

type AppTaskDeletionRuntimeOptions = Pick<
  AppTaskActionsRuntimeOptions,
  | "getState"
  | "getSelectedTaskId"
  | "getPendingDeleteTask"
  | "getDeletedTaskSnapshot"
  | "updateState"
  | "setToast"
  | "setSelectedTaskId"
  | "setPendingDeleteTask"
  | "setDeletedTaskSnapshot"
  | "undoTimerRef"
>;

export function createAppTaskDeletionRuntime({
  getState,
  getSelectedTaskId,
  getPendingDeleteTask,
  getDeletedTaskSnapshot,
  updateState,
  setToast,
  setSelectedTaskId,
  setPendingDeleteTask,
  setDeletedTaskSnapshot,
  undoTimerRef,
}: AppTaskDeletionRuntimeOptions): AppTaskDeletionRuntime {
  const deleteTask = (taskId: string) => {
    const target = getState().tasks.find((task) => task.id === taskId);
    if (target) setPendingDeleteTask(target);
  };

  const confirmDeleteTask = () => {
    const pendingDeleteTask = getPendingDeleteTask();
    if (!pendingDeleteTask) return;
    const taskId = pendingDeleteTask.id;
    const timestamp = nowIso();
    let snapshot: DeletedTaskSnapshot | null = null;
    updateState((value) => {
      const result = deleteTaskFromState(value, pendingDeleteTask, timestamp);
      snapshot = result.snapshot;
      return result.state;
    });
    if (getSelectedTaskId() === taskId) setSelectedTaskId(null);
    setPendingDeleteTask(null);
    setDeletedTaskSnapshot(snapshot);
    if (undoTimerRef.current) window.clearTimeout(undoTimerRef.current);
    undoTimerRef.current = window.setTimeout(() => setDeletedTaskSnapshot(null), 8_000);
    setToast("任务已删除，可在 8 秒内撤销");
  };

  const undoDeleteTask = () => {
    const deletedTaskSnapshot = getDeletedTaskSnapshot();
    if (!deletedTaskSnapshot) return;
    const { task } = deletedTaskSnapshot;
    const timestamp = nowIso();
    updateState((value) => undoDeleteTaskInState(value, deletedTaskSnapshot, timestamp));
    setSelectedTaskId(task.id);
    setDeletedTaskSnapshot(null);
    if (undoTimerRef.current) window.clearTimeout(undoTimerRef.current);
    setToast("已撤销删除");
  };

  return {
    deleteTask,
    confirmDeleteTask,
    undoDeleteTask,
  };
}
