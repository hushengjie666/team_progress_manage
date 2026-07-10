import type { ProjectMemberRole } from "./types";

export interface ServerWorkspaceInvitation {
  id: string;
  workspace_id: string;
  workspace_name: string;
  workspace_type?: "private" | "shared";
  inviter_account_id: string;
  inviter_name: string;
  inviter_email: string;
  invitee_account_id: string;
  invitee_email: string;
  status: "pending" | "accepted" | "cancelled";
  created_at: string;
  updated_at: string;
  accepted_at?: string;
  revision?: number;
}

export interface ServerProjectInvitation {
  id: string;
  workspace_id: string;
  workspace_name: string;
  project_id: string;
  project_name: string;
  inviter_account_id: string;
  inviter_name: string;
  inviter_email: string;
  invitee_account_id: string;
  invitee_email: string;
  roles: ProjectMemberRole[];
  status: "pending" | "accepted" | "cancelled";
  created_at: string;
  updated_at: string;
  accepted_at?: string;
  revision?: number;
}

export interface WorkspaceInvitationsResponse {
  invitations: ServerWorkspaceInvitation[];
}

export interface WorkspaceInvitationResponse {
  invitation: ServerWorkspaceInvitation;
}

export interface ProjectInvitationsResponse {
  invitations: ServerProjectInvitation[];
}

export interface ProjectInvitationResponse {
  invitation: ServerProjectInvitation;
}
