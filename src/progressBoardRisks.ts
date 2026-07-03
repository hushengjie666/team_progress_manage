import type { AppState, Task } from "./types";
import type { StalledTaskRisk, StalledTaskRiskKind } from "./progressBoardTypes";

export const expectedStartForTask = (state: AppState, task: Task): string | undefined => {
  if (task.expectedStartAt) return task.expectedStartAt;
  if (!task.primaryExecutorMemberId) return undefined;
  const project = state.projects.find((item) => item.id === task.projectId);
  const hours = project?.defaultExpectedStartHours;
  if (!hours) return undefined;
  return new Date(new Date(task.createdAt).getTime() + hours * 3_600_000).toISOString();
};

const latestTaskSignalAt = (state: AppState, task: Task): string | undefined => {
  const values = [
    ...state.executionSignals.filter((signal) => signal.taskId === task.id).map((signal) => signal.createdAt),
    ...state.workSessions
      .filter((session) => session.taskId === task.id)
      .flatMap((session) => [session.startedAt, session.pausedAt, session.endedAt].filter((value): value is string => Boolean(value))),
    task.progressPercent || task.progressNote ? task.updatedAt : undefined,
  ].filter((value): value is string => Boolean(value));
  const sorted = values.sort();
  return sorted[sorted.length - 1];
};

export const stalledTaskRisks = (state: AppState, now = new Date()): StalledTaskRisk[] => {
  const nowTime = now.getTime();
  const staleAfterMs = 24 * 3_600_000;
  return state.tasks
    .filter((task) => task.primaryExecutorMemberId && task.status !== "completed" && task.status !== "split" && task.status !== "archived")
    .flatMap((task): StalledTaskRisk[] => {
      const expectedStartAt = expectedStartForTask(state, task);
      const expectedFinishAt = task.expectedFinishAt;
      const workAfterExpectedStart = expectedStartAt
        ? state.workSessions.some((session) => session.taskId === task.id && new Date(session.startedAt).getTime() >= new Date(expectedStartAt).getTime())
        : true;
      if (expectedStartAt && nowTime > new Date(expectedStartAt).getTime() && !workAfterExpectedStart) {
        return [{
          taskId: task.id,
          kind: "not_started",
          expectedStartAt,
          expectedFinishAt,
          detail: "已超过预计开始时间，但还没有工作会话。",
        }];
      }

      const latestSignalAt = latestTaskSignalAt(state, task);
      if (expectedFinishAt && nowTime > new Date(expectedFinishAt).getTime() && (task.progressPercent ?? 0) < 100) {
        return [{
          taskId: task.id,
          kind: "finish_late",
          expectedStartAt,
          expectedFinishAt,
          latestSignalAt,
          detail: "已超过预计完成时间，且进度未到 100%。",
        }];
      }

      if ((task.status === "in_progress" || state.workSessions.some((session) => session.taskId === task.id)) && latestSignalAt) {
        const latestTime = new Date(latestSignalAt).getTime();
        if (nowTime - latestTime > staleAfterMs && (task.progressPercent ?? 0) < 100) {
          return [{
            taskId: task.id,
            kind: "started_stale",
            expectedStartAt,
            expectedFinishAt,
            latestSignalAt,
            detail: "任务已经开始，但超过 24 小时没有新的执行或进展信号。",
          }];
        }
      }
      return [];
    })
    .sort((left, right) => {
      const order: Record<StalledTaskRiskKind, number> = { not_started: 0, finish_late: 1, started_stale: 2 };
      return order[left.kind] - order[right.kind] || (left.expectedFinishAt ?? left.expectedStartAt ?? "").localeCompare(right.expectedFinishAt ?? right.expectedStartAt ?? "");
    });
};
