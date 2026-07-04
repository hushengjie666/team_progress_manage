import type { AppAuthenticatedShellProps } from "./AppAuthenticatedShellTypes";
import { AppFocusRoute } from "./AppFocusRoute";
import { AppMemberStatusRoute } from "./AppMemberStatusRoute";
import { AppProjectDetailRoute } from "./AppProjectDetailRoute";
import { AppSettingsRoute } from "./AppSettingsRoute";
import { AppWorkspaceDirectoryRoute } from "./AppWorkspaceDirectoryRoute";
import { AppWorkspaceRoute } from "./AppWorkspaceRoute";

type AppAuthenticatedShellRoutesProps = Pick<
  AppAuthenticatedShellProps,
  | "view"
  | "shellState"
  | "chrome"
  | "taskActions"
  | "focusActions"
  | "projectActions"
  | "settingsActions"
  | "backendActions"
  | "authActions"
  | "workspaceAccountActions"
  | "inviteProjectMember"
  | "openProjectDetail"
  | "openAdmin"
  | "openQuickProjectCreate"
  | "loadDemoData"
>;

export function AppAuthenticatedShellRoutes({
  view,
  shellState,
  chrome,
  taskActions,
  focusActions,
  projectActions,
  settingsActions,
  backendActions,
  authActions,
  workspaceAccountActions,
  inviteProjectMember,
  openProjectDetail,
  openAdmin,
  openQuickProjectCreate,
  loadDemoData,
}: AppAuthenticatedShellRoutesProps) {
  const { tab } = view;
  const { setTab } = shellState;
  const beginFocus = (taskId: string) => {
    setTab("focus");
    void focusActions.beginTimer("focus", taskId);
  };

  if (tab === "workspace") {
    return (
      <AppWorkspaceRoute
        view={view}
        shellState={shellState}
        taskActions={taskActions}
        projectActions={projectActions}
        beginFocus={beginFocus}
        openProjectDetail={openProjectDetail}
        openQuickProjectCreate={openQuickProjectCreate}
      />
    );
  }

  if (tab === "workspaces") {
    return (
      <AppWorkspaceDirectoryRoute
        view={view}
        authActions={authActions}
        workspaceAccountActions={workspaceAccountActions}
        projectActions={projectActions}
        openProjectDetail={openProjectDetail}
      />
    );
  }

  if (tab === "member_status") {
    return (
      <AppMemberStatusRoute
        view={view}
        shellState={shellState}
      />
    );
  }

  if (tab === "project") {
    return (
      <AppProjectDetailRoute
        view={view}
        shellState={shellState}
        chrome={chrome}
        taskActions={taskActions}
        projectActions={projectActions}
        beginFocus={beginFocus}
        inviteProjectMember={inviteProjectMember}
        openAdmin={openAdmin}
      />
    );
  }

  if (tab === "focus") {
    return (
      <AppFocusRoute
        view={view}
        taskActions={taskActions}
        focusActions={focusActions}
      />
    );
  }

  if (tab === "settings") {
    return (
      <AppSettingsRoute
        view={view}
        shellState={shellState}
        chrome={chrome}
        settingsActions={settingsActions}
        backendActions={backendActions}
        workspaceAccountActions={workspaceAccountActions}
        loadDemoData={loadDemoData}
      />
    );
  }

  return null;
}
