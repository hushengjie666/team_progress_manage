import type { Account, Workspace, WorkspaceMembership } from "../../../src/types";

export const accountResponse = (account: Account | undefined, workspaceId: string) => ({
  id: account?.id,
  workspace_id: workspaceId,
  name: account?.name,
  email: account?.email,
  created_at: account?.createdAt,
  updated_at: account?.updatedAt,
});

export const workspaceResponse = (workspace: Workspace) => ({
  id: workspace.id,
  name: workspace.name,
  type: workspace.type,
  owner_account_id: workspace.ownerAccountId,
  created_at: workspace.createdAt,
  updated_at: workspace.updatedAt,
});

export const membershipResponse = (membership: WorkspaceMembership) => ({
  id: membership.id,
  workspace_id: membership.workspaceId,
  account_id: membership.accountId,
  name: membership.name,
  email: membership.email,
  role: membership.role,
  status: membership.status,
  created_at: membership.createdAt,
  updated_at: membership.updatedAt,
});

export const ownerMembershipResponse = (
  workspace: Workspace,
  account: Account | undefined,
) => ({
  id: `membership_${workspace.id}_account_owner`,
  workspace_id: workspace.id,
  account_id: account?.id,
  name: account?.name,
  email: account?.email,
  role: "owner",
  status: "active",
  created_at: workspace.createdAt,
  updated_at: workspace.updatedAt,
});
