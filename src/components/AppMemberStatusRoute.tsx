import type { AppAuthenticatedShellProps } from "./AppAuthenticatedShellTypes";
import { MemberStatusView } from "./MemberStatusView";
import { TaskDetailModal } from "./taskDetail/TaskDetailModal";
import { projectAccessForCurrentMember } from "../projectDetail";
import { workspaceIdForTask } from "../dailyPlanScope";

type AppMemberStatusRouteProps = Pick<AppAuthenticatedShellProps, "view" | "shellState" | "taskActions">;

export function AppMemberStatusRoute({ view, shellState, taskActions }: AppMemberStatusRouteProps) {
  const selected = view.selectedTask;
  const inScope = selected && (!shellState.selectedWorkspaceId || workspaceIdForTask(view.state, selected) === shellState.selectedWorkspaceId);
  const access = selected ? projectAccessForCurrentMember(view.state, selected.projectId) : undefined;
  return (
    <>
      <MemberStatusView
        state={view.state}
        workspaceId={shellState.selectedWorkspaceId ?? undefined}
        selectTask={shellState.setSelectedTaskId}
      />
      <TaskDetailModal
        task={inScope && access?.canView ? selected : undefined}
        projects={view.state.projects}
        projectMembers={view.state.projectMembers}
        updateTask={taskActions.updateTask}
        updateTaskAssignment={taskActions.updateTaskAssignment}
        updateTaskProgress={taskActions.updateTaskProgress}
        acceptTask={taskActions.acceptTask}
        returnTaskForReview={taskActions.returnTaskForReview}
        splitTask={taskActions.splitTask}
        deleteTask={taskActions.deleteTask}
        canEdit={access?.canEditTasks ?? false}
        canReview={access?.canReviewTasks ?? false}
        close={() => shellState.setSelectedTaskId(null)}
      />
    </>
  );
}
