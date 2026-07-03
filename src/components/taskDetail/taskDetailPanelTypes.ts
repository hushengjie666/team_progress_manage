import type { AppState, ProjectMember, Task } from "../../types";

export type TaskDetailPanelProps = {
  task?: Task;
  projects: AppState["projects"];
  projectMembers: ProjectMember[];
  updateTask: (taskId: string, updater: Partial<Task> | ((task: Task) => Task)) => void;
  updateTaskAssignment: (taskId: string, assignment: {
    projectId?: string;
    primaryExecutorMemberId?: string;
    collaboratorMemberIds?: string[];
  }) => void;
  updateTaskProgress: (taskId: string, progressPercent: number, progressNote: string) => void;
  acceptTask: (taskId: string) => void;
  returnTaskForReview: (taskId: string, reason: string) => void;
  close: () => void;
  splitTask: (taskId: string) => void;
  canEdit?: boolean;
  canReview?: boolean;
  lockProject?: boolean;
};
