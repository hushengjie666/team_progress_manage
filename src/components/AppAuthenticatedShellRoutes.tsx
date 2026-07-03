import type { AppAuthenticatedShellProps } from "./AppAuthenticatedShellTypes";
import { AppCalendarRoute } from "./AppCalendarRoute";
import { AppDailyReviewRoute } from "./AppDailyReviewRoute";
import { AppFocusRoute } from "./AppFocusRoute";
import { AppMemberStatusRoute } from "./AppMemberStatusRoute";
import { AppProjectDetailRoute } from "./AppProjectDetailRoute";
import { AppReportsRoute } from "./AppReportsRoute";
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
  | "dailyActions"
  | "projectActions"
  | "settingsActions"
  | "dataPortability"
  | "syncActions"
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
  dailyActions,
  projectActions,
  settingsActions,
  dataPortability,
  syncActions,
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

  if (tab === "calendar") {
    return (
      <AppCalendarRoute
        view={view}
        shellState={shellState}
        settingsActions={settingsActions}
        taskActions={taskActions}
      />
    );
  }

  if (tab === "daily") {
    return (
      <AppDailyReviewRoute
        view={view}
        dailyActions={dailyActions}
      />
    );
  }

  if (tab === "reports") {
    return (
      <AppReportsRoute
        view={view}
        shellState={shellState}
        settingsActions={settingsActions}
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
        dataPortability={dataPortability}
        syncActions={syncActions}
        workspaceAccountActions={workspaceAccountActions}
        loadDemoData={loadDemoData}
      />
    );
  }

  return null;
}
