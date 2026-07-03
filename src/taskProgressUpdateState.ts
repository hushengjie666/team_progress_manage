import { clampProgressPercent } from "./teamProgressUtils";
import type { AppState } from "./types";

export function updateTaskProgressInState(
  state: AppState,
  taskId: string,
  progressPercent: number,
  progressNote: string,
  timestamp = new Date().toISOString(),
): AppState {
  return {
    ...state,
    tasks: state.tasks.map((task) =>
      task.id === taskId
        ? {
            ...task,
            progressPercent: clampProgressPercent(progressPercent),
            progressNote,
            updatedAt: timestamp,
          }
        : task,
    ),
    updatedAt: timestamp,
  };
}
