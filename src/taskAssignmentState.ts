import { projectMembersForProject } from "./projectMemberState";
import type { AppState } from "./types";

export function assignTaskInState(
  state: AppState,
  taskId: string,
  assignment: {
    projectId?: string;
    primaryExecutorMemberId?: string;
    collaboratorMemberIds?: string[];
  },
  timestamp = new Date().toISOString(),
): AppState {
  const currentTask = state.tasks.find((task) => task.id === taskId);
  if (!currentTask) return state;

  const projectId = assignment.projectId ?? currentTask.projectId;
  const project = state.projects.find((item) => item.id === projectId) ?? state.projects[0];
  if (!project) return state;

  const projectMembers = projectMembersForProject(state, project.id);
  const executorIds = new Set(projectMembers.filter((member) => member.roles.includes("executor")).map((member) => member.id));
  const memberIds = new Set(projectMembers.map((member) => member.id));
  const primaryExecutorMemberId =
    assignment.primaryExecutorMemberId && executorIds.has(assignment.primaryExecutorMemberId)
      ? assignment.primaryExecutorMemberId
      : assignment.primaryExecutorMemberId === undefined
        ? currentTask.primaryExecutorMemberId && executorIds.has(currentTask.primaryExecutorMemberId)
          ? currentTask.primaryExecutorMemberId
          : undefined
        : undefined;
  const collaboratorMemberIds = Array.from(new Set(assignment.collaboratorMemberIds ?? currentTask.collaboratorMemberIds ?? []))
    .filter((memberId) => memberIds.has(memberId))
    .filter((memberId) => memberId !== primaryExecutorMemberId);

  return {
    ...state,
    tasks: state.tasks.map((task) =>
      task.id === taskId
        ? {
            ...task,
            workspaceId: project.workspaceId ?? task.workspaceId,
            projectId: project.id,
            project: project.name,
            primaryExecutorMemberId,
            collaboratorMemberIds,
            updatedAt: timestamp,
          }
        : task,
    ),
    updatedAt: timestamp,
  };
}
