import type { ProjectMember, WorkspaceMembership } from "./types";

export type MemberIdentity = {
  id?: string;
  accountId?: string;
  email?: string;
};

export const normalizedEmail = (email?: string) => email?.trim().toLowerCase();

export const memberAccessIdentityKey = (member: MemberIdentity) => {
  if (member.accountId) return `account:${member.accountId}`;
  if (member.email) return `email:${normalizedEmail(member.email)}`;
  return `member:${member.id ?? ""}`;
};

export const memberAccessIdentityAliases = (member: MemberIdentity) => {
  const aliases: string[] = [];
  if (member.accountId) aliases.push(`account:${member.accountId}`);
  const email = normalizedEmail(member.email);
  if (email) aliases.push(`email:${email}`);
  if (member.id) aliases.push(`member:${member.id}`);
  return Array.from(new Set(aliases.length ? aliases : [memberAccessIdentityKey(member)]));
};

export const addMemberAccessIdentity = (
  identities: Set<string>,
  identityAliasToKey: Map<string, string>,
  member: MemberIdentity,
) => {
  const aliases = memberAccessIdentityAliases(member);
  const existingKey = aliases
    .map((alias) => identityAliasToKey.get(alias))
    .find((key): key is string => Boolean(key && identities.has(key)));
  const identityKey = existingKey ?? memberAccessIdentityKey(member);
  aliases.forEach((alias) => identityAliasToKey.set(alias, identityKey));
  identities.add(identityKey);
};

export const memberIdentityForProjectMember = (member: ProjectMember) => ({
  id: member.id,
  accountId: member.accountId,
  email: member.email,
});

export const memberIdentityForWorkspaceMembership = (membership: WorkspaceMembership) => ({
  id: membership.id,
  accountId: membership.accountId,
  email: membership.email,
});
