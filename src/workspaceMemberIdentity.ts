import {
  memberAccessIdentityKey,
  normalizedEmail,
} from "./accessIdentity";
import type {
  Account,
  Workspace,
  WorkspaceMembership,
} from "./types";

export type WorkspaceSummary = Pick<Workspace, "id" | "ownerAccountId" | "type">;
export type WorkspaceAccount = Pick<Account, "id" | "email" | "workspaceId">;

export const workspaceIdFor = (workspace: string | WorkspaceSummary) =>
  typeof workspace === "string" ? workspace : workspace.id;

export const activeMembershipsForWorkspace = (memberships: WorkspaceMembership[], workspaceId: string) =>
  memberships.filter((membership) => membership.workspaceId === workspaceId && membership.status === "active");

export const addAccountIdentity = (identities: Set<string>, account?: Pick<Account, "id" | "email">) => {
  if (account?.id) identities.add(`account:${account.id}`);
  else if (account?.email) identities.add(`email:${normalizedEmail(account.email)}`);
};

export const privateWorkspaceOwnerAccountId = (
  workspace: Pick<Workspace, "ownerAccountId"> | undefined,
  activeMemberships: WorkspaceMembership[],
  currentAccount?: Pick<Account, "id">,
) =>
  workspace?.ownerAccountId ||
  activeMemberships.find((membership) => membership.role === "owner")?.accountId ||
  currentAccount?.id ||
  "";

export const addPrivateWorkspaceOwnerIdentity = (
  identities: Set<string>,
  workspace: Pick<Workspace, "ownerAccountId"> | undefined,
  activeMemberships: WorkspaceMembership[],
  currentAccount?: Pick<Account, "id" | "email">,
) => {
  const ownerAccountId = privateWorkspaceOwnerAccountId(workspace, activeMemberships, currentAccount);
  if (ownerAccountId) identities.add(`account:${ownerAccountId}`);
  else addAccountIdentity(identities, currentAccount);
};

export const addMembershipIdentities = (identities: Set<string>, memberships: WorkspaceMembership[]) => {
  memberships.forEach((membership) => identities.add(memberAccessIdentityKey(membership)));
};

export const isPrivateWorkspace = (workspace: Pick<Workspace, "type"> | undefined) =>
  (workspace?.type ?? "shared") === "private";
