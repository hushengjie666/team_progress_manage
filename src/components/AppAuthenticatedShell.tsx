import { useEffect } from "react";
import { workspaceIdForProject } from "../accessControl";
import type { AppAuthenticatedShellProps } from "./AppAuthenticatedShellTypes";
import { AppTopbar } from "./AppTopbar";
import { AppAuthenticatedShellDialogs } from "./AppAuthenticatedShellDialogs";
import { AppAuthenticatedShellRoutes } from "./AppAuthenticatedShellRoutes";
import { AppAuthenticatedShellTopbarActions } from "./AppAuthenticatedShellTopbarActions";
import { platformRootClass } from "../platformCapabilities";
import { useMobileNavigationScroll } from "../useMobileNavigationScroll";

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
  useMobileNavigationScroll(view.tab, view.workspaceMode, shellState.projectDetailTab);
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
    <main className={`app-shell ${platformRootClass()}`}>
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
        {view.state.backend.status === "error" && (
          <div className="backend-error-banner" role="alert">
            <div>
              <strong>{view.state.backend.failureKind === "save" ? "保存结果未确认" : "团队数据暂时无法刷新"}</strong>
              <p>{view.state.backend.message}</p>
            </div>
            <button className="secondary-button" onClick={() => void backendActions.handleBackendRefresh()}>刷新数据</button>
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
      <div className="notification-stack">
        {chrome.toast && chrome.toastVisible && !(view.state.backend.status === "error" && chrome.toast === view.state.backend.message) && (
          <div className="global-toast" role="status" aria-live="polite">
            {chrome.toast}
          </div>
        )}
        {shellState.deletedTaskSnapshot && (
          <div className="global-toast undo-banner" role="status" aria-live="polite">
            <div>
              <span>已删除「{shellState.deletedTaskSnapshot.task.title}」</span>
              <small>8 秒内可撤销</small>
            </div>
            <button className="small-button" onClick={taskActions.undoDeleteTask}>撤销</button>
          </div>
        )}
      </div>
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
