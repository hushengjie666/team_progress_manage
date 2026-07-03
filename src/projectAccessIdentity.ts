import { normalizedEmail, type MemberIdentity } from "./accessIdentity";
import type { Account, ProjectMember } from "./types";

export const projectMemberMatchesIdentity = (member: ProjectMember, identity: MemberIdentity) => {
  const identityEmail = normalizedEmail(identity.email);
  return Boolean(
    (identity.accountId && member.accountId === identity.accountId) ||
    (identityEmail && normalizedEmail(member.email) === identityEmail),
  );
};

export const accountIdentity = (account: Account): MemberIdentity => ({
  id: account.id,
  accountId: account.id,
  email: account.email,
});
