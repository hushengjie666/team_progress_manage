import { defaultTaskStageForMode, emptyTaskDefaults, nowIso } from "./appModel";
import { resolveMemberIdForProject } from "./memberIdentity";
import { uid } from "./seed";
import type { AppState, Task } from "./types";
import type { IdFactory, ProjectTaskInput } from "./projectDetailTypes";

const estimateHoursToPomodoros = (estimateHours?: number, focusMinutes = 25) => {
  const safeFocusMinutes = Math.max(1, Math.round(focusMinutes));
  const safeHours = Math.max(0, estimateHours ?? 1);
  return Math.max(1, Math.ceil((safeHours * 60) / safeFocusMinutes));
};

export const createProjectTaskInState = (
  state: AppState,
  projectId: string,
  input: ProjectTaskInput,
  timestamp = nowIso(),
  idFactory: IdFactory = uid,
): AppState => {
  const title = input.title.trim();
  const project = state.projects.find((item) => item.id === projectId);
  if (!title || !project) return state;

  const task: Task = {
    id: idFactory("task"),
    workspaceId: project.workspaceId ?? state.auth.workspace?.id,
    title,
    notes: input.notes?.trim() ?? "",
    tags: input.tags ?? [],
    projectId: project.id,
    project: project.name,
    creatorMemberId: resolveMemberIdForProject(state, project.id),
    primaryExecutorMemberId: input.primaryExecutorMemberId || undefined,
    collaboratorMemberIds: input.collaboratorMemberIds?.filter((id) => id !== input.primaryExecutorMemberId) ?? [],
    expectedStartAt: input.expectedStartAt,
    expectedFinishAt: input.expectedFinishAt,
    priority: input.priority ?? "medium",
    severity: input.severity ?? "medium",
    stage: input.stage ?? defaultTaskStageForMode(project.taskStageMode ?? "software"),
    estimatePomodoros: input.estimateHours !== undefined
      ? estimateHoursToPomodoros(input.estimateHours, state.settings.focusMinutes)
      : Math.max(1, Math.round(input.estimatePomodoros ?? 1)),
    status: "pool",
    ...emptyTaskDefaults(timestamp, Date.now()),
    dueAt: input.dueAt,
    reminderAt: input.reminderAt,
    repeatRule: input.repeatRule ?? "none",
    repeatIntervalDays: input.repeatIntervalDays,
    subtasks: (input.subtasks ?? [])
      .map((title) => title.trim())
      .filter(Boolean)
      .map((title) => ({
        id: idFactory("subtask"),
        title,
        completed: false,
        createdAt: timestamp,
      })),
  };

  return {
    ...state,
    tasks: [task, ...state.tasks],
    updatedAt: timestamp,
  };
};
