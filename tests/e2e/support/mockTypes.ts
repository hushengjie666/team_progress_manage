import type { AppState, BackendHealthResponse, ProjectInvitation } from "../../../src/types";

export type MockProjectInvitation = {
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
  roles: string[];
  status: ProjectInvitation["status"];
  created_at: string;
  updated_at: string;
  accepted_at?: string;
};

export type MockTeamBackendOptions = {
  projectInvitations?: MockProjectInvitation[];
  acceptedProjectInvitationState?: AppState;
  health?: Partial<BackendHealthResponse>;
};
