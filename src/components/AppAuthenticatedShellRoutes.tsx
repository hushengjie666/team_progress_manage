import type { AppAuthenticatedShellProps } from "./AppAuthenticatedShellTypes";
import { CompletionFeedback } from "./completion/CompletionFeedback";
import { DailyQuotesProvider } from "../dailyQuotes/DailyQuotesProvider";
import { FocusPet } from "../focusPet/FocusPet";
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

export function AppAuthenticatedShellRoutes(props: AppAuthenticatedShellRoutesProps) {
  const { auth, backend } = props.view.state;
  return (
    <DailyQuotesProvider
      key={JSON.stringify([backend.serverUrl, auth.account?.id])}
      accountId={auth.account?.id ?? ""}
      token={auth.token}
      backend={backend}
    >
      <CompletionFeedback key={props.view.tab}
        workspaceId={props.shellState.selectedWorkspaceId} todayTasks={props.view.focusCommittedTasks}>
        <AppRoutes {...props} />
      </CompletionFeedback>
      <FocusPet key={auth.token} app={props.view.state} visible={props.view.tab === "focus"}/>
    </DailyQuotesProvider>
  );
}

function AppRoutes({
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
        shellState={shellState}
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
        taskActions={taskActions}
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
        shellState={shellState}
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
