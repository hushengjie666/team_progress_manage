import type { createAppNavigationRuntime } from "./appNavigationRuntime";
import type { createAppQuickProjectRuntime } from "./appQuickProjectRuntime";
import type { useAppShellState } from "./appShellState";
import type { useAppViewModelHooks } from "./appViewModelHooks";
import type {
  AppShellChrome,
  AppShellState,
  AppShellView,
  SettingsDataSummary,
} from "./components/AppAuthenticatedShellTypes";
import type { AppState } from "./types";

export {
  buildWorkspaceAccountShellActions,
  createProjectMemberInviteGuard,
} from "./appAuthenticatedShellActionsModel";

type AppShellSource = ReturnType<typeof useAppShellState>;
type AppViewModelSource = ReturnType<typeof useAppViewModelHooks>;
type AppNavigationRuntime = ReturnType<typeof createAppNavigationRuntime>;
type AppQuickProjectRuntime = ReturnType<typeof createAppQuickProjectRuntime>;

export const buildSettingsDataSummary = (state: AppState): SettingsDataSummary => ({
  projectCount: state.projects.length,
  taskCount: state.tasks.length,
  projectMemberCount: state.projectMembers.length,
  focusSessionCount: state.focusSessions.length,
  workSessionCount: state.workSessions.length,
  executionSignalCount: state.executionSignals.length,
  interruptionCount: state.interruptions.length,
});

export function buildAppShellView({
  shell,
  viewModel,
  state,
  capacityHint,
  quickProject,
}: {
  shell: AppShellSource;
  viewModel: AppViewModelSource & Pick<AppShellView, "todayPlan" | "workspaceModel">;
  state: AppState;
  capacityHint: number;
  quickProject: Pick<AppQuickProjectRuntime, "visibleWorkspaces">;
}): AppShellView {
  return {
    state,
    tab: shell.tab,
    workspaceMode: shell.workspaceMode,
    workspaceModel: viewModel.workspaceModel,
    todayPlan: viewModel.todayPlan,
    capacityHint,
    selectedWorkbenchProjectIds: shell.selectedWorkbenchProjectIds,
    toggleWorkbenchProject: viewModel.toggleWorkbenchProject,
    selectedTask: viewModel.selectedTask,
    currentTask: viewModel.currentTask,
    focusActiveTimer: viewModel.focusActiveTimer,
    focusCommittedTasks: viewModel.focusCommittedTasks,
    activeProjectId: viewModel.activeProjectId,
    projectDetailModel: viewModel.projectDetailModel,
    currentProjectMemberId: viewModel.currentProjectMemberId,
    visibleWorkspaces: quickProject.visibleWorkspaces,
  };
}

export function buildAppShellState(shell: AppShellSource): AppShellState {
  return {
    setTab: shell.setTab,
    setWorkspaceMode: shell.setWorkspaceMode,
    selectedWorkspaceId: shell.selectedWorkspaceId,
    setSelectedWorkspaceId: shell.setSelectedWorkspaceId,
    setSelectedTaskId: shell.setSelectedTaskId,
    projectTaskFilters: shell.projectTaskFilters,
    setProjectTaskFilters: shell.setProjectTaskFilters,
    taskDraft: shell.draft,
    setTaskDraft: shell.setDraft,
    projectDetailTab: shell.projectDetailTab,
    setProjectDetailTab: shell.setProjectDetailTab,
    quickProjectCreateOpen: shell.quickProjectCreateOpen,
    quickProjectDraft: shell.quickProjectDraft,
    setQuickProjectDraft: shell.setQuickProjectDraft,
    quickProjectWarning: shell.quickProjectWarning,
    setQuickProjectWarning: shell.setQuickProjectWarning,
    pendingDeleteTask: shell.pendingDeleteTask,
    setPendingDeleteTask: shell.setPendingDeleteTask,
    deletedTaskSnapshot: shell.deletedTaskSnapshot,
    pendingReset: shell.pendingReset,
    setPendingReset: shell.setPendingReset,
    pendingSplit: shell.pendingSplit,
    setPendingSplit: shell.setPendingSplit,
    commandPaletteOpen: shell.commandPaletteOpen,
    setCommandPaletteOpen: shell.setCommandPaletteOpen,
    showShortcutHelp: shell.showShortcutHelp,
    setShowShortcutHelp: shell.setShowShortcutHelp,
    backendPassword: shell.backendPassword,
    setBackendPassword: shell.setBackendPassword,
    backendDiagnostic: shell.backendDiagnostic,
    settingsSection: shell.settingsSection,
    setSettingsSection: shell.setSettingsSection,
  };
}

export function buildAppShellChrome({
  shell,
  navigation,
  quickProject,
  settingsDataSummary,
  canManageMembers,
  canManageActiveProjectMembers,
}: {
  shell: AppShellSource;
  navigation: Pick<AppNavigationRuntime, "topbarNavItems" | "activeNavKey">;
  quickProject: Pick<AppQuickProjectRuntime, "defaultQuickProjectWorkspaceId">;
  settingsDataSummary: SettingsDataSummary;
  canManageMembers: boolean;
  canManageActiveProjectMembers: boolean;
}): AppShellChrome {
  return {
    topbarNavItems: navigation.topbarNavItems,
    activeNavKey: navigation.activeNavKey,
    toast: shell.toast,
    toastVisible: shell.toastVisible,
    workspaceInvitations: shell.workspaceInvitations,
    projectInvitations: shell.projectInvitations,
    defaultQuickProjectWorkspaceId: quickProject.defaultQuickProjectWorkspaceId,
    settingsDataSummary,
    platformAccounts: shell.platformAccounts,
    canManageMembers,
    canManageActiveProjectMembers,
  };
}
