import type { ProjectMemberRole } from "./projectTypes";

export type AuthStatus = "checking" | "signed_out" | "authenticated" | "error";
export type WorkspaceType = "private" | "shared";
export type WorkspaceMemberRole = "owner" | "admin" | "member";
export type WorkspaceMemberStatus = "active" | "disabled";

export type WorkspaceUpdateInput = {
  name: string;
  type: WorkspaceType;
  ownerAccountId?: string;
  expectedRevision?: number;
  confirmRestrictMembers?: boolean;
};

export type WorkspaceMembershipUpdateInput = {
  status?: WorkspaceMemberStatus;
  role?: WorkspaceMemberRole;
  expectedRevision?: number;
};

export interface Workspace {
  id: string;
  name: string;
  type?: WorkspaceType;
  ownerAccountId?: string;
  createdAt: string;
  updatedAt: string;
  revision?: number;
}

export interface WorkspaceMembership {
  id: string;
  workspaceId: string;
  accountId: string;
  name: string;
  email: string;
  role: WorkspaceMemberRole;
  status: WorkspaceMemberStatus;
  createdAt: string;
  updatedAt: string;
  revision?: number;
}

export interface WorkspaceInvitation {
  id: string;
  workspaceId: string;
  workspaceName: string;
  workspaceType: WorkspaceType;
  inviterAccountId: string;
  inviterName: string;
  inviterEmail: string;
  inviteeAccountId: string;
  inviteeEmail: string;
  status: "pending" | "accepted" | "cancelled";
  createdAt: string;
  updatedAt: string;
  acceptedAt?: string;
  revision?: number;
}

export interface ProjectInvitation {
  id: string;
  workspaceId: string;
  workspaceName: string;
  projectId: string;
  projectName: string;
  inviterAccountId: string;
  inviterName: string;
  inviterEmail: string;
  inviteeAccountId: string;
  inviteeEmail: string;
  roles: ProjectMemberRole[];
  status: "pending" | "accepted" | "cancelled";
  createdAt: string;
  updatedAt: string;
  acceptedAt?: string;
  revision?: number;
}

export interface Account {
  id: string;
  workspaceId: string;
  name: string;
  email: string;
  disabledAt?: string;
  createdAt: string;
  updatedAt: string;
  revision?: number;
}
