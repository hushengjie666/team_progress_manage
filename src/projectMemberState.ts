import { uid } from "./seed";
import type { AppState, ProjectMember, ProjectMemberRole } from "./types";
import {
  cleanRoles,
  normalizedEmail,
  type IdFactory,
} from "./teamProgressUtils";

export function addProjectMemberToState(
  state: AppState,
  projectId: string,
  name: string,
  email: string,
  roles: ProjectMemberRole[],
  timestamp = new Date().toISOString(),
  idFactory: IdFactory = uid,
  identity: { accountId?: string; workspaceId?: string } = {},
): AppState {
  const project = state.projects.find((item) => item.id === projectId);
  const workspaceId = project?.workspaceId ?? identity.workspaceId ?? state.auth.workspace?.id;
  const normalizedName = name.trim() || "新成员";
  const normalizedMemberEmail = email.trim() || undefined;
  const existing = state.projectMembers.find(
    (member) =>
      member.projectId === projectId &&
      member.status !== "disabled" &&
      (
        (identity.accountId && member.accountId === identity.accountId) ||
        (normalizedMemberEmail && normalizedEmail(member.email) === normalizedEmail(normalizedMemberEmail)) ||
        member.name === normalizedName
      ),
  );
  if (existing) {
    return updateProjectMemberInState(state, {
      ...existing,
      name: normalizedName,
      email: normalizedMemberEmail ?? existing.email,
      roles,
      status: "active",
    }, timestamp);
  }
  return {
    ...state,
    projectMembers: [
      {
        id: idFactory("member"),
        workspaceId,
        projectId,
        accountId: identity.accountId,
        name: normalizedName,
        email: normalizedMemberEmail,
        roles: cleanRoles(roles).length ? cleanRoles(roles) : ["executor"],
        status: "active",
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
      item.id === member.id
        ? {
            ...member,
            accountId: member.accountId,
            name: member.name,
            email: member.email,
            roles: cleanRoles(member.roles).length ? cleanRoles(member.roles) : ["executor"],
            status: member.status ?? "active",
            updatedAt: timestamp,
          }
        : item,
    ),
    updatedAt: timestamp,
  };
}

export function projectMembersForProject(state: AppState, projectId: string) {
  return state.projectMembers.filter((member) => member.projectId === projectId && member.status !== "disabled");
}

export function executorsForProject(state: AppState, projectId: string) {
  return projectMembersForProject(state, projectId).filter((member) => member.roles.includes("executor"));
}
