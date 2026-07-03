import { businessRowsFromState, type BusinessRow } from "../../../src/teamBusinessRows";
import type { AppState } from "../../../src/types";

export const rowsFromState = (state: AppState): BusinessRow[] => businessRowsFromState(state);

export const rowsForRuntimeStates = (states: Record<string, AppState>): BusinessRow[] =>
  Object.values(states).flatMap(rowsFromState);

const upsertById = <T extends { id: string }>(items: T[], item: T) =>
  items.some((value) => value.id === item.id)
    ? items.map((value) => (value.id === item.id ? item : value))
    : [item, ...items];

export const applyRemoteChange = (state: AppState, change: BusinessRow): AppState => {
  if (change.deleted_at) {
    if (change.entity === "project") return { ...state, projects: state.projects.filter((item) => item.id !== change.id) };
    if (change.entity === "project_member") return { ...state, projectMembers: state.projectMembers.filter((item) => item.id !== change.id) };
    if (change.entity === "task") return { ...state, tasks: state.tasks.filter((item) => item.id !== change.id) };
    if (change.entity === "daily_plan") return { ...state, dailyPlans: state.dailyPlans.filter((item) => item.id !== change.id) };
    if (change.entity === "focus_session") return { ...state, focusSessions: state.focusSessions.filter((item) => item.id !== change.id) };
    if (change.entity === "work_session") return { ...state, workSessions: state.workSessions.filter((item) => item.id !== change.id) };
    if (change.entity === "execution_signal") return { ...state, executionSignals: state.executionSignals.filter((item) => item.id !== change.id) };
    if (change.entity === "interruption") return { ...state, interruptions: state.interruptions.filter((item) => item.id !== change.id) };
    if (change.entity === "task_template") return { ...state, taskTemplates: state.taskTemplates.filter((item) => item.id !== change.id) };
    if (change.entity === "template_instance") {
      return {
        ...state,
        templateInstances: state.templateInstances.filter((item) => `${item.templateId}_${item.taskId}` !== change.id),
      };
    }
    return state;
  }
  const payload = change.payload as never;
  if (change.entity === "reward_state") return { ...state, rewardState: payload };
  if (change.entity === "project") return { ...state, projects: upsertById(state.projects, payload) };
  if (change.entity === "project_member") return { ...state, projectMembers: upsertById(state.projectMembers, payload) };
  if (change.entity === "task") return { ...state, tasks: upsertById(state.tasks, payload) };
  if (change.entity === "daily_plan") return { ...state, dailyPlans: upsertById(state.dailyPlans, payload) };
  if (change.entity === "focus_session") return { ...state, focusSessions: upsertById(state.focusSessions, payload) };
  if (change.entity === "work_session") return { ...state, workSessions: upsertById(state.workSessions, payload) };
  if (change.entity === "execution_signal") return { ...state, executionSignals: upsertById(state.executionSignals, payload) };
  if (change.entity === "interruption") return { ...state, interruptions: upsertById(state.interruptions, payload) };
  if (change.entity === "task_template") return { ...state, taskTemplates: upsertById(state.taskTemplates, payload) };
  if (change.entity === "template_instance") {
    const instance = change.payload as AppState["templateInstances"][number];
    return {
      ...state,
      templateInstances: state.templateInstances.some((item) => item.templateId === instance.templateId && item.taskId === instance.taskId)
        ? state.templateInstances.map((item) => item.templateId === instance.templateId && item.taskId === instance.taskId ? instance : item)
        : [instance, ...state.templateInstances],
    };
  }
  return state;
};

export const createMockWorkspaceStates = (initialState: AppState): Record<string, AppState> => {
  const activeWorkspaceId = initialState.auth.workspace?.id ?? "workspace_e2e";
  const workspaces = initialState.auth.workspaces?.length
    ? initialState.auth.workspaces
    : initialState.auth.workspace
      ? [initialState.auth.workspace]
      : [];
  const projectWorkspaceIds = new Map(initialState.projects.map((project) => [project.id, project.workspaceId ?? activeWorkspaceId]));
  const taskWorkspaceIds = new Map(
    initialState.tasks.map((task) => [task.id, task.workspaceId ?? projectWorkspaceIds.get(task.projectId) ?? activeWorkspaceId]),
  );
  const result: Record<string, AppState> = {};
  for (const workspace of workspaces) {
    result[workspace.id] = {
      ...initialState,
      auth: {
        ...initialState.auth,
        workspace,
      },
      projects: initialState.projects.filter((project) => (project.workspaceId ?? activeWorkspaceId) === workspace.id),
      projectMembers: initialState.projectMembers.filter((member) =>
        (member.workspaceId ?? projectWorkspaceIds.get(member.projectId) ?? activeWorkspaceId) === workspace.id,
      ),
      tasks: initialState.tasks.filter((task) => (task.workspaceId ?? projectWorkspaceIds.get(task.projectId) ?? activeWorkspaceId) === workspace.id),
      dailyPlans: initialState.dailyPlans.filter((plan) => (plan.workspaceId ?? activeWorkspaceId) === workspace.id),
      focusSessions: initialState.focusSessions.filter((session) =>
        (session.workspaceId ?? (session.taskId ? taskWorkspaceIds.get(session.taskId) : activeWorkspaceId) ?? activeWorkspaceId) === workspace.id,
      ),
      workSessions: initialState.workSessions.filter((session) =>
        (session.workspaceId ?? taskWorkspaceIds.get(session.taskId) ?? activeWorkspaceId) === workspace.id,
      ),
      executionSignals: initialState.executionSignals.filter((signal) =>
        (signal.workspaceId ?? taskWorkspaceIds.get(signal.taskId) ?? activeWorkspaceId) === workspace.id,
      ),
      interruptions: initialState.interruptions.filter((interruption) =>
        (interruption.workspaceId ?? (interruption.taskId ? taskWorkspaceIds.get(interruption.taskId) : activeWorkspaceId) ?? activeWorkspaceId) === workspace.id,
      ),
    };
  }
  if (!result[activeWorkspaceId]) result[activeWorkspaceId] = initialState;
  return result;
};
