import { type TaskDraft } from "../appModel";
import type { WorkspaceViewModel } from "../workbenchModel";
import type { ActiveTimer, Project, ProjectMember, Task } from "../types";
import { TaskDetailModal } from "./taskDetail/TaskDetailModal";
import { ProjectOverviewCardsPanel } from "./workspace/ProjectOverviewCardsPanel";
import { WorkspaceWorkbenchColumns } from "./workspace/WorkspaceWorkbenchColumns";

export function WorkspaceView(props: {
  mode: "board" | "workbench";
  model: WorkspaceViewModel;
  draft: TaskDraft;
  setDraft: (draft: TaskDraft) => void;
  addTask: (projectId?: string) => void;
  selectedWorkbenchProjectIds: string[];
  toggleWorkbenchProject: (projectId: string) => void;
  activeTimer?: ActiveTimer;
  projects: Project[];
  projectMembers: ProjectMember[];
  selectedTask?: Task;
  commitTask: (taskId: string) => void;
  removeCommittedTask: (taskId: string) => void;
  completeTask: (taskId: string) => void;
  deleteTask: (taskId: string) => void;
  selectTask: (taskId: string | null) => void;
  updateTask: (taskId: string, updater: Partial<Task> | ((task: Task) => Task)) => void;
  updateTaskAssignment: (taskId: string, assignment: { projectId?: string; primaryExecutorMemberId?: string; collaboratorMemberIds?: string[] }) => void;
  updateTaskProgress: (taskId: string, progressPercent: number, progressNote: string) => void;
  acceptTask: (taskId: string) => void;
  returnTaskForReview: (taskId: string, reason: string) => void;
  moveCommittedTask: (taskId: string, direction: -1 | 1) => void;
  splitTask: (taskId: string) => void;
  beginFocus: (taskId: string) => void;
  reorderProjects: (projectIds: string[]) => void;
  openProjectCreate: () => void;
  openProjectDetail: (projectId: string) => void;
  backendError?: string;
}) {
  const {
    model,
    selectedWorkbenchProjectIds,
    toggleWorkbenchProject,
    activeTimer,
    projects,
    projectMembers,
    selectedTask,
    commitTask,
    removeCommittedTask,
    completeTask,
    deleteTask,
    selectTask,
    updateTask,
    updateTaskAssignment,
    updateTaskProgress,
    acceptTask,
    returnTaskForReview,
    moveCommittedTask,
    splitTask,
    beginFocus,
  } = props;

  const {
    myProjectTaskCards,
    committedWorkbenchTasks,
    poolWorkbenchTasks,
    projectOverviewCards,
  } = model;

  if (props.backendError) {
    return <p className="empty" role="alert">{props.backendError}</p>;
  }

  if (props.mode === "board") {
    return (
      <div className="content-grid workspace-grid project-overview-grid">
        <ProjectOverviewCardsPanel
          cards={projectOverviewCards}
          openProjectDetail={props.openProjectDetail}
          openProjectCreate={props.openProjectCreate}
          reorderProjects={props.reorderProjects}
        />
      </div>
    );
  }

  return (
    <div className="content-grid workspace-grid">
      <WorkspaceWorkbenchColumns
        myProjectTaskCards={myProjectTaskCards}
        poolWorkbenchTasks={poolWorkbenchTasks}
        committedWorkbenchTasks={committedWorkbenchTasks}
        selectedWorkbenchProjectIds={selectedWorkbenchProjectIds}
        toggleWorkbenchProject={toggleWorkbenchProject}
        activeTimer={activeTimer}
        commitTask={commitTask}
        removeCommittedTask={removeCommittedTask}
        completeTask={completeTask}
        deleteTask={deleteTask}
        selectTask={selectTask}
        moveCommittedTask={moveCommittedTask}
        splitTask={splitTask}
        beginFocus={beginFocus}
      />

      <TaskDetailModal
        task={selectedTask}
        projects={projects}
        projectMembers={projectMembers}
        updateTask={updateTask}
        updateTaskAssignment={updateTaskAssignment}
        updateTaskProgress={updateTaskProgress}
        acceptTask={acceptTask}
        returnTaskForReview={returnTaskForReview}
        close={() => selectTask(null)}
        splitTask={splitTask}
      />

    </div>
  );
}
