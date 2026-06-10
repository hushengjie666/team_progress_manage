import { uid } from "./seed";
import type { AppState, Project, ProjectMember, ProjectMemberRole } from "./types";

type IdFactory = (prefix: string) => string;

const cleanRoles = (roles: ProjectMemberRole[]): ProjectMemberRole[] =>
  roles.filter((role, index) => roles.indexOf(role) === index);

export function createProjectInState(
  state: AppState,
  name: string,
  description: string,
  timestamp = new Date().toISOString(),
  idFactory: IdFactory = uid,
): AppState {
  const projectId = idFactory("project");
  const memberId = idFactory("member");
  return {
    ...state,
    currentMemberId: state.currentMemberId ?? memberId,
    projects: [
      {
        id: projectId,
        name: name.trim() || "新项目",
        description: description.trim(),
        defaultExpectedStartHours: 24,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      ...state.projects,
    ],
    projectMembers: [
      {
        id: memberId,
        projectId,
        name: "项目负责人",
        roles: ["project_owner", "executor"],
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      ...state.projectMembers,
    ],
    updatedAt: timestamp,
  };
}

export function updateProjectInState(state: AppState, project: Project, timestamp = new Date().toISOString()): AppState {
  return {
    ...state,
    projects: state.projects.map((item) => (item.id === project.id ? { ...project, updatedAt: timestamp } : item)),
    updatedAt: timestamp,
  };
}

export function addProjectMemberToState(
  state: AppState,
  projectId: string,
  name: string,
  email: string,
  roles: ProjectMemberRole[],
  timestamp = new Date().toISOString(),
  idFactory: IdFactory = uid,
): AppState {
  return {
    ...state,
    projectMembers: [
      {
        id: idFactory("member"),
        projectId,
        name: name.trim() || "新成员",
        email: email.trim() || undefined,
        roles: cleanRoles(roles).length ? cleanRoles(roles) : ["executor"],
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      ...state.projectMembers,
    ],
    updatedAt: timestamp,
  };
}

export function updateProjectMemberInState(state: AppState, member: ProjectMember, timestamp = new Date().toISOString()): AppState {
  return {
    ...state,
    projectMembers: state.projectMembers.map((item) =>
      item.id === member.id ? { ...member, roles: cleanRoles(member.roles).length ? cleanRoles(member.roles) : ["executor"], updatedAt: timestamp } : item,
    ),
    updatedAt: timestamp,
  };
}

export function projectMembersForProject(state: AppState, projectId: string) {
  return state.projectMembers.filter((member) => member.projectId === projectId);
}

export function executorsForProject(state: AppState, projectId: string) {
  return projectMembersForProject(state, projectId).filter((member) => member.roles.includes("executor"));
}

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
