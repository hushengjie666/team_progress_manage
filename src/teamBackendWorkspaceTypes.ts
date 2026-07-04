import type { ServerWorkspace, ServerWorkspaceMembership } from "./teamBackendCoreTypes";

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
