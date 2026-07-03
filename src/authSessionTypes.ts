import type { Tab } from "./appModel";
import type { Account, AppState, ProjectInvitation, WorkspaceInvitation } from "./types";

export type SetAuthSessionState = (updater: AppState | null | ((current: AppState | null) => AppState | null)) => void;
export type UpdateAuthSessionState = (updater: (value: AppState) => AppState) => void;

export type AuthSessionRuntimeOptions = {
  getState: () => AppState | null;
  setState: SetAuthSessionState;
  updateState: UpdateAuthSessionState;
  setToast: (message: string) => void;
  setPlatformAccounts: (accounts: Account[]) => void;
  setWorkspaceInvitations: (invitations: WorkspaceInvitation[]) => void;
  setProjectInvitations: (invitations: ProjectInvitation[]) => void;
  setSuppressAutoLogin: (suppressed: boolean) => void;
  setSelectedTaskId: (taskId: string | null) => void;
  setPreferredFocusTaskId: (taskId: string | null) => void;
  setWorkspaceMode: (mode: "board" | "workbench") => void;
  setTab: (tab: Tab) => void;
};

export type AuthSessionRuntime = {
  checkAuthStatus: () => Promise<void>;
  handleCreateWorkspace: (workspaceName?: string, options?: { returnTo?: Tab }) => Promise<void>;
  handleWorkspaceLogin: (email: string, password: string, remember?: boolean) => Promise<void>;
  logout: () => void;
};
