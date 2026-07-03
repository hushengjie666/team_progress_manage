import { uid } from "./seed";
import type { AppState, Project } from "./types";
import type { IdFactory } from "./teamProgressUtils";

export function updateProjectInState(state: AppState, project: Project, timestamp = new Date().toISOString(), _idFactory: IdFactory = uid): AppState {
  const existingProject = state.projects.find((item) => item.id === project.id);
  const previousWorkspaceId = existingProject?.workspaceId ?? state.auth.workspace?.id;
  const nextWorkspaceId = project.workspaceId;
  const workspaceChanged = Boolean(existingProject && previousWorkspaceId !== nextWorkspaceId);
  const projectTaskIds = new Set(state.tasks.filter((task) => task.projectId === project.id).map((task) => task.id));
  const movedProjectMemberIds = state.projectMembers.filter((member) => member.projectId === project.id).map((member) => member.id);
  const movedWorkSessionIds = state.workSessions.filter((session) => projectTaskIds.has(session.taskId)).map((session) => session.id);
  const movedExecutionSignalIds = state.executionSignals.filter((signal) => projectTaskIds.has(signal.taskId)).map((signal) => signal.id);
  const movedFocusSessionIds = state.focusSessions.filter((session) => session.taskId && projectTaskIds.has(session.taskId)).map((session) => session.id);
  const movedInterruptionIds = state.interruptions.filter((interruption) => interruption.taskId && projectTaskIds.has(interruption.taskId)).map((interruption) => interruption.id);
  const movedEntityTombstones = workspaceChanged && previousWorkspaceId
    ? [
        { entity: "project" as const, id: project.id, workspaceId: previousWorkspaceId, deletedAt: timestamp },
        ...Array.from(projectTaskIds).map((id) => ({ entity: "task" as const, id, workspaceId: previousWorkspaceId, deletedAt: timestamp })),
        ...movedProjectMemberIds.map((id) => ({ entity: "project_member" as const, id, workspaceId: previousWorkspaceId, deletedAt: timestamp })),
        ...movedWorkSessionIds.map((id) => ({ entity: "work_session" as const, id, workspaceId: previousWorkspaceId, deletedAt: timestamp })),
        ...movedExecutionSignalIds.map((id) => ({ entity: "execution_signal" as const, id, workspaceId: previousWorkspaceId, deletedAt: timestamp })),
        ...movedFocusSessionIds.map((id) => ({ entity: "focus_session" as const, id, workspaceId: previousWorkspaceId, deletedAt: timestamp })),
        ...movedInterruptionIds.map((id) => ({ entity: "interruption" as const, id, workspaceId: previousWorkspaceId, deletedAt: timestamp })),
      ]
    : [];
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
    sync: {
      ...state.sync,
      tombstones: [
        ...(state.sync.tombstones ?? []),
        ...movedEntityTombstones,
      ],
    },
    updatedAt: timestamp,
  };
}
