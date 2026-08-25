import type { AppFocusActionsRuntime } from "../appFocusActionsRuntime";
import type { AppProjectActionsRuntime } from "../appProjectActionsRuntime";
import type { AppSettingsActionsRuntime } from "../appSettingsActionsRuntime";
import type { AppTaskActionsRuntime } from "../appTaskActionsRuntime";
import type { AuthSessionRuntime } from "../authSessionRuntime";
import type { DeletedTaskSnapshot, SplitDraft, Tab, TaskDraft } from "../appModel";
import type { ProjectDetailModel, ProjectTaskFilters } from "../projectDetail";
import type { BackendCommandRuntime } from "../teamBackendCommandRuntime";
import type {
  Account,
  AppState,
  CommandAction,
  DailyPlan,
  ParsedQuickInput,
  ProjectInvitation,
  BackendDiagnosticResult,
  ActiveTimer,
  Task,
  Workspace,
  WorkspaceInvitation,
} from "../types";
import type { WorkspaceAccountRuntime } from "../workspaceAccountRuntime";
import type { WorkspaceViewModel } from "../workbenchModel";
import type { AppTopbarNavItem } from "./AppTopbar";
import type { ProjectDetailTab } from "./ProjectDetailView";
import type { QuickProjectCreateDraft } from "./QuickProjectCreateModal";
import type { SettingsSection } from "./settings/settingsTypes";

type Setter<T> = (value: T | ((current: T) => T)) => void;

export type AppShellView = {
  state: AppState;
  tab: Tab;
  workspaceMode: "board" | "workbench";
  workspaceModel: WorkspaceViewModel;
  todayPlan: DailyPlan;
  capacityHint: number;
  selectedWorkbenchProjectIds: string[];
  toggleWorkbenchProject: (projectId: string) => void;
  selectedTask?: Task;
  currentTask?: Task;
  focusActiveTimer?: ActiveTimer;
  focusCommittedTasks: Task[];
  activeProjectId: string;
  projectDetailModel?: ProjectDetailModel;
  currentProjectMemberId?: string;
  visibleWorkspaces: Workspace[];
};

export type AppShellState = {
  setTab: Setter<Tab>;
  setWorkspaceMode: Setter<"board" | "workbench">;
  selectedWorkspaceId: string | null;
  setSelectedWorkspaceId: Setter<string | null>;
  setSelectedTaskId: Setter<string | null>;
  projectTaskFilters: ProjectTaskFilters;
  setProjectTaskFilters: Setter<ProjectTaskFilters>;
  taskDraft: TaskDraft;
  setTaskDraft: Setter<TaskDraft>;
  projectDetailTab: ProjectDetailTab;
  setProjectDetailTab: Setter<ProjectDetailTab>;
  quickProjectCreateOpen: boolean;
  quickProjectDraft: QuickProjectCreateDraft;
  setQuickProjectDraft: Setter<QuickProjectCreateDraft>;
  quickProjectWarning: string;
  setQuickProjectWarning: Setter<string>;
  pendingDeleteTask: Task | null;
  setPendingDeleteTask: Setter<Task | null>;
  deletedTaskSnapshot: DeletedTaskSnapshot | null;
  pendingReset: boolean;
  setPendingReset: Setter<boolean>;
  pendingSplit: SplitDraft | null;
  setPendingSplit: Setter<SplitDraft | null>;
  commandPaletteOpen: boolean;
  setCommandPaletteOpen: Setter<boolean>;
  showShortcutHelp: boolean;
  setShowShortcutHelp: Setter<boolean>;
  backendPassword: string;
  setBackendPassword: Setter<string>;
  backendDiagnostic: BackendDiagnosticResult | null;
  settingsSection: SettingsSection;
  setSettingsSection: Setter<SettingsSection>;
};

export type SettingsDataSummary = {
  projectCount: number;
  taskCount: number;
  projectMemberCount: number;
  focusSessionCount: number;
  workSessionCount: number;
  executionSignalCount: number;
  interruptionCount: number;
};

export type AppShellChrome = {
  topbarNavItems: AppTopbarNavItem[];
  activeNavKey: string;
  toast: string;
  toastVisible: boolean;
  workspaceInvitations: WorkspaceInvitation[];
  projectInvitations: ProjectInvitation[];
  defaultQuickProjectWorkspaceId: string;
  settingsDataSummary: SettingsDataSummary;
  platformAccounts: Account[];
  canManageMembers: boolean;
  canManageActiveProjectMembers: boolean;
};

export type AppAuthenticatedShellProps = {
  view: AppShellView;
  shellState: AppShellState;
  chrome: AppShellChrome;
  taskActions: AppTaskActionsRuntime;
  focusActions: AppFocusActionsRuntime;
  projectActions: AppProjectActionsRuntime;
  settingsActions: AppSettingsActionsRuntime;
  backendActions: BackendCommandRuntime;
  authActions: Pick<AuthSessionRuntime, "handleCreateWorkspace" | "logout">;
  workspaceAccountActions: Pick<
    WorkspaceAccountRuntime,
    | "refreshWorkspaceInvitations"
    | "refreshProjectInvitations"
    | "inviteWorkspaceMember"
    | "updateWorkspace"
    | "updateWorkspaceMembership"
    | "acceptPendingWorkspaceInvitation"
    | "acceptPendingProjectInvitation"
    | "deletePendingWorkspaceInvitation"
    | "deletePendingProjectInvitation"
    | "createPlatformAccount"
    | "updatePlatformAccountProfile"
    | "updatePlatformAccountPassword"
    | "disablePlatformAccount"
  >;
  inviteProjectMember: WorkspaceAccountRuntime["inviteProjectMember"];
  openProjectDetail: (projectId: string, detailTab?: ProjectDetailTab) => void;
  openAdmin: (section?: SettingsSection) => void;
  openQuickProjectCreate: () => void;
  closeQuickProjectCreate: () => void;
  submitQuickProjectCreate: () => void;
  loadDemoData: () => void | Promise<void>;
  runCommand: (action: CommandAction, parsed?: ParsedQuickInput, taskId?: string) => void;
};
