import { uid } from "../../src/seed.js";
import {
  addProjectMemberToState,
  createProjectInState,
  updateProjectInState,
  updateProjectMemberInState,
} from "../../src/teamProgress.js";
import type { AppState, Project, ProjectMember, ProjectMemberRole } from "../../src/types.js";
import { requireMember, requireProject } from "./businessGuards.js";
import type { MemberInput, ProjectInput } from "./businessTypes.js";

export const createProjectInTeamState = (state: AppState, input: ProjectInput, timestamp: string) => {
  const next = createProjectInState(state, input.name, input.description ?? "", timestamp, uid, {
    accountId: state.auth.account?.id,
    name: state.auth.account?.name,
    email: state.auth.account?.email,
    workspaceId: input.workspaceId,
    taskStageMode: input.taskStageMode,
  });
  const created = next.projects.find((project) => !state.projects.some((item) => item.id === project.id));
  if (!created) throw new Error("Project was not created.");
  const project: Project = {
    ...created,
    defaultExpectedStartHours: input.defaultExpectedStartHours === undefined
      ? created.defaultExpectedStartHours
      : Math.max(0, Math.round(input.defaultExpectedStartHours)),
  };
  return updateProjectInState(next, project, timestamp);
};

export const updateProjectInTeamState = (state: AppState, projectId: string, input: Partial<ProjectInput>, timestamp: string) => {
  const project = requireProject(state, projectId);
  return updateProjectInState(state, {
    ...project,
    name: input.name?.trim() || project.name,
    description: input.description ?? project.description,
    defaultExpectedStartHours: input.defaultExpectedStartHours === undefined
      ? project.defaultExpectedStartHours
      : Math.max(0, Math.round(input.defaultExpectedStartHours)),
    taskStageMode: input.taskStageMode ?? project.taskStageMode,
  }, timestamp);
};

export const archiveProjectInTeamState = (state: AppState, projectId: string, timestamp: string) => {
  const project = requireProject(state, projectId);
  return updateProjectInState(state, { ...project, archivedAt: timestamp }, timestamp);
};

export const restoreProjectInTeamState = (state: AppState, projectId: string, timestamp: string) => {
  const project = requireProject(state, projectId);
  return updateProjectInState(state, { ...project, archivedAt: undefined }, timestamp);
};

export const createProjectMemberInTeamState = (state: AppState, input: MemberInput, timestamp: string) => {
  const project = requireProject(state, input.projectId);
  return addProjectMemberToState(
    state,
    project.id,
    input.name,
    input.email ?? "",
    input.roles ?? ["executor"],
    timestamp,
    uid,
    { accountId: input.accountId, workspaceId: project.workspaceId },
  );
};

export const updateProjectMemberInTeamState = (
  state: AppState,
  projectMemberId: string,
  input: Partial<Pick<ProjectMember, "name" | "email" | "roles" | "status">>,
  timestamp: string,
) => {
  const member = requireMember(state, projectMemberId);
  return updateProjectMemberInState(state, {
    ...member,
    name: input.name?.trim() || member.name,
    email: input.email === undefined ? member.email : input.email.trim() || undefined,
    roles: input.roles ?? member.roles,
    status: input.status ?? member.status ?? "active",
  }, timestamp);
};

export const bindMemberToProjectInTeamState = (
  state: AppState,
  projectId: string,
  memberRef: string,
  roles: ProjectMemberRole[],
  timestamp: string,
) => {
  const project = requireProject(state, projectId);
  const normalized = memberRef.trim().toLowerCase();
  const source = state.projectMembers.find(
    (member) =>
      member.id === memberRef ||
      member.accountId === memberRef ||
      member.email?.trim().toLowerCase() === normalized,
  );
  if (!source) throw new Error(`Project member source not found: ${memberRef}`);
  return addProjectMemberToState(state, project.id, source.name, source.email ?? "", roles.length ? roles : ["executor"], timestamp, uid, {
    accountId: source.accountId,
    workspaceId: project.workspaceId ?? source.workspaceId,
  });
};

export const unbindProjectMemberInTeamState = (state: AppState, projectMemberId: string, timestamp: string) =>
  updateProjectMemberInTeamState(state, projectMemberId, { status: "disabled" }, timestamp);
