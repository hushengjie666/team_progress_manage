import type { ProjectTaskInput } from "./projectDetail";
import type { DeletedTaskSnapshot, SplitDraft, TaskDraft } from "./appModel";
import type { AppState, Task, TaskTemplate } from "./types";

export type UpdateAppTaskState = (updater: (value: AppState) => AppState) => void;
export type AppTaskActionSetter<T> = (value: T | ((current: T) => T)) => void;

export type AppTaskActionsRuntimeOptions = {
  getState: () => AppState;
  getCurrentProjectId: () => string;
  getDraft: () => TaskDraft;
  getSelectedTaskId: () => string | null;
  getPendingDeleteTask: () => Task | null;
  getDeletedTaskSnapshot: () => DeletedTaskSnapshot | null;
  getPendingSplit: () => SplitDraft | null;
  updateState: UpdateAppTaskState;
  setDraft: AppTaskActionSetter<TaskDraft>;
  setToast: (message: string) => void;
  setSelectedTaskId: AppTaskActionSetter<string | null>;
  setPreferredFocusTaskId: AppTaskActionSetter<string | null>;
  setPendingDeleteTask: AppTaskActionSetter<Task | null>;
  setDeletedTaskSnapshot: AppTaskActionSetter<DeletedTaskSnapshot | null>;
  setPendingSplit: AppTaskActionSetter<SplitDraft | null>;
  setTab: (tab: "workspace" | "workspaces" | "focus" | "settings" | "project") => void;
  undoTimerRef: { current: number | null };
};

export type AppTaskActionsRuntime = {
  addTask: (projectId?: string) => void;
  createProjectTask: (projectId: string, input: ProjectTaskInput) => void;
  commitTask: (taskId: string) => void;
  removeCommittedTask: (taskId: string) => void;
  completeTask: (taskId: string) => void;
  acceptTask: (taskId: string) => void;
  returnTaskForReview: (taskId: string, reason: string) => void;
  deleteTask: (taskId: string) => void;
  confirmDeleteTask: () => void;
  undoDeleteTask: () => void;
  updateTask: (taskId: string, updater: Partial<Task> | ((task: Task) => Task)) => void;
  updateTaskAssignment: (
    taskId: string,
    assignment: { projectId?: string; primaryExecutorMemberId?: string; collaboratorMemberIds?: string[] },
  ) => void;
  updateTaskProgress: (taskId: string, progressPercent: number, progressNote: string) => void;
  moveCommittedTask: (taskId: string, direction: -1 | 1) => void;
  splitTask: (taskId: string) => void;
  confirmSplitTask: () => void;
  instantiateTaskTemplate: (template: TaskTemplate) => void;
  saveTaskTemplate: (template: TaskTemplate) => void;
  deleteTaskTemplate: (templateId: string) => void;
  scheduleTaskForDate: (date: string, taskId: string) => void;
};
