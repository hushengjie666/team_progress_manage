import type { AppAuthenticatedShellProps } from "./AppAuthenticatedShellTypes";
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
      reorderProjects={projectActions.reorderProjects}
      openProjectCreate={openQuickProjectCreate}
      openProjectDetail={(projectId) => openProjectDetail(projectId, "overview")}
    />
  );
}
