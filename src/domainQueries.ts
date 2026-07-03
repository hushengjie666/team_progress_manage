import type {
  AppState,
  DailyPlan,
  DailyReview,
  FocusSession,
  Interruption,
  Task,
} from "./types";
import { currentAccountDailyPlanForDate } from "./dailyPlanScope";

export const defaultReview = (): DailyReview => ({
  mood: "normal",
  wins: "",
  blockers: "",
  interruptionPattern: "",
  tomorrowFocus: "",
});

export const planForDate = (state: AppState, date: string): DailyPlan | undefined =>
  currentAccountDailyPlanForDate(state, date);

export const completedFocusSessions = (state: AppState) =>
  state.focusSessions.filter((session) => session.mode === "focus" && session.outcome === "completed");

export const sessionsOnDate = (state: AppState, date: string) =>
  completedFocusSessions(state).filter((session) => session.startedAt.slice(0, 10) === date);

export const sessionsForTask = (state: AppState, taskId: string) =>
  completedFocusSessions(state).filter((session) => session.taskId === taskId);

export const interruptionsOnDate = (state: AppState, date: string) =>
  state.interruptions.filter((item) => item.createdAt.slice(0, 10) === date);

export const abortedSessionsOnDate = (state: AppState, date: string) =>
  state.focusSessions.filter((session) => session.outcome === "aborted" && session.startedAt.slice(0, 10) === date);

export const estimateDeltaLabel = (estimated: number, actual: number) => {
  const delta = actual - estimated;
  if (delta > 0) return `低估 ${delta} 个番茄`;
  if (delta < 0) return `高估 ${Math.abs(delta)} 个番茄`;
  return "估算准确";
};

export const dailyCompletionRate = (state: AppState, plan: DailyPlan) => {
  const total = plan.committedTaskIds
    .map((id) => state.tasks.find((task) => task.id === id))
    .filter((task): task is Task => Boolean(task))
    .reduce((sum, task) => sum + task.estimatePomodoros, 0);
  if (total === 0) return 0;
  return Math.min(100, Math.round((plan.completedPomodoros / total) * 100));
};

export const unresolvedInterruptions = (state: AppState) =>
  state.interruptions.filter((item) => !item.resolvedAt && (item.action === "inbox" || item.action === "defer"));

export const sessionInterruptionCounts = (interruptions: Interruption[], session: FocusSession) => ({
  internal: interruptions.filter((item) => item.sessionId === session.id && item.type === "internal").length,
  external: interruptions.filter((item) => item.sessionId === session.id && item.type === "external").length,
});
