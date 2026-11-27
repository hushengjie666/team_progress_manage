import type { AppAuthenticatedShellProps } from "./AppAuthenticatedShellTypes";
import { FocusView } from "./focus/FocusView";
import { QuickTodayTaskButton } from "./QuickTodayTaskButton";

type AppFocusRouteProps = Pick<AppAuthenticatedShellProps, "view" | "shellState" | "taskActions" | "focusActions">;

export function AppFocusRoute({ view, shellState, taskActions, focusActions }: AppFocusRouteProps) {
  const { state, currentTask, focusCommittedTasks } = view;
  return (
    <FocusView
      state={state}
      currentTask={currentTask}
      committedTasks={focusCommittedTasks}
      beginTimer={focusActions.beginTimer}
      toggleTimer={focusActions.toggleTimer}
      resetTimer={focusActions.resetTimer}
      finishTimer={focusActions.finishTimer}
      addInterruption={focusActions.addInterruption}
      completeTask={taskActions.completeTask}
      quickTaskButton={<QuickTodayTaskButton state={state} taskActions={taskActions}
        defaultWorkspaceId={shellState.selectedWorkspaceId ?? undefined} defaultProjectId={currentTask?.projectId ?? view.activeProjectId} />}
    />
  );
}
