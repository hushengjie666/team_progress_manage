import { compareProjectsForOverview } from "./projectOverview";
import type { AppState } from "./types";

export function reorderProjectsInState(state: AppState, orderedProjectIds: string[], timestamp = new Date().toISOString()): AppState {
  const knownProjectIds = new Set(state.projects.map((project) => project.id));
  const explicitOrder = orderedProjectIds.filter((projectId, index) =>
    knownProjectIds.has(projectId) && orderedProjectIds.indexOf(projectId) === index,
  );
  const orderedSet = new Set(explicitOrder);
  const completeOrder = [
    ...explicitOrder,
    ...[...state.projects]
      .sort(compareProjectsForOverview)
      .map((project) => project.id)
      .filter((projectId) => !orderedSet.has(projectId)),
  ];
  const sortOrderByProjectId = new Map(completeOrder.map((projectId, index) => [projectId, index * 1000]));
  let changed = false;
  const projects = state.projects.map((project) => {
    const sortOrder = sortOrderByProjectId.get(project.id);
    if (sortOrder === undefined || project.sortOrder === sortOrder) return project;
    changed = true;
    return { ...project, sortOrder, updatedAt: timestamp };
  });
  return changed ? { ...state, projects, updatedAt: timestamp } : state;
}
