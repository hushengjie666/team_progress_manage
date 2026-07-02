import type {
  AppState,
  BlockProfile,
  DailyPlan,
  ExecutionSignal,
  FocusSession,
  Interruption,
  Onboarding,
  Project,
  ProjectMember,
  RewardState,
  Settings,
  StrictViolation,
  Task,
  WorkSession,
} from "./types";

type SyncEntity =
  | "project"
  | "team_member"
  | "project_member"
  | "task"
  | "daily_plan"
  | "focus_session"
  | "work_session"
  | "execution_signal"
  | "interruption"
  | "strict_violation"
  | "block_profile"
  | "settings"
  | "onboarding"
  | "reward_state";

type SyncPayload =
  | Project
  | ProjectMember
  | Task
  | DailyPlan
  | FocusSession
  | WorkSession
  | ExecutionSignal
  | Interruption
  | StrictViolation
  | BlockProfile
  | Settings
  | Onboarding
  | RewardState;

export interface SyncMergeRow {
  workspace_id?: string;
  entity: SyncEntity;
  id: string;
  updated_at: string;
  deleted_at?: string;
  payload: unknown;
}

const singletonEntities: SyncEntity[] = ["settings", "onboarding", "reward_state"];
type SyncMergeOptions = { forceRemote?: boolean };

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const timestampFor = (entity: SyncEntity, payload: unknown, fallback: string) => {
  if (!isObject(payload)) return fallback;
  const candidates = [
    "updatedAt",
    "reviewAcceptedAt",
    "reviewReturnedAt",
    "reviewSubmittedAt",
    "endedAt",
    "pausedAt",
    "startedAt",
    "createdAt",
    "completedAt",
  ];
  for (const key of candidates) {
    const value = payload[key];
    if (typeof value === "string" && value) return value;
  }
  return fallback;
};

const localTimestampFor = (entity: SyncEntity, value: SyncPayload, stateUpdatedAt: string) => {
  if (singletonEntities.includes(entity)) return stateUpdatedAt;
  return timestampFor(entity, value, stateUpdatedAt);
};

const shouldAcceptRemote = (remote: SyncMergeRow, local?: SyncPayload, stateUpdatedAt = "", forceRemote = false) => {
  if (forceRemote) return true;
  if (!local) return true;
  return remote.updated_at >= localTimestampFor(remote.entity, local, stateUpdatedAt);
};

const shouldAcceptRemoteOnboarding = (remote: SyncMergeRow, local: Onboarding, stateUpdatedAt: string, forceRemote = false) => {
  if (forceRemote) return true;
  const remotePayload = remote.payload;
  if (local.completed && isObject(remotePayload) && remotePayload.completed === false) return false;
  return shouldAcceptRemote(remote, local, stateUpdatedAt);
};

const upsert = <T extends { id: string }>(entity: SyncEntity, items: T[], incoming: T, updatedAt: string, stateUpdatedAt: string, forceRemote = false) => {
  const existing = items.find((item) => item.id === incoming.id);
  if (!existing) return [incoming, ...items];
  return items.map((item) => (item.id === incoming.id && (forceRemote || updatedAt >= timestampFor(entity, item, stateUpdatedAt)) ? incoming : item));
};

const mergeDailyPlan = (local: DailyPlan, remote: DailyPlan, remoteUpdatedAt: string, stateUpdatedAt: string, forceRemote = false): DailyPlan => {
  const localUpdatedAt = timestampFor("daily_plan", local, stateUpdatedAt);
  const remoteWins = forceRemote || remoteUpdatedAt >= localUpdatedAt;
  if (!remoteWins) return local;
  return {
    ...local,
    ...remote,
    committedTaskIds: remote.committedTaskIds ?? [],
  };
};

const matchesDeletedRow = <T extends { id: string; workspaceId?: string }>(item: T, row: SyncMergeRow) =>
  item.id === row.id && (!row.workspace_id || !item.workspaceId || item.workspaceId === row.workspace_id);

