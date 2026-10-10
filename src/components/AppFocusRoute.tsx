import { useState } from "react";
import { accessibleProjectIdsForCurrentUser, workspaceIdForProject } from "../accessControl";
import type { AppAuthenticatedShellProps } from "./AppAuthenticatedShellTypes";
import { FocusView } from "./focus/FocusView";
import { FocusQuickTaskDialog } from "./focus/FocusQuickTaskDialog";

type AppFocusRouteProps = Pick<AppAuthenticatedShellProps, "view" | "shellState" | "taskActions" | "focusActions">;

export function AppFocusRoute({ view, shellState, taskActions, focusActions }: AppFocusRouteProps) {
  const { state, currentTask, focusCommittedTasks, focusActiveTimer } = view;
  const [showCreateTask, setShowCreateTask] = useState(false);
  const accessibleProjectIds = accessibleProjectIdsForCurrentUser(state);
  const projects = state.projects.filter((project) =>
    accessibleProjectIds.has(project.id) && !project.archivedAt &&
    (!shellState.selectedWorkspaceId || workspaceIdForProject(state, project) === shellState.selectedWorkspaceId));

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
        openCreateTask={() => setShowCreateTask(true)}
        canCreateTask={projects.length > 0}
      />
      {showCreateTask && (
        <FocusQuickTaskDialog
          state={state}
          projects={projects}
          defaultProjectId={currentTask?.projectId ?? view.activeProjectId}
          taskActions={taskActions}
          onClose={() => setShowCreateTask(false)}
        />
      )}
    </>
  );
}
