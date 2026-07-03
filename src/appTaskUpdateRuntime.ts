import { nowIso } from "./appModel";
import { updateTaskInState } from "./appTaskState";
import {
  assignTaskInState,
  updateTaskProgressInState,
} from "./teamProgress";
import type { AppTaskActionsRuntime, AppTaskActionsRuntimeOptions } from "./appTaskActionsTypes";
import type { Task } from "./types";

type AppTaskUpdateRuntime = Pick<
  AppTaskActionsRuntime,
  "updateTask" | "updateTaskAssignment" | "updateTaskProgress"
>;

type AppTaskUpdateRuntimeOptions = Pick<AppTaskActionsRuntimeOptions, "updateState">;

export function createAppTaskUpdateRuntime({ updateState }: AppTaskUpdateRuntimeOptions): AppTaskUpdateRuntime {
  const updateTask = (taskId: string, updater: Partial<Task> | ((task: Task) => Task)) => {
    const timestamp = nowIso();
    updateState((value) => updateTaskInState(value, taskId, updater, timestamp));
  };

  const updateTaskAssignment = (
    taskId: string,
    assignment: { projectId?: string; primaryExecutorMemberId?: string; collaboratorMemberIds?: string[] },
  ) => {
    const timestamp = nowIso();
    updateState((value) => assignTaskInState(value, taskId, assignment, timestamp));
  };

  const updateTaskProgress = (taskId: string, progressPercent: number, progressNote: string) => {
    const timestamp = nowIso();
    updateState((value) => updateTaskProgressInState(value, taskId, progressPercent, progressNote, timestamp));
  };

  return {
    updateTask,
    updateTaskAssignment,
    updateTaskProgress,
  };
}