const removeByScopedId = <T extends { id: string; workspaceId?: string }>(items: T[], row: SyncMergeRow) => {
  let removed = false;
  const next = items.filter((item) => {
    const shouldRemove = matchesDeletedRow(item, row);
    if (shouldRemove) removed = true;
    return !shouldRemove;
  });
  return { items: next, removed };
};

const removeMemberReferences = (tasks: Task[], memberId: string) =>
  tasks.map((task) => ({
    ...task,
    creatorMemberId: task.creatorMemberId === memberId ? undefined : task.creatorMemberId,
    primaryExecutorMemberId: task.primaryExecutorMemberId === memberId ? undefined : task.primaryExecutorMemberId,
    collaboratorMemberIds: task.collaboratorMemberIds?.filter((id) => id !== memberId) ?? [],
  }));

const applyDeletedRow = (state: AppState, row: SyncMergeRow): AppState => {
  if (row.entity === "project") {
    const { items } = removeByScopedId(state.projects, row);
    return { ...state, projects: items };
  }
  if (row.entity === "team_member") {
    return state;
  }
  if (row.entity === "project_member") {
    const { items: projectMembers, removed } = removeByScopedId(state.projectMembers, row);
    if (!removed) return state;
    return {
      ...state,
      projectMembers,
      tasks: removeMemberReferences(state.tasks, row.id),
    };
  }
  if (row.entity === "task") {
    const { items: tasks, removed } = removeByScopedId(state.tasks, row);
    if (!removed) return state;
    return {
      ...state,
      tasks,
      dailyPlans: state.dailyPlans.map((plan) => ({
        ...plan,
        committedTaskIds: plan.committedTaskIds.filter((taskId) => taskId !== row.id),
      })),
    };
  }
  if (row.entity === "work_session") return { ...state, workSessions: removeByScopedId(state.workSessions, row).items };
  if (row.entity === "execution_signal") return { ...state, executionSignals: removeByScopedId(state.executionSignals, row).items };
  if (row.entity === "daily_plan") return { ...state, dailyPlans: removeByScopedId(state.dailyPlans, row).items };
  if (row.entity === "focus_session") return { ...state, focusSessions: removeByScopedId(state.focusSessions, row).items };
  if (row.entity === "interruption") return { ...state, interruptions: removeByScopedId(state.interruptions, row).items };
  if (row.entity === "strict_violation") return { ...state, strictViolations: removeByScopedId(state.strictViolations, row).items };
  if (row.entity === "block_profile") return { ...state, blockProfiles: removeByScopedId(state.blockProfiles, row).items };
  return state;
};

