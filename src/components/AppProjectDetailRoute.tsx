import type { AppAuthenticatedShellProps } from "./AppAuthenticatedShellTypes";
import { ProjectDetailView } from "./ProjectDetailView";

type AppProjectDetailRouteProps = Pick<
  AppAuthenticatedShellProps,
  | "view"
  | "shellState"
  | "chrome"
  | "taskActions"
  | "projectActions"
  | "inviteProjectMember"
  | "openAdmin"
> & {
  beginFocus: (taskId: string) => void;
};

export function AppProjectDetailRoute({
  view,
  shellState,
  chrome,
  taskActions,
  projectActions,
  inviteProjectMember,
  openAdmin,
  beginFocus,
}: AppProjectDetailRouteProps) {
  const {
    state,
    activeProjectId,
    projectDetailModel,
    currentProjectMemberId,
    visibleWorkspaces,
    selectedTask,
  } = view;
  const {
    setTab,
    setWorkspaceMode,
    setSelectedTaskId,
    projectTaskFilters,
    setProjectTaskFilters,
    projectDetailTab,
    setProjectDetailTab,
  } = shellState;

  if (!activeProjectId) return null;

  return (
    <ProjectDetailView
      model={projectDetailModel}
      filters={projectTaskFilters}
      setFilters={setProjectTaskFilters}
      allProjects={state.projects}
      allProjectMembers={state.projectMembers}
      availableWorkspaces={visibleWorkspaces}
      currentProjectMemberId={currentProjectMemberId}
      activeTab={projectDetailTab}
      setActiveTab={setProjectDetailTab}
      selectedTask={selectedTask}
      selectTask={setSelectedTaskId}
      createProjectTask={taskActions.createProjectTask}
      updateProject={projectActions.updateProject}
      updateTask={taskActions.updateTask}
      updateTaskAssignment={taskActions.updateTaskAssignment}
      updateTaskProgress={taskActions.updateTaskProgress}
      acceptTask={taskActions.acceptTask}
      returnTaskForReview={taskActions.returnTaskForReview}
      splitTask={taskActions.splitTask}
      beginFocus={beginFocus}
      bindAccessibleMemberToProject={projectActions.bindAccessibleMemberToProject}
      inviteProjectMember={inviteProjectMember}
      updateProjectMember={projectActions.updateProjectMember}
      canManageProjectMembers={chrome.canManageActiveProjectMembers}
      backToBoard={() => {
        setWorkspaceMode("board");
        setTab("workspace");
      }}
      backToAdmin={() => setTab("workspaces")}
      openMemberSettings={() => openAdmin("members")}
    />
  );
}
