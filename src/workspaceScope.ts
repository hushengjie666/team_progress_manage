import { workspaceIdForProject } from "./accessControl";
import type { AppState, Workspace } from "./types";

export const validWorkspaceSelection = (workspaces: Workspace[], workspaceId: string | null) =>
  workspaceId && workspaces.some((workspace) => workspace.id === workspaceId) ? workspaceId : null;

export const projectIdsForWorkspace = (state: AppState, workspaceId: string | null) =>
  new Set(
    state.projects
      .filter((project) => !workspaceId || workspaceIdForProject(state, project) === workspaceId)
      .map((project) => project.id),
  );

export const filterProjectItemsForWorkspace = <T extends { projectId: string }>(
  items: T[],
  projectIds: Set<string>,
) => items.filter((item) => projectIds.has(item.projectId));

export function mergeScopedProjectOrder(
  allProjectIds: string[],
  scopedProjectIds: string[],
  orderedScopedProjectIds: string[],
) {
  const scopedSet = new Set(scopedProjectIds);
  const seen = new Set<string>();
  const completeScopedOrder = [
    ...orderedScopedProjectIds.filter((projectId) => {
      if (!scopedSet.has(projectId) || seen.has(projectId)) return false;
      seen.add(projectId);
      return true;
    }),
    ...allProjectIds.filter((projectId) => scopedSet.has(projectId) && !seen.has(projectId)),
  ];
  let scopedIndex = 0;
  return allProjectIds.map((projectId) =>
    scopedSet.has(projectId) ? completeScopedOrder[scopedIndex++] ?? projectId : projectId,
  );
}
