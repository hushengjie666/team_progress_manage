import { uid } from "./seed";
import { endActiveWorkSessionsForTaskInState } from "./workSessionTransitions";
import type { AppState, Task } from "./types";

const actualPomodorosForTask = (state: AppState, task: Task) =>
  state.focusSessions.filter((session) => session.taskId === task.id && session.outcome === "completed").length ||
  task.actualPomodoros ||
  0;

export function submitTaskForReviewInState(
  state: AppState,
  taskId: string,
  submitterMemberId: string | undefined,
  timestamp = new Date().toISOString(),
): AppState {
  const canSubmitForReview = (task: Task) => task.status === "committed" || task.status === "in_progress";
  const shouldEndActiveWork = state.tasks.some((task) => task.id === taskId && canSubmitForReview(task));
  const submitted = {
    ...state,
    tasks: state.tasks.map((task) =>
      task.id === taskId && canSubmitForReview(task)
        ? {
            ...task,
            status: "pending_review" as const,
            progressPercent: 100,
            actualPomodoros: actualPomodorosForTask(state, task),
            reviewSubmittedAt: timestamp,
            reviewSubmittedByMemberId: submitterMemberId,
            reviewAcceptedAt: undefined,
            reviewAcceptedByMemberId: undefined,
            reviewReturnedAt: undefined,
            reviewReturnedByMemberId: undefined,
            reviewReturnReason: undefined,
            updatedAt: timestamp,
          }
        : task,
    ),
    updatedAt: timestamp,
  };
  if (!shouldEndActiveWork) return submitted;
  return endActiveWorkSessionsForTaskInState(submitted, taskId, timestamp, {
    reason: "submitted_for_review",
    activeTimerWorkSessionId: state.activeTimer?.workSessionId,
    activeTimerTotalPausedSeconds: state.activeTimer?.totalPausedSeconds,
    clearActiveTimer: true,
  });
}

export function acceptTaskInState(
  state: AppState,
  taskId: string,
  accepterMemberId: string | undefined,
  timestamp = new Date().toISOString(),
): AppState {
  return {
    ...state,
    tasks: state.tasks.map((task) => {
      if (task.id !== taskId || task.status !== "pending_review") return task;
      const actualPomodoros = actualPomodorosForTask(state, task);
      return {
        ...task,
        status: "completed" as const,
        progressPercent: 100,
        actualPomodoros,
        reviewAcceptedAt: timestamp,
        reviewAcceptedByMemberId: accepterMemberId,
        completedAt: timestamp,
        updatedAt: timestamp,
        estimateHistory: [
          ...(task.estimateHistory ?? []),
          {
            id: uid("estimate"),
            estimatedPomodoros: task.estimatePomodoros,
            actualPomodoros,
            recordedAt: timestamp,
            source: "completion" as const,
          },
        ],
      };
    }),
    updatedAt: timestamp,
  };
}

export function returnTaskForReviewInState(
  state: AppState,
  taskId: string,
  reason: string,
  reviewerMemberId: string | undefined,
  timestamp = new Date().toISOString(),
): AppState {
  return {
    ...state,
    tasks: state.tasks.map((task) =>
      task.id === taskId && task.status === "pending_review"
        ? {
            ...task,
            status: "in_progress" as const,
            progressPercent: Math.min(task.progressPercent ?? 0, 99),
            reviewReturnedAt: timestamp,
            reviewReturnedByMemberId: reviewerMemberId,
            reviewReturnReason: reason.trim(),
            updatedAt: timestamp,
          }
        : task,
    ),
    updatedAt: timestamp,
  };
}
