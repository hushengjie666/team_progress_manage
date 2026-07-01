import type { ProjectMember, ProjectMemberRole, TeamMember } from "./types";

export const normalizeTeamMember = (member: Partial<TeamMember>, fallback: TeamMember, index: number): TeamMember => {
  const timestamp = member.updatedAt ?? member.createdAt ?? fallback.updatedAt ?? new Date().toISOString();
  return {
    id: member.id ?? (index === 0 ? fallback.id : `team_member_migrated_${index}`),
    accountId: member.accountId ?? (index === 0 ? fallback.accountId : undefined),
    name: member.name?.trim() || fallback.name,
    email: member.email,
    status: member.status ?? "active",
    createdAt: member.createdAt ?? timestamp,
    updatedAt: timestamp,
  };
};

const memberIdentityKey = (member: Pick<ProjectMember, "teamMemberId" | "accountId" | "email" | "id">) => {
  if (member.teamMemberId) return member.teamMemberId;
  if (member.accountId) return `team_member_${member.accountId}`;
  if (member.email) return `team_member_email_${member.email.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`;
  return `team_member_${member.id}`;
};

export const normalizeProjectMember = (member: Partial<ProjectMember>, fallback: ProjectMember, projectId: string, index: number): ProjectMember => {
  const timestamp = member.updatedAt ?? member.createdAt ?? fallback.updatedAt ?? new Date().toISOString();
  const allowedRoles: ProjectMemberRole[] = ["project_owner", "executor"];
  const roles = (member.roles ?? fallback.roles ?? ["project_owner", "executor"]).filter((role): role is ProjectMemberRole => allowedRoles.includes(role));
  return {
    id: member.id ?? (index === 0 ? fallback.id : `member_migrated_${index}`),
    projectId: member.projectId ?? projectId,
    teamMemberId: member.teamMemberId,
    accountId: member.accountId ?? (index === 0 ? fallback.accountId : undefined),
    name: member.name?.trim() || fallback.name,
    email: member.email,
    roles: roles.length ? roles : ["executor"],
    status: member.status ?? "active",
    createdAt: member.createdAt ?? timestamp,
    updatedAt: timestamp,
  };
};

export const migrateTeamMembers = (projectMembers: ProjectMember[], parsedTeamMembers: Partial<TeamMember>[] | undefined, fallback: TeamMember) => {
  const teamMembers = parsedTeamMembers?.length ? parsedTeamMembers.map((member, index) => normalizeTeamMember(member, fallback, index)) : [];
  const byId = new Map(teamMembers.map((member) => [member.id, member]));
  for (const projectMember of projectMembers) {
    const id = memberIdentityKey(projectMember);
    if (!byId.has(id)) {
      byId.set(id, {
        id,
        accountId: projectMember.accountId,
        name: projectMember.name,
        email: projectMember.email,
        status: projectMember.status ?? "active",
        createdAt: projectMember.createdAt,
        updatedAt: projectMember.updatedAt,
      });
    }
  }
  return Array.from(byId.values());
};

const teamMemberIdentityKey = (member: Pick<TeamMember, "accountId" | "email" | "id">) => {
  if (member.email) return `login:${member.email.trim().toLowerCase()}`;
  if (member.accountId) return `account:${member.accountId}`;
  return `id:${member.id}`;
};

export const dedupeTeamMembers = (teamMembers: TeamMember[], projectMembers: ProjectMember[], preferredAccountId?: string) => {
  const projectCountByTeamMemberId = new Map<string, number>();
  projectMembers.forEach((member) => {
    if (!member.teamMemberId || member.status === "disabled") return;
    projectCountByTeamMemberId.set(member.teamMemberId, (projectCountByTeamMemberId.get(member.teamMemberId) ?? 0) + 1);
  });
  const byKey = new Map<string, TeamMember>();
  const aliasById = new Map<string, string>();

  const pickWinner = (left: TeamMember, right: TeamMember) => {
    if (preferredAccountId) {
      if (left.accountId === preferredAccountId && right.accountId !== preferredAccountId) return left;
      if (right.accountId === preferredAccountId && left.accountId !== preferredAccountId) return right;
    }
    const leftCount = projectCountByTeamMemberId.get(left.id) ?? 0;
    const rightCount = projectCountByTeamMemberId.get(right.id) ?? 0;
    if (leftCount !== rightCount) return leftCount > rightCount ? left : right;
    return left.updatedAt >= right.updatedAt ? left : right;
  };

  teamMembers.forEach((member) => {
    const key = teamMemberIdentityKey(member);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, member);
      return;
    }
    const winner = pickWinner(existing, member);
    const loser = winner.id === existing.id ? member : existing;
    byKey.set(key, {
      ...winner,
      accountId: winner.accountId ?? loser.accountId,
      name: winner.name || loser.name,
      email: winner.email ?? loser.email,
      status: winner.status === "active" || loser.status === "active" ? "active" : winner.status,
    });
    aliasById.set(loser.id, winner.id);
  });

  const dedupedMembers = Array.from(byKey.values());
  const dedupedProjectMembers: ProjectMember[] = projectMembers.map((member) => ({
    ...member,
    teamMemberId: member.teamMemberId ? aliasById.get(member.teamMemberId) ?? member.teamMemberId : member.teamMemberId,
  }));

  const teamMemberAliases = Array.from(aliasById.entries()).map(([id, canonicalId]) => ({ id, canonicalId }));

  return { teamMembers: dedupedMembers, projectMembers: dedupedProjectMembers, teamMemberAliases };
};

export const attachTeamMembersToProjectMembers = (projectMembers: ProjectMember[], teamMembers: TeamMember[]): ProjectMember[] => {
  const byId = new Map(teamMembers.map((member) => [member.id, member]));
  const byAccount = new Map(teamMembers.filter((member) => member.accountId).map((member) => [member.accountId, member]));
  const byEmail = new Map(teamMembers.filter((member) => member.email).map((member) => [member.email?.toLowerCase(), member]));
  return projectMembers.map((projectMember) => {
    const teamMember =
      (projectMember.teamMemberId ? byId.get(projectMember.teamMemberId) : undefined) ??
      (projectMember.accountId ? byAccount.get(projectMember.accountId) : undefined) ??
      (projectMember.email ? byEmail.get(projectMember.email.toLowerCase()) : undefined) ??
      byId.get(memberIdentityKey(projectMember));
    const accountChanged = Boolean(projectMember.accountId && teamMember?.accountId && projectMember.accountId !== teamMember.accountId);
    const roles: ProjectMemberRole[] = accountChanged
      ? projectMember.roles.filter((role): role is ProjectMemberRole => role !== "project_owner")
      : projectMember.roles;
    return {
      ...projectMember,
      teamMemberId: teamMember?.id ?? projectMember.teamMemberId,
      accountId: teamMember?.accountId ?? projectMember.accountId,
      name: teamMember?.name ?? projectMember.name,
      email: teamMember?.email ?? projectMember.email,
      roles: roles.length ? roles : ["executor"],
      status: projectMember.status ?? teamMember?.status ?? "active",
    };
  });
};

const projectMemberBindingKey = (member: ProjectMember) => {
  const identity = member.teamMemberId ?? member.accountId ?? member.email?.trim().toLowerCase() ?? member.id;
  return `${member.projectId}:${identity}`;
};

export const dedupeProjectMemberBindingsWithAliases = (projectMembers: ProjectMember[]) => {
  const byBinding = new Map<string, ProjectMember>();
  const aliasById = new Map<string, string>();
  projectMembers.forEach((member) => {
    const key = projectMemberBindingKey(member);
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
    byBinding.set(key, winner);
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
