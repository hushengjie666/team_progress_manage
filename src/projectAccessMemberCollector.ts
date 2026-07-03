import {
  memberAccessIdentityAliases,
  memberAccessIdentityKey,
  memberIdentityForProjectMember,
  type MemberIdentity,
} from "./accessIdentity";
import type { ProjectMember, ProjectMemberRole, WorkspaceMembership } from "./types";

export type ProjectAccessibleMember = {
  id: string;
  identityKey: string;
  accountId?: string;
  name: string;
  email?: string;
  source: "project" | "workspace";
  sourceLabel: string;
  roles: ProjectMemberRole[];
  projectMember?: ProjectMember;
  workspaceMembership?: WorkspaceMembership;
};

type WorkspaceAccessibleMemberInput = {
  name: string;
  email?: string;
  sourceLabel: string;
  workspaceMembership?: WorkspaceMembership;
};

export function createProjectAccessibleMemberCollector() {
  const rows = new Map<string, ProjectAccessibleMember>();
  const identityAliasToKey = new Map<string, string>();

  const resolveAccessibleMemberKey = (identity: MemberIdentity) => {
    const aliases = memberAccessIdentityAliases(identity);
    const existingKey = aliases
      .map((alias) => identityAliasToKey.get(alias))
      .find((key): key is string => Boolean(key && rows.has(key)));
    const identityKey = existingKey ?? memberAccessIdentityKey(identity);
    aliases.forEach((alias) => identityAliasToKey.set(alias, identityKey));
    return identityKey;
  };

  const addWorkspaceMember = (identity: MemberIdentity, value: WorkspaceAccessibleMemberInput) => {
    const identityKey = resolveAccessibleMemberKey(identity);
    const existing = rows.get(identityKey);
    if (existing) {
      rows.set(identityKey, {
        ...existing,
        email: existing.email ?? value.email,
        workspaceMembership: existing.workspaceMembership ?? value.workspaceMembership,
      });
      return;
    }
    rows.set(identityKey, {
      id: `workspace:${identityKey}`,
      identityKey,
      accountId: identity.accountId,
      name: value.name,
      email: value.email,
      source: "workspace",
      sourceLabel: value.sourceLabel,
      roles: ["executor"],
      workspaceMembership: value.workspaceMembership,
    });
  };

  const addProjectMember = (member: ProjectMember) => {
    const identityKey = resolveAccessibleMemberKey(memberIdentityForProjectMember(member));
    const existing = rows.get(identityKey);
    rows.set(identityKey, {
      id: member.id,
      identityKey,
      accountId: member.accountId ?? existing?.accountId,
      name: member.name ?? existing?.name ?? "项目成员",
      email: member.email ?? existing?.email,
      source: "project",
      sourceLabel: "项目成员",
      roles: existing ? Array.from(new Set([...existing.roles, ...member.roles])) : member.roles,
      projectMember: member,
      workspaceMembership: existing?.workspaceMembership,
    });
  };

  const members = () =>
    [...rows.values()].sort((left, right) => {
      if (left.source !== right.source) return left.source === "project" ? -1 : 1;
      return left.name.localeCompare(right.name, "zh-Hans-CN");
    });

  return {
    addWorkspaceMember,
    addProjectMember,
    members,
  };
}
