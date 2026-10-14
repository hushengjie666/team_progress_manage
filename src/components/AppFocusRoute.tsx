import { useRef, useState } from "react";
import { accessibleProjectIdsForCurrentUser } from "../accessControl";
import type { AppAuthenticatedShellProps } from "./AppAuthenticatedShellTypes";
import { FocusView } from "./focus/FocusView";
import { FocusQuickTaskDialog, type FocusQuickTaskRecovery } from "./focus/FocusQuickTaskDialog";

type AppFocusRouteProps = Pick<AppAuthenticatedShellProps, "view" | "shellState" | "taskActions" | "focusActions">;

export function AppFocusRoute({ view, shellState, taskActions, focusActions }: AppFocusRouteProps) {
  const { state, currentTask, focusCommittedTasks, focusActiveTimer } = view;
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [recovery, setRecovery] = useState<FocusQuickTaskRecovery>();
  const dialogSessionRef = useRef(0);
  const dialogSession = dialogSessionRef.current;
  const accessibleProjectIds = accessibleProjectIdsForCurrentUser(state);
  const projects = state.projects.filter((project) =>
    accessibleProjectIds.has(project.id) && !project.archivedAt);

  return (
    <>
      <FocusView
        state={state}
        activeTimer={focusActiveTimer}
        currentTask={currentTask}
        committedTasks={focusCommittedTasks}
        beginTimer={focusActions.beginTimer}
        toggleTimer={focusActions.toggleTimer}
        resetTimer={focusActions.resetTimer}
        finishTimer={focusActions.finishTimer}
        addInterruption={focusActions.addInterruption}
        completeTask={taskActions.completeTask}
        openCreateTask={() => {
          dialogSessionRef.current += 1;
          setRecovery(undefined);
          setShowCreateTask(true);
        }}
        canCreateTask={projects.length > 0}
      />
      {showCreateTask && (
        <FocusQuickTaskDialog
          key={dialogSession}
          state={state}
          projects={projects}
          defaultWorkspaceId={shellState.selectedWorkspaceId ?? undefined}
          defaultProjectId={currentTask?.projectId ?? view.activeProjectId}
          taskActions={taskActions}
          recovery={recovery}
          onClose={() => setShowCreateTask(false)}
          onQueueFailure={(failed) => {
            if (dialogSessionRef.current !== dialogSession) return;
            dialogSessionRef.current += 1;
            setRecovery(failed);
            setShowCreateTask(true);
          }}
        />
      )}
    </>
  );
}
