import type {
  Account,
  AppState,
  Workspace,
  WorkspaceMembership,
} from "./types";
import {
  activeMembershipsForWorkspace,
  addAccountIdentity,
  addMembershipIdentities,
  addPrivateWorkspaceOwnerIdentity,
  isPrivateWorkspace,
  privateWorkspaceOwnerAccountId,
  workspaceIdFor,
  type WorkspaceAccount,
  type WorkspaceSummary,
} from "./workspaceMemberIdentity";
import {
  workspaceMembershipsForState,
  workspacesForState,
} from "./workspaceStateAccess";

export const accountBelongsToWorkspace = (
  workspace: Workspace | undefined,
  account: WorkspaceAccount | undefined,
  activeMemberships: WorkspaceMembership[],
  workspaceId: string,
) =>
  Boolean(
    account &&
      (
        account.workspaceId === workspaceId ||
        workspace?.ownerAccountId === account.id ||
        activeMemberships.some((membership) => membership.accountId === account.id)
      ),
  );

export const activeWorkspaceIdsForAccount = (state: AppState, account?: WorkspaceAccount) => {
  if (!account?.id) return new Set<string>();
  const workspaceMemberships = workspaceMembershipsForState(state);
  const workspaceIds = new Set(
    workspaceMemberships
      .filter((membership) => membership.accountId === account.id && membership.status === "active")
      .map((membership) => membership.workspaceId),
  );

  workspacesForState(state)
    .filter((workspace) => workspace.ownerAccountId === account.id)
    .forEach((workspace) => workspaceIds.add(workspace.id));

  if (state.auth.workspace?.ownerAccountId === account.id) workspaceIds.add(state.auth.workspace.id);

  return workspaceIds;
};

export const activeWorkspaceIdsForCurrentAccount = (state: AppState) =>
  activeWorkspaceIdsForAccount(state, state.auth.account);

export const countWorkspacePeople = (
  state: AppState,
  workspace: string | WorkspaceSummary,
  currentAccount = state.auth.account,
) => {
  const workspaceId = workspaceIdFor(workspace);
  const workspaceSummary = typeof workspace === "string"
    ? workspacesForState(state).find((item) => item.id === workspaceId)
    : workspace;
  const identities = new Set<string>();
  const activeMemberships = activeMembershipsForWorkspace(workspaceMembershipsForState(state), workspaceId);
  if (isPrivateWorkspace(workspaceSummary)) {
    addPrivateWorkspaceOwnerIdentity(identities, workspaceSummary, activeMemberships, currentAccount);
    return identities.size;
  }

  if (workspaceSummary?.ownerAccountId) identities.add(`account:${workspaceSummary.ownerAccountId}`);
  if (accountBelongsToWorkspace(workspaceSummary as Workspace | undefined, currentAccount, activeMemberships, workspaceId)) {
    addAccountIdentity(identities, currentAccount);
  }
  addMembershipIdentities(identities, activeMemberships);
  return identities.size;
};

export const countActiveWorkspaceMembers = (
  workspace: string | WorkspaceSummary,
  workspaceMemberships: WorkspaceMembership[],
  currentAccount?: WorkspaceAccount,
) => {
  const workspaceId = workspaceIdFor(workspace);
  const workspaceSummary = typeof workspace === "string" ? undefined : workspace;
  const identities = new Set<string>();
  const activeMemberships = activeMembershipsForWorkspace(workspaceMemberships, workspaceId);
  if (isPrivateWorkspace(workspaceSummary)) {
    addPrivateWorkspaceOwnerIdentity(identities, workspaceSummary, activeMemberships, currentAccount);
    return identities.size;
  }
  const currentAccountBelongsToWorkspace = Boolean(
    currentAccount &&
    (
      currentAccount.workspaceId === workspaceId ||
      workspaceSummary?.ownerAccountId === currentAccount.id
    ),
  );
  if (workspaceSummary?.ownerAccountId) {
    identities.add(`account:${workspaceSummary.ownerAccountId}`);
  }
  if (currentAccount && currentAccountBelongsToWorkspace) {
    addAccountIdentity(identities, currentAccount);
  }
  addMembershipIdentities(identities, activeMemberships);
  return identities.size;
};

export const visibleWorkspaceMembers = (
  workspace: Workspace,
  memberships: WorkspaceMembership[],
  currentAccount?: Account,
) => {
  const members = memberships.filter((membership) => membership.workspaceId === workspace.id);
  if (!isPrivateWorkspace(workspace)) return members;
  const ownerAccountId = privateWorkspaceOwnerAccountId(workspace, activeMembershipsForWorkspace(members, workspace.id), currentAccount);
  return members.filter((member) => member.accountId === ownerAccountId);
};
