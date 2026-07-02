import type {
  AppState,
  DailyPlan,
  ExecutionSignal,
  Project,
  ProjectMember,
  SyncConflict,
  Task,
  WorkSession,
} from "./types";

export type SyncConflictResolutionAction = "local" | "remote";

export const syncConflictResolutionMessage = (action: SyncConflictResolutionAction) =>
  action === "local"
    ? "已选择保留本地版本，下次同步会继续推送本地快照。"
    : "已使用远端版本覆盖本地可识别字段。";

export const syncConflictResolutionToast = (action: SyncConflictResolutionAction) =>
  action === "local" ? "已保留本地版本" : "已使用远端版本";

export function applySyncConflictResolution(
  state: AppState,
  conflict: SyncConflict,
  action: SyncConflictResolutionAction,
  timestamp: string,
): AppState {
  let next = state;
  if (action === "remote" && conflict.remotePayload && typeof conflict.remotePayload === "object") {
    const payload = conflict.remotePayload as Partial<Task> & Record<string, unknown>;
    if (conflict.entity === "project") {
      next = { ...next, projects: next.projects.map((project) => (project.id === conflict.id ? { ...project, ...payload, id: conflict.id } as Project : project)) };
    }
    if (conflict.entity === "project_member") {
      next = { ...next, projectMembers: next.projectMembers.map((member) => (member.id === conflict.id ? { ...member, ...payload, id: conflict.id } as ProjectMember : member)) };
    }
    if (conflict.entity === "task") {
      next = { ...next, tasks: next.tasks.map((task) => (task.id === conflict.id ? { ...task, ...payload, id: conflict.id } as Task : task)) };
    }
    if (conflict.entity === "work_session") {
      next = { ...next, workSessions: next.workSessions.map((session) => (session.id === conflict.id ? { ...session, ...payload, id: conflict.id } as WorkSession : session)) };
    }
    if (conflict.entity === "execution_signal") {
      next = { ...next, executionSignals: next.executionSignals.map((signal) => (signal.id === conflict.id ? { ...signal, ...payload, id: conflict.id } as ExecutionSignal : signal)) };
    }
    if (conflict.entity === "daily_plan") {
      next = { ...next, dailyPlans: next.dailyPlans.map((plan) => (plan.id === conflict.id ? { ...plan, ...payload, id: conflict.id } as DailyPlan : plan)) };
    }
    if (conflict.entity === "settings") {
      next = { ...next, settings: { ...next.settings, ...payload } as AppState["settings"] };
    }
  }

  return {
    ...next,
    sync: {
      ...next.sync,
      conflicts: next.sync.conflicts.filter((item) => !(item.entity === conflict.entity && item.id === conflict.id && item.revision === conflict.revision)),
      conflictCount: Math.max(0, next.sync.conflictCount - 1),
      message: syncConflictResolutionMessage(action),
    },
    updatedAt: timestamp,
  };
}
