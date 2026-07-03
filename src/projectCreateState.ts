import { uid } from "./seed";
import type { AppState, Project, TaskStageMode } from "./types";
import type { IdFactory } from "./teamProgressUtils";

const nextProjectSortOrder = (projects: Project[]) => {
  const orders = projects.map((project) => project.sortOrder).filter((value): value is number => Number.isFinite(value));
  if (orders.length) return Math.max(...orders) + 1000;
  return projects.length * 1000;
};

export function createProjectInState(
  state: AppState,
  name: string,
  description: string,
  timestamp = new Date().toISOString(),
  idFactory: IdFactory = uid,
  owner?: { accountId?: string; name?: string; email?: string; workspaceId?: string; taskStageMode?: TaskStageMode },
): AppState {
  const projectId = idFactory("project");
  const memberId = idFactory("member");
  const workspaceId = owner?.workspaceId ?? state.auth.workspace?.id ?? state.projects[0]?.workspaceId;
  const ownerName = owner?.name?.trim() || state.auth.account?.name || "项目负责人";
  const ownerEmail = owner?.email?.trim() || state.auth.account?.email;
  return {
    ...state,
    projects: [
      {
        id: projectId,
        workspaceId,
        name: name.trim() || "新项目",
        description: description.trim(),
        defaultExpectedStartHours: 24,
        taskStageMode: owner?.taskStageMode ?? "regular",
        sortOrder: nextProjectSortOrder(state.projects),
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      ...state.projects,
    ],
    projectMembers: [
      {
        id: memberId,
        workspaceId,
        projectId,
        accountId: owner?.accountId ?? state.auth.account?.id,
        name: ownerName,
        email: ownerEmail,
        roles: ["project_owner", "executor"],
        status: "active",
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      ...state.projectMembers,
    ],
    updatedAt: timestamp,
  };
}
