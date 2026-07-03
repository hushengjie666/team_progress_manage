import { isObject, shouldAcceptRemote, timestampFor, upsert } from "./syncEntityMergeHelpers";
import { singletonEntities, type SyncMergeOptions, type SyncMergeRow } from "./syncEntityMergeTypes";
import { alignDailyPlanIdentity, dailyPlanIdentityKey } from "./dailyPlanScope";
import type {
  AppState,
  DailyPlan,
  ExecutionSignal,
  FocusSession,
  Interruption,
  Project,
  ProjectMember,
  RewardState,
  Settings,
  Task,
  WorkSession,
} from "./types";

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

export const applyUpsertSyncRow = (state: AppState, row: SyncMergeRow, options: SyncMergeOptions = {}): AppState => {
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
    const incomingPayload = payload as unknown as DailyPlan;
    const incomingWithOwner: DailyPlan = row.account_id && !incomingPayload.ownerAccountId
      ? { ...incomingPayload, ownerAccountId: row.account_id }
      : incomingPayload;
    const incoming = alignDailyPlanIdentity(incomingWithOwner);
    const incomingKey = dailyPlanIdentityKey(incoming);
    const existing = state.dailyPlans.find((plan) => plan.id === incoming.id || dailyPlanIdentityKey(plan) === incomingKey);
    if (existing) {
      const merged = mergeDailyPlan(alignDailyPlanIdentity(existing), incoming, row.updated_at, state.updatedAt, forceRemote);
      return {
        ...state,
        dailyPlans: state.dailyPlans.flatMap((plan) => {
          if (plan.id === existing.id) return [merged];
          if (dailyPlanIdentityKey(plan) === incomingKey) return [];
          return [plan];
        }),
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
  return state;
};
