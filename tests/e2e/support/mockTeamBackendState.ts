import { flattenStateToChanges, type SyncRow } from "../../../src/sync";
import type { AppState } from "../../../src/types";

export const rowsFromState = (state: AppState, revision: number): SyncRow[] =>
  flattenStateToChanges(state).map((change) => ({
    ...change,
    revision,
    version: 1,
  }));

const upsertById = <T extends { id: string }>(items: T[], item: T) =>
  items.some((value) => value.id === item.id)
    ? items.map((value) => (value.id === item.id ? item : value))
    : [item, ...items];

export const applyRemoteChange = (state: AppState, change: SyncRow): AppState => {
  if (change.deleted_at) return state;
  const payload = change.payload as never;
  if (change.entity === "settings") return { ...state, settings: payload };
  if (change.entity === "reward_state") return { ...state, rewardState: payload };
  if (change.entity === "project") return { ...state, projects: upsertById(state.projects, payload) };
  if (change.entity === "project_member") return { ...state, projectMembers: upsertById(state.projectMembers, payload) };
  if (change.entity === "task") return { ...state, tasks: upsertById(state.tasks, payload) };
  if (change.entity === "daily_plan") return { ...state, dailyPlans: upsertById(state.dailyPlans, payload) };
  if (change.entity === "focus_session") return { ...state, focusSessions: upsertById(state.focusSessions, payload) };
  if (change.entity === "work_session") return { ...state, workSessions: upsertById(state.workSessions, payload) };
  if (change.entity === "execution_signal") return { ...state, executionSignals: upsertById(state.executionSignals, payload) };
  if (change.entity === "interruption") return { ...state, interruptions: upsertById(state.interruptions, payload) };
  return state;
};

export const createMockWorkspaceStates = (initialState: AppState): Record<string, AppState> => {
  const privateWorkspace = initialState.auth.workspaces?.find((workspace) => workspace.type === "private");
  return {
    [initialState.auth.workspace?.id ?? "workspace_e2e"]: initialState,
    ...(privateWorkspace
      ? {
          [privateWorkspace.id]: {
            ...initialState,
            auth: {
              ...initialState.auth,
              workspace: privateWorkspace,
            },
            projects: privateWorkspace.id === initialState.auth.workspace?.id ? initialState.projects : [],
            projectMembers: privateWorkspace.id === initialState.auth.workspace?.id ? initialState.projectMembers : [],
            tasks: privateWorkspace.id === initialState.auth.workspace?.id ? initialState.tasks : [],
            dailyPlans: privateWorkspace.id === initialState.auth.workspace?.id ? initialState.dailyPlans : [],
          },
        }
      : {}),
    workspace_private_account_owner: {
      ...initialState,
      auth: {
        ...initialState.auth,
        workspace: initialState.auth.workspaces?.find((workspace) => workspace.id === "workspace_private_account_owner"),
      },
      projects: [],
      projectMembers: [],
      tasks: [],
      dailyPlans: [],
    },
  };
};
