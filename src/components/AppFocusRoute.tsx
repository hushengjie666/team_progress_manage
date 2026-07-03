import type { AppAuthenticatedShellProps } from "./AppAuthenticatedShellTypes";
import { FocusView } from "./focus/FocusView";

type AppFocusRouteProps = Pick<AppAuthenticatedShellProps, "view" | "taskActions" | "focusActions">;

export function AppFocusRoute({ view, taskActions, focusActions }: AppFocusRouteProps) {
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
    />
  );
}
