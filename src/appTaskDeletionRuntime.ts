import { deleteTaskFromState } from "./appTaskDeletionState";
import { nowIso } from "./appModel";
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
  | "runTeamCommand"
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
  runTeamCommand,
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
    const snapshot = deleteTaskFromState(getState(), pendingDeleteTask, nowIso()).snapshot;
    void runTeamCommand({ kind: "delete", entity: "task", id: taskId, workspaceId: pendingDeleteTask.workspaceId })
      .then((saved) => {
        if (!saved) return;
        if (getSelectedTaskId() === taskId) setSelectedTaskId(null);
        setPendingDeleteTask(null);
        setDeletedTaskSnapshot(snapshot);
        if (undoTimerRef.current) window.clearTimeout(undoTimerRef.current);
        undoTimerRef.current = window.setTimeout(() => setDeletedTaskSnapshot(null), 8_000);
        setToast("任务已删除，可在 8 秒内撤销");
      });
  };

  const undoDeleteTask = () => {
    const deletedTaskSnapshot = getDeletedTaskSnapshot();
    if (!deletedTaskSnapshot) return;
    const { task } = deletedTaskSnapshot;
    void runTeamCommand({ kind: "create", entity: "task", workspaceId: task.workspaceId, payload: task as unknown as Record<string, unknown> })
      .then((saved) => {
        if (!saved) return;
        setSelectedTaskId(task.id);
        setDeletedTaskSnapshot(null);
        if (undoTimerRef.current) window.clearTimeout(undoTimerRef.current);
        setToast("已撤销删除");
      });
  };

  return {
    deleteTask,
    confirmDeleteTask,
    undoDeleteTask,
  };
}
