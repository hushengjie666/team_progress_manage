import type { Tab } from "./appModel";
import type { TeamDataRuntime } from "./teamStateRuntime";
import type { Account, AppState, ProjectInvitation, WorkspaceInvitation } from "./types";

export type Ref<T> = { current: T };
export type Setter<T> = (value: T | ((current: T) => T)) => void;

export type AppLifecycleHooksOptions = {
  state: AppState | null;
  loaded: boolean;
  toast: string;
  tab: Tab;
  selectedTaskId: string | null;
  stateRef: Ref<AppState | null>;
  tabRef: Ref<Tab>;
  selectedTaskIdRef: Ref<string | null>;
  undoTimerRef: Ref<number | null>;
  stopNoiseRef: Ref<(() => void) | null>;
  reminderSentRef: Ref<Set<string>>;
  runTeamCommand: TeamDataRuntime["runTeamCommand"];
  setState: Setter<AppState | null>;
  setToast: (message: string) => void;
  setToastVisible: Setter<boolean>;
  setLoaded: Setter<boolean>;
  setPlatformAccounts: Setter<Account[]>;
  setWorkspaceInvitations: Setter<WorkspaceInvitation[]>;
  setProjectInvitations: Setter<ProjectInvitation[]>;
};
