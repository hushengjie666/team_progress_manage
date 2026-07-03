import type { AppState, Task } from "./types";
import type { DeletedTaskSnapshot } from "./appModel";

export function deleteTaskFromState(state: AppState, task: Task, timestamp: string) {
  const committedPlanIds = state.dailyPlans.filter((plan) => plan.committedTaskIds.includes(task.id)).map((plan) => plan.id);
  const snapshot: DeletedTaskSnapshot = { task, committedPlanIds, deletedAt: timestamp };
  return {
    snapshot,
    state: {
      ...state,
      tasks: state.tasks.filter((item) => item.id !== task.id),
      dailyPlans: state.dailyPlans.map((plan) => ({
        ...plan,
        committedTaskIds: plan.committedTaskIds.filter((id) => id !== task.id),
      })),
      sync: {
        ...state.sync,
        tombstones: [
          ...(state.sync.tombstones ?? []).filter((item) => !(item.entity === "task" && item.id === task.id)),
          { entity: "task" as const, id: task.id, workspaceId: task.workspaceId, deletedAt: timestamp },
        ],
      },
      updatedAt: timestamp,
    },
  };
}

export function undoDeleteTaskInState(state: AppState, snapshot: DeletedTaskSnapshot, timestamp: string): AppState {
  const { task, committedPlanIds } = snapshot;
  return {
    ...state,
    tasks: state.tasks.some((item) => item.id === task.id) ? state.tasks : [task, ...state.tasks],
    dailyPlans: state.dailyPlans.map((plan) =>
      committedPlanIds.includes(plan.id) && !plan.committedTaskIds.includes(task.id)
        ? { ...plan, committedTaskIds: [...plan.committedTaskIds, task.id], updatedAt: timestamp }
        : plan,
    ),
    sync: {
      ...state.sync,
      tombstones: (state.sync.tombstones ?? []).filter((item) => !(item.entity === "task" && item.id === task.id)),
    },
    updatedAt: timestamp,
  };
}
