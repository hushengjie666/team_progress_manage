import type { AppAuthenticatedShellProps } from "./AppAuthenticatedShellTypes";
import { WorkspaceDirectoryView } from "./WorkspaceDirectoryView";
import { filterProjectItemsForWorkspace, projectIdsForWorkspace } from "../workspaceScope";

type AppWorkspaceDirectoryRouteProps = Pick<
  AppAuthenticatedShellProps,
  "view" | "authActions" | "workspaceAccountActions" | "projectActions" | "openProjectDetail"
> & Pick<AppAuthenticatedShellProps, "shellState">;

export function AppWorkspaceDirectoryRoute({
  view,
  shellState,
  authActions,
  workspaceAccountActions,
  projectActions,
  openProjectDetail,
}: AppWorkspaceDirectoryRouteProps) {
  const { state, visibleWorkspaces, workspaceModel } = view;
  const selectedWorkspaceId = shellState.selectedWorkspaceId;
  const projectIds = projectIdsForWorkspace(state, selectedWorkspaceId);
  const workspaces = selectedWorkspaceId
    ? visibleWorkspaces.filter((workspace) => workspace.id === selectedWorkspaceId)
    : visibleWorkspaces;

  return (
    <WorkspaceDirectoryView
      projects={state.projects.filter((project) => projectIds.has(project.id))}
      workspaces={workspaces}
      workspaceMemberships={(state.auth.workspaceMemberships ?? (state.auth.membership ? [state.auth.membership] : []))
        .filter((membership) => !selectedWorkspaceId || membership.workspaceId === selectedWorkspaceId)}
      currentAccount={state.auth.account}
      projectCards={filterProjectItemsForWorkspace(workspaceModel.allProjectOverviewCards, projectIds)}
      createWorkspace={(name) => void authActions.handleCreateWorkspace(name, { returnTo: "workspaces" })}
      updateWorkspace={workspaceAccountActions.updateWorkspace}
      updateWorkspaceMembership={workspaceAccountActions.updateWorkspaceMembership}
      inviteWorkspaceMember={workspaceAccountActions.inviteWorkspaceMember}
      createProject={projectActions.createProject}
      openProjectDetail={(projectId) => openProjectDetail(projectId, "overview")}
    />
  );
}
