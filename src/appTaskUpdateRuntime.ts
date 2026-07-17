import type { AppTaskActionsRuntime, AppTaskActionsRuntimeOptions } from "./appTaskActionsTypes";
import type { Task } from "./types";

type AppTaskUpdateRuntime = Pick<
  AppTaskActionsRuntime,
  "updateTask" | "updateTaskAssignment" | "updateTaskProgress"
>;

type AppTaskUpdateRuntimeOptions = Pick<AppTaskActionsRuntimeOptions, "getState" | "runTeamCommand">;

export function createAppTaskUpdateRuntime({ getState, runTeamCommand }: AppTaskUpdateRuntimeOptions): AppTaskUpdateRuntime {
  const updateTask = (taskId: string, updater: Partial<Task> | ((task: Task) => Task)) => {
    const source = getState();
    const current = source.tasks.find((item) => item.id === taskId);
    if (!current) return;
    const next = typeof updater === "function" ? updater(current) : { ...current, ...updater };
    void runTeamCommand({ kind: "patch", entity: "task", id: taskId, workspaceId: current.workspaceId, patch: next as unknown as Record<string, unknown> });
  };

  const updateTaskAssignment = (
    taskId: string,
    assignment: { projectId?: string; primaryExecutorMemberId?: string; collaboratorMemberIds?: string[] },
  ) => {
    const task = getState().tasks.find((item) => item.id === taskId);
    if (!task) return;
    void runTeamCommand({ kind: "patch", entity: "task", id: taskId, workspaceId: task.workspaceId, patch: assignment });
  };

  const updateTaskProgress = (taskId: string, progressPercent: number, progressNote: string) => {
    const task = getState().tasks.find((item) => item.id === taskId);
    if (!task) return;
    void runTeamCommand({ kind: "patch", entity: "task", id: taskId, workspaceId: task.workspaceId, patch: { progressPercent, progressNote } });
  };

  return {
    updateTask,
    updateTaskAssignment,
    updateTaskProgress,
  };
}
