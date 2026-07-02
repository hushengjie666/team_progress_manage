import type { ProjectMember, ProjectMemberRole } from "./types";

type LegacyTeamMember = {
  id?: string;
  workspaceId?: string;
  accountId?: string;
  name?: string;
  email?: string;
  status?: "active" | "disabled";
  createdAt?: string;
  updatedAt?: string;
};

type LegacyProjectMember = Partial<ProjectMember> & {
  teamMemberId?: string;
};

const normalizedEmail = (email?: string) => email?.trim().toLowerCase();

const sameWorkspace = (left?: string, right?: string) => !left || !right || left === right;

const scopedIdentityKey = (workspaceId: string | undefined, kind: string, value: string | undefined) =>
  `workspace:${workspaceId ?? "unknown"}:${kind}:${value ?? ""}`;

const buildLegacyTeamMemberIndexes = (legacyTeamMembers: LegacyTeamMember[] = []) => {
  const byId = new Map<string, LegacyTeamMember>();
  const byAccount = new Map<string, LegacyTeamMember>();
  const byEmail = new Map<string, LegacyTeamMember>();
  legacyTeamMembers.forEach((member) => {
    if (member.id) byId.set(member.id, member);
    if (member.accountId) byAccount.set(scopedIdentityKey(member.workspaceId, "account", member.accountId), member);
    const email = normalizedEmail(member.email);
    if (email) byEmail.set(scopedIdentityKey(member.workspaceId, "email", email), member);
  });
  return { byId, byAccount, byEmail };
};

const legacyTeamMemberForProjectMember = (
  member: LegacyProjectMember,
  legacyTeamMembers: LegacyTeamMember[] = [],
) => {
  const { byId, byAccount, byEmail } = buildLegacyTeamMemberIndexes(legacyTeamMembers);
  const byLegacyId = member.teamMemberId ? byId.get(member.teamMemberId) : undefined;
  if (byLegacyId && sameWorkspace(byLegacyId.workspaceId, member.workspaceId)) return byLegacyId;
  if (member.accountId) {
    const byAccountMatch = byAccount.get(scopedIdentityKey(member.workspaceId, "account", member.accountId));
    if (byAccountMatch) return byAccountMatch;
  }
  const email = normalizedEmail(member.email);
  if (email) {
    const byEmailMatch = byEmail.get(scopedIdentityKey(member.workspaceId, "email", email));
    if (byEmailMatch) return byEmailMatch;
  }
  return undefined;
};

export const normalizeProjectMember = (
  member: LegacyProjectMember,
  fallback: ProjectMember,
  projectId: string,
  index: number,
  legacyTeamMembers: LegacyTeamMember[] = [],
): ProjectMember => {
  const timestamp = member.updatedAt ?? member.createdAt ?? fallback.updatedAt ?? new Date().toISOString();
  const allowedRoles: ProjectMemberRole[] = ["project_owner", "executor"];
  const roles = (member.roles ?? fallback.roles ?? ["project_owner", "executor"]).filter((role): role is ProjectMemberRole => allowedRoles.includes(role));
  const legacyTeamMember = legacyTeamMemberForProjectMember(member, legacyTeamMembers);
  const accountChanged = Boolean(member.accountId && legacyTeamMember?.accountId && member.accountId !== legacyTeamMember.accountId);
  const effectiveRoles = accountChanged
    ? roles.filter((role): role is ProjectMemberRole => role !== "project_owner")
    : roles;
  return {
    id: member.id ?? (index === 0 ? fallback.id : `member_migrated_${index}`),
    workspaceId: member.workspaceId ?? legacyTeamMember?.workspaceId ?? fallback.workspaceId,
    projectId: member.projectId ?? projectId,
    accountId: member.accountId ?? legacyTeamMember?.accountId ?? (index === 0 ? fallback.accountId : undefined),
    name: legacyTeamMember?.name?.trim() || member.name?.trim() || fallback.name,
    email: member.email ?? legacyTeamMember?.email,
    roles: effectiveRoles.length ? effectiveRoles : ["executor"],
    status: member.status ?? legacyTeamMember?.status ?? "active",
    createdAt: member.createdAt ?? legacyTeamMember?.createdAt ?? timestamp,
    updatedAt: timestamp,
  };
};

const projectMemberBindingAliases = (member: ProjectMember) => {
  const aliases: string[] = [];
  if (member.accountId) aliases.push(`${member.projectId}:account:${member.accountId}`);
  const email = normalizedEmail(member.email);
  if (email) aliases.push(`${member.projectId}:email:${email}`);
  return aliases.length ? aliases : [`${member.projectId}:member:${member.id}`];
};

export const dedupeProjectMemberBindingsWithAliases = (projectMembers: ProjectMember[]) => {
  const byBinding = new Map<string, ProjectMember>();
  const bindingKeyByAlias = new Map<string, string>();
  const aliasById = new Map<string, string>();
  projectMembers.forEach((member) => {
    const aliases = projectMemberBindingAliases(member);
    const existingKey = aliases
      .map((alias) => bindingKeyByAlias.get(alias))
      .find((key): key is string => Boolean(key && byBinding.has(key)));
    const key = existingKey ?? aliases[0];
    aliases.forEach((alias) => bindingKeyByAlias.set(alias, key));
    const existing = byBinding.get(key);
    if (!existing) {
      byBinding.set(key, member);
      return;
    }
    if (existing.status === "disabled" && member.status !== "disabled") {
      byBinding.set(key, member);
      aliasById.set(existing.id, member.id);
      return;
    }
    if (member.status === "disabled" && existing.status !== "disabled") {
      aliasById.set(member.id, existing.id);
      return;
    }
    const winner = member.updatedAt >= existing.updatedAt ? member : existing;
    const loser = winner.id === existing.id ? member : existing;
    byBinding.set(key, {
      ...winner,
      accountId: winner.accountId ?? loser.accountId,
      name: winner.name || loser.name,
      email: winner.email ?? loser.email,
      roles: winner.roles,
      status: winner.status === "active" || loser.status === "active" ? "active" : winner.status,
    });
    aliasById.set(loser.id, winner.id);
  });

  const resolveCanonicalId = (id: string): string => {
    let current = id;
    const seen = new Set<string>();
    while (aliasById.has(current) && !seen.has(current)) {
      seen.add(current);
      current = aliasById.get(current)!;
    }
    return current;
  };

  return {
    projectMembers: Array.from(byBinding.values()),
    projectMemberAliases: Array.from(aliasById.entries()).map(([id]) => ({ id, canonicalId: resolveCanonicalId(id) })),
  };
};

export const dedupeProjectMemberBindings = (projectMembers: ProjectMember[]) =>
  dedupeProjectMemberBindingsWithAliases(projectMembers).projectMembers;
