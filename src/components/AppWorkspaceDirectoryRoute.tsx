import type { AppAuthenticatedShellProps } from "./AppAuthenticatedShellTypes";
import { WorkspaceDirectoryView } from "./WorkspaceDirectoryView";

type AppWorkspaceDirectoryRouteProps = Pick<
  AppAuthenticatedShellProps,
  "view" | "authActions" | "workspaceAccountActions" | "projectActions" | "openProjectDetail"
>;

export function AppWorkspaceDirectoryRoute({
  view,
  authActions,
  workspaceAccountActions,
  projectActions,
  openProjectDetail,
}: AppWorkspaceDirectoryRouteProps) {
  const { state, visibleWorkspaces, workspaceModel } = view;

  return (
    <WorkspaceDirectoryView
      projects={state.projects}
      workspaces={visibleWorkspaces}
      workspaceMemberships={state.auth.workspaceMemberships ?? (state.auth.membership ? [state.auth.membership] : [])}
      currentAccount={state.auth.account}
      projectCards={workspaceModel.projectOverviewCards}
      createWorkspace={(name) => void authActions.handleCreateWorkspace(name, { returnTo: "workspaces" })}
      updateWorkspace={workspaceAccountActions.updateWorkspace}
      updateWorkspaceMembership={workspaceAccountActions.updateWorkspaceMembership}
      inviteWorkspaceMember={workspaceAccountActions.inviteWorkspaceMember}
      createProject={projectActions.createProject}
      updateProject={projectActions.updateProject}
      openProjectDetail={(projectId) => openProjectDetail(projectId, "overview")}
    />
  );
}
