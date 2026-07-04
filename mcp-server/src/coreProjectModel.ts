import { buildProgressBoard } from "../../src/domain.js";
import { projectMembersForProject } from "../../src/teamProgress.js";
import type { AppState, Project, ProjectMember } from "../../src/types.js";
import { sortedByUpdatedAt } from "../../src/workSessionTransitions.js";

export const memberLabel = (member?: ProjectMember) => member?.name || member?.email || "未分配";

const projectMemberIdentity = (member: ProjectMember) => member.accountId || member.email?.toLowerCase() || member.id;

export const uniqueProjectMembers = (members: ProjectMember[]) => {
  const seen = new Set<string>();
  return sortedByUpdatedAt(members).filter((member) => {
    const identity = projectMemberIdentity(member);
    if (seen.has(identity)) return false;
    seen.add(identity);
    return true;
  });
};

export const compactProject = (state: AppState, project: Project) => {
  const tasks = state.tasks.filter((task) => task.projectId === project.id && task.status !== "archived" && task.status !== "split");
  const members = projectMembersForProject(state, project.id);
  const board = buildProgressBoard(state, project.id);
  return {
    id: project.id,
    name: project.name,
    description: project.description,
    defaultExpectedStartHours: project.defaultExpectedStartHours,
    taskStageMode: project.taskStageMode ?? "software",
    archivedAt: project.archivedAt,
    progressPercent: board.projectProgress,
    taskCount: tasks.length,
    memberCount: members.length,
    pendingReviewCount: tasks.filter((task) => task.status === "pending_review").length,
    inProgressCount: tasks.filter((task) => task.status === "in_progress").length,
    riskCount: board.sections.reduce((sum, section) => sum + (section.kind === "normal" ? 0 : section.tasks.length), 0),
    updatedAt: project.updatedAt,
  };
};

export const unbindProjectMemberInState = (state: AppState, projectMemberId: string, timestamp: string): AppState => {
  const member = state.projectMembers.find((item) => item.id === projectMemberId);
  if (!member) throw new Error(`Project member not found: ${projectMemberId}`);
  return {
    ...state,
    projectMembers: state.projectMembers.filter((item) => item.id !== projectMemberId),
    tasks: state.tasks.map((task) => {
      const touched =
        task.creatorMemberId === projectMemberId ||
        task.primaryExecutorMemberId === projectMemberId ||
        task.collaboratorMemberIds?.includes(projectMemberId);
      return touched
        ? {
            ...task,
            creatorMemberId: task.creatorMemberId === projectMemberId ? undefined : task.creatorMemberId,
            primaryExecutorMemberId: task.primaryExecutorMemberId === projectMemberId ? undefined : task.primaryExecutorMemberId,
            collaboratorMemberIds: task.collaboratorMemberIds?.filter((id) => id !== projectMemberId) ?? [],
            updatedAt: timestamp,
          }
        : task;
    }),
    updatedAt: timestamp,
  };
};
