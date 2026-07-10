import type { AppAuthenticatedShellProps } from "./AppAuthenticatedShellTypes";
import { FocusView } from "./focus/FocusView";
import { workspaceForProject } from "../accessControl";

type AppFocusRouteProps = Pick<AppAuthenticatedShellProps, "view" | "shellState" | "taskActions" | "focusActions">;

export function AppFocusRoute({ view, shellState, taskActions, focusActions }: AppFocusRouteProps) {
  const { state, currentTask, focusCommittedTasks } = view;
  const currentProject = currentTask
    ? state.projects.find((project) => project.id === currentTask.projectId)
    : undefined;
  const currentWorkspace = currentProject ? workspaceForProject(state, currentProject) : undefined;
  const outsideSelectedWorkspace = Boolean(
    shellState.selectedWorkspaceId && currentWorkspace?.id !== shellState.selectedWorkspaceId,
  );

  return (
    <FocusView
      state={state}
      currentTask={currentTask}
      committedTasks={focusCommittedTasks}
      currentTaskWorkspaceLabel={outsideSelectedWorkspace ? currentWorkspace?.name : undefined}
      beginTimer={focusActions.beginTimer}
      toggleTimer={focusActions.toggleTimer}
      resetTimer={focusActions.resetTimer}
      finishTimer={focusActions.finishTimer}
      addInterruption={focusActions.addInterruption}
      completeTask={taskActions.completeTask}
    />
  );
}
