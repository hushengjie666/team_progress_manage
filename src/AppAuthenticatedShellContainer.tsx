import { planCapacityHint } from "./domain";
import {
  buildAppShellChrome,
  buildAppShellState,
  buildAppShellView,
  buildSettingsDataSummary,
  buildWorkspaceAccountShellActions,
  createProjectMemberInviteGuard,
} from "./appAuthenticatedShellModel";
import type { createAppNavigationRuntime } from "./appNavigationRuntime";
import type { AppQuickProjectRuntime } from "./appQuickProjectRuntime";
import type { useAppShellState } from "./appShellState";
import type { useAppViewModelHooks } from "./appViewModelHooks";
import { AppAuthenticatedShell } from "./components/AppAuthenticatedShell";
import type { AppAuthenticatedShellProps, AppShellView } from "./components/AppAuthenticatedShellTypes";
import type { AppState } from "./types";
import {
  isSuperAdminAccount,
  type WorkspaceAccountRuntime,
} from "./workspaceAccountRuntime";

type AppReadyViewModel = ReturnType<typeof useAppViewModelHooks> & Pick<AppShellView, "todayPlan" | "workspaceModel">;
type AppNavigationRuntime = ReturnType<typeof createAppNavigationRuntime>;

type AppAuthenticatedShellContainerProps = Pick<
  AppAuthenticatedShellProps,
  | "taskActions"
  | "focusActions"
  | "projectActions"
  | "settingsActions"
  | "backendActions"
  | "authActions"
  | "loadDemoData"
  | "runCommand"
> & {
  shell: ReturnType<typeof useAppShellState>;
  viewModel: AppReadyViewModel;
  state: AppState;
  navigation: AppNavigationRuntime;
  quickProject: AppQuickProjectRuntime;
  workspaceAccountRuntime: WorkspaceAccountRuntime;
};

export function AppAuthenticatedShellContainer({
  shell,
  viewModel,
  state,
  navigation,
  quickProject,
  workspaceAccountRuntime,
  taskActions,
  focusActions,
  projectActions,
  settingsActions,
  backendActions,
  authActions,
  loadDemoData,
  runCommand,
}: AppAuthenticatedShellContainerProps) {
  const capacityHint = planCapacityHint(state);
  const canManageMembers = isSuperAdminAccount(state.auth.account);
  const canManageActiveProjectMembers = viewModel.activeProjectId
    ? projectActions.canManageProjectMembersForProject(state, viewModel.activeProjectId)
    : false;
  const settingsDataSummary = buildSettingsDataSummary(state);
  const inviteProjectMember = createProjectMemberInviteGuard({
    getState: () => shell.stateRef.current,
    fallbackState: state,
    projectActions,
    inviteProjectMember: workspaceAccountRuntime.inviteProjectMember,
    setToast: shell.setToast,
  });

  return (
    <AppAuthenticatedShell
      view={buildAppShellView({
        shell,
        viewModel,
        state,
        capacityHint,
        quickProject,
      })}
      shellState={buildAppShellState(shell)}
      chrome={buildAppShellChrome({
        shell,
        navigation,
        quickProject,
        settingsDataSummary,
        canManageMembers,
        canManageActiveProjectMembers,
      })}
      taskActions={taskActions}
      focusActions={focusActions}
      projectActions={projectActions}
      settingsActions={settingsActions}
      backendActions={backendActions}
      authActions={authActions}
      workspaceAccountActions={buildWorkspaceAccountShellActions(workspaceAccountRuntime)}
      inviteProjectMember={inviteProjectMember}
      openProjectDetail={navigation.openProjectDetail}
      openAdmin={navigation.openAdmin}
      openQuickProjectCreate={quickProject.openQuickProjectCreate}
      closeQuickProjectCreate={quickProject.closeQuickProjectCreate}
      submitQuickProjectCreate={quickProject.submitQuickProjectCreate}
      loadDemoData={loadDemoData}
      runCommand={runCommand}
    />
  );
}
