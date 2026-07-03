import type { ProjectMember, WorkspaceMembership } from "./types";
import type { MemberStatusPerson } from "./memberStatusTypes";

type MemberStatusPersonDraft = MemberStatusPerson & {
  identityKeys: string[];
};

const normalizedEmail = (email?: string) => email?.trim().toLowerCase();

const memberStatusIdentityKeys = (identity: {
  id?: string;
  accountId?: string;
  email?: string;
}) => [
  identity.accountId ? `account:${identity.accountId}` : "",
  normalizedEmail(identity.email) ? `email:${normalizedEmail(identity.email)}` : "",
  identity.id ? `member:${identity.id}` : "",
].filter(Boolean);

const mergeIdentityKeys = (left: string[], right: string[]) => Array.from(new Set([...left, ...right]));

const findMemberStatusPerson = (people: MemberStatusPersonDraft[], keys: string[]) =>
  people.find((person) => keys.some((key) => person.identityKeys.includes(key)));

export const buildMemberStatusPeople = (
  projectMembers: ProjectMember[],
  workspaceMemberships: WorkspaceMembership[] = [],
): MemberStatusPerson[] => {
  const people: MemberStatusPersonDraft[] = [];

  workspaceMemberships
    .filter((membership) => membership.status === "active")
    .reduce<MemberStatusPersonDraft[]>((drafts, membership) => {
      const identityKeys = memberStatusIdentityKeys(membership);
      const existing = findMemberStatusPerson(drafts, identityKeys);
      if (!existing) {
        drafts.push({
          id: membership.accountId,
          name: membership.name,
          roles: [],
          accountId: membership.accountId,
          email: membership.email,
          memberIds: [],
          projectIds: [],
          workspaceIds: [membership.workspaceId],
          members: [],
          workspaceMemberships: [membership],
          identityKeys,
        });
        return drafts;
      }

      existing.name = existing.name || membership.name;
      existing.accountId = existing.accountId ?? membership.accountId;
      existing.email = existing.email ?? membership.email;
      existing.workspaceIds = Array.from(new Set([...existing.workspaceIds, membership.workspaceId]));
      existing.workspaceMemberships = [...existing.workspaceMemberships, membership];
      existing.identityKeys = mergeIdentityKeys(existing.identityKeys, identityKeys);
      return drafts;
    }, people);

  projectMembers.reduce<MemberStatusPersonDraft[]>((drafts, member) => {
    const identityKeys = memberStatusIdentityKeys(member);
    const existing = findMemberStatusPerson(drafts, identityKeys);
    if (!existing) {
      drafts.push({
        id: member.accountId ?? member.email ?? member.id,
        name: member.name,
        roles: member.roles,
        accountId: member.accountId,
        email: member.email,
        memberIds: [member.id],
        projectIds: [member.projectId],
        workspaceIds: [],
        members: [member],
        workspaceMemberships: [],
        identityKeys,
      });
      return drafts;
    }

    existing.roles = Array.from(new Set([...existing.roles, ...member.roles]));
    existing.accountId = existing.accountId ?? member.accountId;
    existing.email = existing.email ?? member.email;
    existing.memberIds = Array.from(new Set([...existing.memberIds, member.id]));
    existing.projectIds = Array.from(new Set([...existing.projectIds, member.projectId]));
    existing.members = [...existing.members, member];
    existing.identityKeys = mergeIdentityKeys(existing.identityKeys, identityKeys);
    return drafts;
  }, people);

  return people.map(({ identityKeys: _identityKeys, ...person }) => person);
};
