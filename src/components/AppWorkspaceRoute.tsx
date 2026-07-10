import type { AppAuthenticatedShellProps } from "./AppAuthenticatedShellTypes";
import { mergeScopedProjectOrder } from "../workspaceScope";
import { WorkspaceView } from "./WorkspaceView";

type AppWorkspaceRouteProps = Pick<
  AppAuthenticatedShellProps,
  | "view"
  | "shellState"
  | "taskActions"
  | "projectActions"
  | "openProjectDetail"
  | "openQuickProjectCreate"
> & {
  beginFocus: (taskId: string) => void;
};

export function AppWorkspaceRoute({
  view,
  shellState,
  taskActions,
  projectActions,
  openProjectDetail,
  openQuickProjectCreate,
  beginFocus,
}: AppWorkspaceRouteProps) {
  const {
    state,
    workspaceMode,
    workspaceModel,
    selectedWorkbenchProjectIds,
    toggleWorkbenchProject,
    selectedTask,
  } = view;
  const { setSelectedTaskId, taskDraft, setTaskDraft } = shellState;
  const reorderProjects = (orderedProjectIds: string[]) => {
    if (!shellState.selectedWorkspaceId) {
      projectActions.reorderProjects(orderedProjectIds);
      return;
    }
    projectActions.reorderProjects(mergeScopedProjectOrder(
      workspaceModel.allProjectOverviewCards.map((card) => card.projectId),
      workspaceModel.projectOverviewCards.map((card) => card.projectId),
      orderedProjectIds,
    ));
  };

  return (
    <WorkspaceView
      mode={workspaceMode}
      model={workspaceModel}
      draft={taskDraft}
      setDraft={setTaskDraft}
      addTask={taskActions.addTask}
      selectedWorkbenchProjectIds={selectedWorkbenchProjectIds}
      toggleWorkbenchProject={toggleWorkbenchProject}
      activeTimer={state.activeTimer}
      projects={state.projects}
      projectMembers={state.projectMembers}
      selectedTask={selectedTask}
      commitTask={taskActions.commitTask}
      removeCommittedTask={taskActions.removeCommittedTask}
      completeTask={taskActions.completeTask}
      deleteTask={taskActions.deleteTask}
      selectTask={setSelectedTaskId}
      updateTask={taskActions.updateTask}
      updateTaskAssignment={taskActions.updateTaskAssignment}
      updateTaskProgress={taskActions.updateTaskProgress}
      acceptTask={taskActions.acceptTask}
      returnTaskForReview={taskActions.returnTaskForReview}
      moveCommittedTask={taskActions.moveCommittedTask}
      splitTask={taskActions.splitTask}
      beginFocus={beginFocus}
      reorderProjects={reorderProjects}
      openProjectCreate={openQuickProjectCreate}
      openProjectDetail={(projectId) => openProjectDetail(projectId, "overview")}
    />
  );
}
