import type {
  Account,
  AppState,
  ProjectInvitation,
  ProjectMemberRole,
  WorkspaceInvitation,
  WorkspaceMembershipUpdateInput,
  WorkspaceUpdateInput,
} from "./types";

export type SetWorkspaceAccountState = (updater: AppState | null | ((current: AppState | null) => AppState | null)) => void;

export type WorkspaceAccountMetadata = {
  platformAccounts: Account[];
  workspaceInvitations: WorkspaceInvitation[];
  projectInvitations: ProjectInvitation[];
};

export type WorkspaceAccountRuntimeOptions = {
  getState: () => AppState | null;
  setState: SetWorkspaceAccountState;
  setToast: (message: string) => void;
  setPlatformAccounts: (accounts: Account[]) => void;
  getPlatformAccounts?: () => Account[];
  setWorkspaceInvitations: (invitations: WorkspaceInvitation[]) => void;
  setProjectInvitations: (invitations: ProjectInvitation[]) => void;
};

export type WorkspaceAccountRuntime = {
  refreshPlatformAccounts: (source?: AppState | null) => Promise<Account[]>;
  createPlatformAccount: (name: string, email: string, password?: string) => void;
  updatePlatformAccountProfile: (account: Account) => void;
  disablePlatformAccount: (accountId: string) => void;
  updatePlatformAccountPassword: (account: Account, password: string) => void;
  refreshWorkspaceInvitations: (source?: AppState | null) => Promise<WorkspaceInvitation[]>;
  refreshProjectInvitations: (source?: AppState | null) => Promise<ProjectInvitation[]>;
  inviteWorkspaceMember: (workspaceId: string, email: string) => void;
  inviteProjectMember: (input: { workspaceId?: string; projectId: string; email: string; roles: ProjectMemberRole[] }) => void;
  updateWorkspace: (workspaceId: string, input: WorkspaceUpdateInput) => Promise<boolean>;
  updateWorkspaceMembership: (workspaceId: string, membershipId: string, input: WorkspaceMembershipUpdateInput) => Promise<boolean>;
  acceptPendingWorkspaceInvitation: (invitationId: string) => void;
  acceptPendingProjectInvitation: (invitationId: string) => void;
};

export type WorkspaceSessionLoadOptions = {
  resetRuntime?: boolean;
};

export type WorkspaceSessionLoadResult = WorkspaceAccountMetadata & {
  state: AppState;
};
