import { uid } from "./seed";
import type { AppState, Project } from "./types";
import type { IdFactory } from "./teamProgressUtils";

export function updateProjectInState(state: AppState, project: Project, timestamp = new Date().toISOString(), _idFactory: IdFactory = uid): AppState {
  const existingProject = state.projects.find((item) => item.id === project.id);
  const previousWorkspaceId = existingProject?.workspaceId ?? state.auth.workspace?.id;
  const nextWorkspaceId = project.workspaceId;
  const workspaceChanged = Boolean(existingProject && previousWorkspaceId !== nextWorkspaceId);
  const projectTaskIds = new Set(state.tasks.filter((task) => task.projectId === project.id).map((task) => task.id));
  return {
    ...state,
    projects: state.projects.map((item) => (item.id === project.id ? { ...project, updatedAt: timestamp } : item)),
    projectMembers: state.projectMembers.map((member) =>
      workspaceChanged && member.projectId === project.id
        ? {
            ...member,
            workspaceId: nextWorkspaceId,
            accountId: member.accountId,
            name: member.name,
            email: member.email,
            status: member.status ?? "active",
            updatedAt: timestamp,
          }
        : member,
    ),
    tasks: state.tasks.map((task) =>
      task.projectId === project.id
        ? {
            ...task,
            workspaceId: nextWorkspaceId,
            project: project.name,
            updatedAt:
              workspaceChanged || task.project !== project.name
                ? timestamp
                : task.updatedAt,
        }
        : task,
    ),
    workSessions: state.workSessions.map((session) =>
      workspaceChanged && projectTaskIds.has(session.taskId)
        ? { ...session, workspaceId: nextWorkspaceId, updatedAt: timestamp }
        : session,
    ),
    executionSignals: state.executionSignals.map((signal) =>
      workspaceChanged && projectTaskIds.has(signal.taskId)
        ? { ...signal, workspaceId: nextWorkspaceId }
        : signal,
    ),
    focusSessions: state.focusSessions.map((session) =>
      workspaceChanged && session.taskId && projectTaskIds.has(session.taskId)
        ? { ...session, workspaceId: nextWorkspaceId }
        : session,
    ),
    interruptions: state.interruptions.map((interruption) =>
      workspaceChanged && interruption.taskId && projectTaskIds.has(interruption.taskId)
        ? { ...interruption, workspaceId: nextWorkspaceId }
        : interruption,
    ),
    updatedAt: timestamp,
  };
}
