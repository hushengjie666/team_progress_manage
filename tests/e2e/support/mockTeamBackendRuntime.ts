import type { AppState, Workspace, WorkspaceMembership } from "../../../src/types";
import { createMockWorkspaceStates } from "./mockTeamBackendState";
import type { MockProjectInvitation, MockTeamBackendOptions } from "./mockTypes";

export type MockWorkspaceInvitation = {
  id: string;
  workspace_id: string;
  workspace_name: string;
  workspace_type: string;
  inviter_account_id: string;
  inviter_name: string;
  inviter_email: string;
  invitee_account_id: string;
  invitee_email: string;
  status: string;
  created_at: string;
  updated_at: string;
};

export type MockTeamBackendRuntime = {
  initialState: AppState;
  options: MockTeamBackendOptions;
  projectInvitations: MockProjectInvitation[];
  workspaceInvitations: MockWorkspaceInvitation[];
  mockWorkspaces: Workspace[];
  mockMemberships: WorkspaceMembership[];
  projectInvitationAccepted: boolean;
  workspaceStates: Record<string, AppState>;
  activeWorkspaceId: string;
};

export const createMockTeamBackendRuntime = (
  initialState: AppState,
  options: MockTeamBackendOptions,
): MockTeamBackendRuntime => ({
  initialState,
  options,
  projectInvitations: options.projectInvitations ? [...options.projectInvitations] : [],
  workspaceInvitations: [],
  mockWorkspaces: [...(initialState.auth.workspaces ?? [])],
  mockMemberships: [...(initialState.auth.workspaceMemberships ?? [])],
  projectInvitationAccepted: false,
  workspaceStates: createMockWorkspaceStates(initialState),
  activeWorkspaceId: initialState.auth.workspace?.id ?? "workspace_e2e",
});