const applyUpsertRow = (state: AppState, row: SyncMergeRow, options: SyncMergeOptions = {}): AppState => {
  const rawPayload = row.payload;
  if (!isObject(rawPayload)) return state;
  const payload =
    row.workspace_id && !singletonEntities.includes(row.entity)
      ? { ...rawPayload, workspaceId: row.workspace_id }
      : rawPayload;
  const forceRemote = options.forceRemote ?? false;

  if (row.entity === "settings" && shouldAcceptRemote(row, state.settings, state.updatedAt, forceRemote)) {
    return { ...state, settings: payload as unknown as Settings };
  }
  if (row.entity === "onboarding" && shouldAcceptRemoteOnboarding(row, state.onboarding, state.updatedAt, forceRemote)) {
    return { ...state, onboarding: payload as unknown as Onboarding };
  }
  if (row.entity === "reward_state" && shouldAcceptRemote(row, state.rewardState, state.updatedAt, forceRemote)) {
    return { ...state, rewardState: payload as unknown as RewardState };
  }
  if (row.entity === "project") {
    const incoming = payload as unknown as Project;
    const existing = state.projects.find((project) => project.id === row.id);
    return shouldAcceptRemote(row, existing, state.updatedAt, forceRemote)
      ? { ...state, projects: upsert(row.entity, state.projects, incoming, row.updated_at, state.updatedAt, forceRemote) }
      : state;
  }
  if (row.entity === "team_member") {
    return state;
  }
  if (row.entity === "project_member") {
    const incoming = payload as unknown as ProjectMember;
    const existing = state.projectMembers.find((member) => member.id === row.id);
    return shouldAcceptRemote(row, existing, state.updatedAt, forceRemote)
      ? { ...state, projectMembers: upsert(row.entity, state.projectMembers, incoming, row.updated_at, state.updatedAt, forceRemote) }
      : state;
  }
  if (row.entity === "task") {
    const incoming = payload as unknown as Task;
    const existing = state.tasks.find((task) => task.id === row.id);
    return shouldAcceptRemote(row, existing, state.updatedAt, forceRemote)
      ? { ...state, tasks: upsert(row.entity, state.tasks, incoming, row.updated_at, state.updatedAt, forceRemote) }
      : state;
  }
  if (row.entity === "work_session") {
    const incoming = payload as unknown as WorkSession;
    const existing = state.workSessions.find((session) => session.id === row.id);
    return shouldAcceptRemote(row, existing, state.updatedAt, forceRemote)
      ? { ...state, workSessions: upsert(row.entity, state.workSessions, incoming, row.updated_at, state.updatedAt, forceRemote) }
      : state;
  }
  if (row.entity === "execution_signal") {
    const incoming = payload as unknown as ExecutionSignal;
    const existing = state.executionSignals.find((signal) => signal.id === row.id);
    return shouldAcceptRemote(row, existing, state.updatedAt, forceRemote)
      ? { ...state, executionSignals: upsert(row.entity, state.executionSignals, incoming, row.updated_at, state.updatedAt, forceRemote) }
      : state;
  }
  if (row.entity === "daily_plan") {
    const incoming = payload as unknown as DailyPlan;
    const existing = state.dailyPlans.find((plan) => plan.id === row.id);
    if (existing) {
      return {
        ...state,
        dailyPlans: state.dailyPlans.map((plan) => (plan.id === row.id ? mergeDailyPlan(plan, incoming, row.updated_at, state.updatedAt, forceRemote) : plan)),
      };
    }
    return shouldAcceptRemote(row, existing, state.updatedAt, forceRemote) ? { ...state, dailyPlans: [incoming, ...state.dailyPlans] } : state;
  }
  if (row.entity === "focus_session") {
    const incoming = payload as unknown as FocusSession;
    const existing = state.focusSessions.find((session) => session.id === row.id);
    return shouldAcceptRemote(row, existing, state.updatedAt, forceRemote)
      ? { ...state, focusSessions: upsert(row.entity, state.focusSessions, incoming, row.updated_at, state.updatedAt, forceRemote) }
      : state;
  }
  if (row.entity === "interruption") {
    const incoming = payload as unknown as Interruption;
    const existing = state.interruptions.find((interruption) => interruption.id === row.id);
    return shouldAcceptRemote(row, existing, state.updatedAt, forceRemote)
      ? { ...state, interruptions: upsert(row.entity, state.interruptions, incoming, row.updated_at, state.updatedAt, forceRemote) }
      : state;
  }
  if (row.entity === "strict_violation") {
    const incoming = payload as unknown as StrictViolation;
    const existing = state.strictViolations.find((violation) => violation.id === row.id);
    return shouldAcceptRemote(row, existing, state.updatedAt, forceRemote)
      ? { ...state, strictViolations: upsert(row.entity, state.strictViolations, incoming, row.updated_at, state.updatedAt, forceRemote) }
      : state;
  }
  if (row.entity === "block_profile") {
    const incoming = payload as unknown as BlockProfile;
    const existing = state.blockProfiles.find((profile) => profile.id === row.id);
    return shouldAcceptRemote(row, existing, state.updatedAt, forceRemote)
      ? { ...state, blockProfiles: upsert(row.entity, state.blockProfiles, incoming, row.updated_at, state.updatedAt, forceRemote) }
      : state;
  }
  return state;
};

export const applySyncRowToState = (
  state: AppState,
  row: SyncMergeRow,
  tombstones: AppState["sync"]["tombstones"],
  options: SyncMergeOptions = {},
) => {
  if (row.deleted_at) {
    return {
      state: applyDeletedRow(state, row),
      tombstones: tombstones.filter((item) => !(item.entity === row.entity && item.id === row.id)),
    };
  }
  return { state: applyUpsertRow(state, row, options), tombstones };
};
