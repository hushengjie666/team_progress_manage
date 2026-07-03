import type { ProjectDetailModel } from "../../projectDetail";
import type { Project, ProjectMember, ProjectMemberRole, Workspace } from "../../types";

export type ProjectDetailMemberRoleTarget = ProjectDetailModel["accessibleProjectMembers"][number];

export const nextProjectMemberRoles = (
  currentRoles: ProjectMemberRole[],
  role: ProjectMemberRole,
  checked: boolean,
): ProjectMemberRole[] => {
  const roles = checked
    ? Array.from(new Set([...currentRoles, role]))
    : currentRoles.filter((item) => item !== role);
  return roles.length ? roles : ["executor"];
};

export const updateProjectMemberRole = ({
  member,
  role,
  checked,
  project,
  workspace,
  bindAccessibleMemberToProject,
  updateProjectMember,
}: {
  member: ProjectDetailMemberRoleTarget;
  role: ProjectMemberRole;
  checked: boolean;
  project: Project;
  workspace?: Workspace;
  bindAccessibleMemberToProject: (projectId: string, input: {
    accountId?: string;
    name: string;
    email?: string;
    workspaceId?: string;
    roles: ProjectMemberRole[];
  }) => void;
  updateProjectMember: (member: ProjectMember) => void;
}) => {
  const currentRoles = member.projectMember?.roles ?? member.roles;
  const nextRoles = nextProjectMemberRoles(currentRoles, role, checked);
  if (member.projectMember) {
    updateProjectMember({ ...member.projectMember, roles: nextRoles });
    return;
  }
  bindAccessibleMemberToProject(project.id, {
    accountId: member.workspaceMembership?.accountId,
    name: member.name,
    email: member.email,
    workspaceId: project.workspaceId ?? workspace?.id,
    roles: nextRoles,
  });
};
