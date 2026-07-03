import type { ServerWorkspace, ServerWorkspaceMembership } from "./syncServerCoreTypes";

export interface WorkspacesResponse {
  workspaces: ServerWorkspace[];
  memberships?: ServerWorkspaceMembership[];
}

export interface WorkspaceResponse {
  workspace: ServerWorkspace;
}

export interface WorkspaceMembershipResponse {
  membership: ServerWorkspaceMembership;
}
