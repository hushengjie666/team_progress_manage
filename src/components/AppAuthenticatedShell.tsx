import { useEffect } from "react";
import { workspaceIdForProject } from "../accessControl";
import type { AppAuthenticatedShellProps } from "./AppAuthenticatedShellTypes";
import { AppTopbar } from "./AppTopbar";
import { AppAuthenticatedShellDialogs } from "./AppAuthenticatedShellDialogs";
import { AppAuthenticatedShellRoutes } from "./AppAuthenticatedShellRoutes";
import { AppAuthenticatedShellTopbarActions } from "./AppAuthenticatedShellTopbarActions";

export function AppAuthenticatedShell({
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
  closeQuickProjectCreate,
  submitQuickProjectCreate,
  loadDemoData,
  runCommand,
}: AppAuthenticatedShellProps) {
  useEffect(() => {
    if (view.tab !== "project" || !shellState.selectedWorkspaceId) return;
    const activeProject = view.state.projects.find((project) => project.id === view.activeProjectId);
    if (activeProject && workspaceIdForProject(view.state, activeProject) === shellState.selectedWorkspaceId) return;
    shellState.setSelectedTaskId(null);
    shellState.setWorkspaceMode("board");
    shellState.setTab("workspace");
  }, [
    view.tab,
    view.activeProjectId,
    view.state.projects,
    shellState.selectedWorkspaceId,
  ]);

  return (
    <main className="app-shell">
      <section className="main-panel">
        <AppTopbar
          navItems={chrome.topbarNavItems}
          activeNavKey={chrome.activeNavKey}
          actions={(
            <AppAuthenticatedShellTopbarActions
              view={view}
              shellState={shellState}
              chrome={chrome}
              authActions={authActions}
              workspaceAccountActions={workspaceAccountActions}
            />
          )}
        />
        {chrome.toast && chrome.toastVisible && (
          <div className="global-toast" role="status" aria-live="polite">
            {chrome.toast}
          </div>
        )}

        <AppAuthenticatedShellRoutes
          view={view}
          shellState={shellState}
          chrome={chrome}
          taskActions={taskActions}
          focusActions={focusActions}
          projectActions={projectActions}
          settingsActions={settingsActions}
          backendActions={backendActions}
          authActions={authActions}
          workspaceAccountActions={workspaceAccountActions}
          inviteProjectMember={inviteProjectMember}
          openProjectDetail={openProjectDetail}
          openAdmin={openAdmin}
          openQuickProjectCreate={openQuickProjectCreate}
          loadDemoData={loadDemoData}
        />
      </section>
      <AppAuthenticatedShellDialogs
        view={view}
        shellState={shellState}
        chrome={chrome}
        taskActions={taskActions}
        focusActions={focusActions}
        closeQuickProjectCreate={closeQuickProjectCreate}
        submitQuickProjectCreate={submitQuickProjectCreate}
        runCommand={runCommand}
      />
    </main>
  );
}
