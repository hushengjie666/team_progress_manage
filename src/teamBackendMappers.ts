import type { Account, ProjectInvitation, Workspace, WorkspaceInvitation, WorkspaceMembership } from "./types";
import type { AuthSession, LoginResponse } from "./teamBackendAuthTypes";
import type { ServerAccount, ServerWorkspace, ServerWorkspaceMembership } from "./teamBackendCoreTypes";
import type { ServerProjectInvitation, ServerWorkspaceInvitation } from "./teamBackendInvitationTypes";

export const mapAccount = (account: ServerAccount): Account => ({
  id: account.id,
  workspaceId: account.workspace_id,
  name: account.name,
  email: account.email,
  disabledAt: account.disabled_at || undefined,
  createdAt: account.created_at,
  updatedAt: account.updated_at,
});

export const mapWorkspace = (workspace: ServerWorkspace): Workspace => ({
  id: workspace.id,
  name: workspace.name,
  type: workspace.type === "private" ? "private" : "shared",
  ownerAccountId: workspace.owner_account_id || undefined,
  createdAt: workspace.created_at,
  updatedAt: workspace.updated_at,
});

export const mapWorkspaceMembership = (membership: ServerWorkspaceMembership): WorkspaceMembership => ({
  id: membership.id,
  workspaceId: membership.workspace_id,
  accountId: membership.account_id,
  name: membership.name,
  email: membership.email,
  role: membership.role,
  status: membership.status,
  createdAt: membership.created_at,
  updatedAt: membership.updated_at,
});

export const mapWorkspaceInvitation = (invitation: ServerWorkspaceInvitation): WorkspaceInvitation => ({
  id: invitation.id,
  workspaceId: invitation.workspace_id,
  workspaceName: invitation.workspace_name,
  workspaceType: invitation.workspace_type === "private" ? "private" : "shared",
  inviterAccountId: invitation.inviter_account_id,
  inviterName: invitation.inviter_name,
  inviterEmail: invitation.inviter_email,
  inviteeAccountId: invitation.invitee_account_id,
  inviteeEmail: invitation.invitee_email,
  status: invitation.status,
  createdAt: invitation.created_at,
  updatedAt: invitation.updated_at,
  acceptedAt: invitation.accepted_at || undefined,
});

export const mapProjectInvitation = (invitation: ServerProjectInvitation): ProjectInvitation => ({
  id: invitation.id,
  workspaceId: invitation.workspace_id,
  workspaceName: invitation.workspace_name,
  projectId: invitation.project_id,
  projectName: invitation.project_name,
  inviterAccountId: invitation.inviter_account_id,
  inviterName: invitation.inviter_name,
  inviterEmail: invitation.inviter_email,
  inviteeAccountId: invitation.invitee_account_id,
  inviteeEmail: invitation.invitee_email,
  roles: invitation.roles?.length ? invitation.roles : ["executor"],
  status: invitation.status,
  createdAt: invitation.created_at,
  updatedAt: invitation.updated_at,
  acceptedAt: invitation.accepted_at || undefined,
});

export const sessionFromLogin = (payload: LoginResponse): AuthSession => ({
  token: payload.token,
  expiresAt: payload.expires_at,
  account: mapAccount(payload.account),
  workspace: mapWorkspace(payload.workspace),
  membership: payload.membership ? mapWorkspaceMembership(payload.membership) : undefined,
  workspaces: (payload.workspaces ?? [payload.workspace]).map(mapWorkspace),
});
