import type { Account, Workspace, WorkspaceMembership } from "./types";
import type { ServerAccount, ServerWorkspace, ServerWorkspaceMembership } from "./syncServerCoreTypes";

export interface LoginResponse {
  token: string;
  user_id: string;
  expires_at: string;
  account: ServerAccount;
  workspace: ServerWorkspace;
  membership?: ServerWorkspaceMembership;
  workspaces?: ServerWorkspace[];
}

export interface AuthStatusResponse {
  bootstrapped: boolean;
  workspace_id?: string;
  workspace_name?: string;
}

export interface AuthSession {
  token: string;
  expiresAt: string;
  account: Account;
  workspace: Workspace;
  membership?: WorkspaceMembership;
  workspaces: Workspace[];
}

export interface BootstrapPayload {
  workspaceName: string;
  name: string;
  email: string;
  password: string;
}
