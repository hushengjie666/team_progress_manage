import type { AppState, WorkSession } from "./types";
import type { SyncChange, SyncEntity } from "./syncPayloadTypes";
import { buildSyncStateFlattenWorkspace } from "./syncStateFlattenWorkspace";

const isAfter = (value: string, baseline?: string) => !baseline || value > baseline;

const activeWorkSessionTaskIds = (state: AppState) =>
  new Set(
    state.workSessions
      .filter((session) => session.status === "active" || session.status === "paused")
      .map((session) => session.taskId),
  );

export function flattenStateToChanges(state: AppState, options: { changedAfter?: string } = {}): SyncChange[] {
  const deviceID = state.sync.deviceId;
  const changedAfter = options.changedAfter;
  const activeTaskIds = activeWorkSessionTaskIds(state);
  const workspace = buildSyncStateFlattenWorkspace(state);
  const changes: SyncChange[] = [
    {
      workspace_id: workspace.currentWorkspaceId,
      entity: "settings",
      id: "default",
      device_id: deviceID,
      updated_at: state.updatedAt,
      payload: state.settings,
    },
    {
      workspace_id: workspace.currentWorkspaceId,
      entity: "reward_state",
      id: "default",
      device_id: deviceID,
      updated_at: state.updatedAt,
      payload: state.rewardState,
    },
    ...state.projects.map((project) => ({
      workspace_id: workspace.workspaceIdForPayload(project, workspace.currentWorkspaceId),
      entity: "project" as const,
      id: project.id,
      device_id: deviceID,
      updated_at: project.updatedAt,
      payload: project,
    })),
    ...state.projectMembers.map((member) => ({
      workspace_id: workspace.workspaceIdForPayload(member, workspace.projectWorkspaceId(member.projectId) ?? workspace.currentWorkspaceId),
      entity: "project_member" as const,
      id: member.id,
      device_id: deviceID,
      updated_at: member.updatedAt,
      payload: member,
    })),
    ...state.tasks.map((task) => ({
      workspace_id: workspace.workspaceIdForPayload(task, workspace.projectWorkspaceId(task.projectId) ?? workspace.currentWorkspaceId),
      entity: "task" as const,
      id: task.id,
      device_id: deviceID,
      updated_at: task.updatedAt,
      payload: task,
    })),
    ...state.workSessions.map((session) => ({
      workspace_id: workspace.workspaceIdForPayload(session, workspace.taskWorkspaceId(session.taskId) ?? workspace.currentWorkspaceId),
      entity: "work_session" as const,
      id: session.id,
      device_id: deviceID,
      updated_at: session.updatedAt,
      payload: session,
    })),
    ...state.executionSignals.map((signal) => ({
      workspace_id: workspace.workspaceIdForPayload(signal, workspace.taskWorkspaceId(signal.taskId) ?? workspace.currentWorkspaceId),
      entity: "execution_signal" as const,
      id: signal.id,
      device_id: deviceID,
      updated_at: signal.createdAt,
      payload: signal,
    })),
    ...state.dailyPlans.map((plan) => ({
      workspace_id: workspace.workspaceIdForPayload(plan, workspace.currentWorkspaceId),
      entity: "daily_plan" as const,
      id: plan.id,
      device_id: deviceID,
      updated_at: plan.updatedAt,
      payload: plan,
    })),
    ...state.focusSessions.map((session) => ({
      workspace_id: workspace.workspaceIdForPayload(
        session,
        session.taskId ? workspace.taskWorkspaceId(session.taskId) : workspace.currentWorkspaceId,
      ),
      entity: "focus_session" as const,
      id: session.id,
      device_id: deviceID,
      updated_at: session.endedAt ?? session.startedAt,
      payload: session,
    })),
    ...state.interruptions.map((interruption) => ({
      workspace_id: workspace.workspaceIdForPayload(
        interruption,
        interruption.taskId ? workspace.taskWorkspaceId(interruption.taskId) : workspace.currentWorkspaceId,
      ),
      entity: "interruption" as const,
      id: interruption.id,
      device_id: deviceID,
      updated_at: interruption.resolvedAt ?? interruption.createdAt,
      payload: interruption,
    })),
  ];

  for (const tombstone of state.sync.tombstones ?? []) {
    if (!isAfter(tombstone.deletedAt, changedAfter)) continue;
    changes.push({
      workspace_id: tombstone.workspaceId ?? workspace.currentWorkspaceId,
      entity: tombstone.entity as SyncEntity,
      id: tombstone.id,
      device_id: deviceID,
      updated_at: tombstone.deletedAt,
      deleted_at: tombstone.deletedAt,
      payload: {},
    });
  }

  return changes.filter((change) => {
    if (isAfter(change.updated_at, changedAfter)) return true;
    if (change.entity === "work_session" && (change.payload as WorkSession).status !== "ended") return true;
    if (change.entity === "task" && activeTaskIds.has(change.id)) return true;
    return false;
  });
}
