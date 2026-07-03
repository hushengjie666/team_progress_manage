import {
  memberAccessIdentityAliases,
  memberAccessIdentityKey,
  memberIdentityForProjectMember,
} from "./accessIdentity";
import type { ProjectMember } from "./types";

const projectMemberIdentityScope = (member: ProjectMember) => `${member.workspaceId ?? ""}:${member.projectId}`;

const compareProjectMemberFreshness = (left: ProjectMember, right: ProjectMember) =>
  (left.updatedAt ?? "").localeCompare(right.updatedAt ?? "");

export const dedupeProjectMembersByIdentity = (members: ProjectMember[]): ProjectMember[] => {
  const canonicalByIdentity = new Map<string, ProjectMember>();
  const aliasToIdentity = new Map<string, string>();

  for (const member of members) {
    const scope = projectMemberIdentityScope(member);
    const identity = memberIdentityForProjectMember(member);
    const aliases = memberAccessIdentityAliases(identity).map((alias) => `${scope}:${alias}`);
    const existingIdentity = aliases
      .map((alias) => aliasToIdentity.get(alias))
      .find((key): key is string => Boolean(key && canonicalByIdentity.has(key)));
    const identityKey = existingIdentity ?? `${scope}:${memberAccessIdentityKey(identity)}`;
    aliases.forEach((alias) => aliasToIdentity.set(alias, identityKey));

    const current = canonicalByIdentity.get(identityKey);
    if (!current || compareProjectMemberFreshness(member, current) > 0) {
      canonicalByIdentity.set(identityKey, member);
    }
  }

  const canonicalIds = new Set(Array.from(canonicalByIdentity.values()).map((member) => member.id));
  return members.filter((member) => canonicalIds.has(member.id));
};
