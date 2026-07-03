import type { AppState } from "./types";

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export function buildSyncStateFlattenWorkspace(state: AppState) {
  const currentWorkspaceId = state.auth.workspace?.id;
  const projectWorkspaceIds = new Map(state.projects.map((project) => [project.id, project.workspaceId ?? currentWorkspaceId]));
  const taskWorkspaceIds = new Map(
    state.tasks.map((task) => [task.id, task.workspaceId ?? projectWorkspaceIds.get(task.projectId) ?? currentWorkspaceId]),
  );

  const workspaceIdForPayload = (payload: unknown, fallback?: string) => {
    if (isObject(payload) && typeof payload.workspaceId === "string" && payload.workspaceId.trim()) {
      return payload.workspaceId;
    }
    return fallback;
  };

  return {
    currentWorkspaceId,
    projectWorkspaceId: (projectId: string) => projectWorkspaceIds.get(projectId),
    taskWorkspaceId: (taskId: string) => taskWorkspaceIds.get(taskId),
    workspaceIdForPayload,
  };
}
