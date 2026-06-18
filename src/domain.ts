import { todayKey, uid } from "./seed";
import type {
  ActiveTimer,
  AppState,
  BadgeRule,
  CoachStep,
  DailyPlan,
  DailyReview,
  FocusSession,
  FocusQuality,
  InsightItem,
  Interruption,
  InterruptionHotspot,
  NextAction,
  PlanPressure,
  RewardState,
  SessionMode,
  Task,
  TaskSuggestion,
  WorkSession,
} from "./types";

export type StalledTaskRiskKind = "not_started" | "started_stale" | "finish_late";

export interface StalledTaskRisk {
  taskId: string;
  kind: StalledTaskRiskKind;
  expectedStartAt?: string;
  expectedFinishAt?: string;
  latestSignalAt?: string;
  detail: string;
}

export type ProgressBoardSectionKind =
  | "assigned_not_started"
  | "stalled"
  | "blocked"
  | "pending_review"
  | "near_finish"
  | "normal";

export interface ProgressBoardTask {
  taskId: string;
  title: string;
  executorName?: string;
  progressPercent: number;
  progressNote?: string;
  expectedStartAt?: string;
  expectedFinishAt?: string;
  detail: string;
}

export interface ProgressBoardSection {
  kind: ProgressBoardSectionKind;
  title: string;
  tasks: ProgressBoardTask[];
}

export interface ProgressBoardActiveSession {
  workSessionId: string;
  taskId: string;
  taskTitle: string;
  executorName?: string;
  startedAt: string;
  elapsedSeconds: number;
}

export interface ProgressBoard {
  projectId: string;
  projectName: string;
  projectProgress: number;
  activeSessions: ProgressBoardActiveSession[];
  sections: ProgressBoardSection[];
}

export const defaultReview = (): DailyReview => ({
  mood: "normal",
  wins: "",
  blockers: "",
  interruptionPattern: "",
  tomorrowFocus: "",
});

export const planForDate = (state: AppState, date: string): DailyPlan | undefined =>
  state.dailyPlans.find((plan) => plan.date === date);

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

export const calculateRemaining = (timer: ActiveTimer, now = new Date()) => {
  if (!timer.isRunning || timer.pendingSettlement === "pending") return Math.max(0, timer.remaining);
  return Math.max(0, Math.ceil((new Date(timer.plannedEndAt).getTime() - now.getTime()) / 1000));
};

export const restoreTimer = (timer?: ActiveTimer, now = new Date()): ActiveTimer | undefined => {
  if (!timer) return undefined;
  if (!timer.isRunning) return timer;
  const remaining = calculateRemaining(timer, now);
  if (remaining > 0) return { ...timer, remaining };
  return { ...timer, remaining: 0, isRunning: false, pendingSettlement: "pending" };
};

export const pauseTimer = (timer: ActiveTimer, nowIso: string): ActiveTimer => ({
  ...timer,
  isRunning: false,
  pausedAt: nowIso,
  remaining: calculateRemaining(timer, new Date(nowIso)),
});

export const resumeTimer = (timer: ActiveTimer, nowIso: string): ActiveTimer => {
  const pausedAt = timer.pausedAt ? new Date(timer.pausedAt).getTime() : new Date(nowIso).getTime();
  const pausedSeconds = Math.max(0, Math.round((new Date(nowIso).getTime() - pausedAt) / 1000));
  return {
    ...timer,
    isRunning: true,
    pausedAt: undefined,
    pendingSettlement: undefined,
    totalPausedSeconds: (timer.totalPausedSeconds ?? 0) + pausedSeconds,
    plannedEndAt: new Date(new Date(nowIso).getTime() + timer.remaining * 1000).toISOString(),
  };
};

export const nextBreakMode = (state: AppState): SessionMode => {
  const focusCount = completedFocusSessions(state).length;
  return focusCount > 0 && focusCount % state.settings.longBreakEvery === 0 ? "long_break" : "short_break";
};

export const planCapacityHint = (state: AppState, date = todayKey()) => {
  const history = state.dailyPlans
    .filter((plan) => plan.date !== date)
    .slice(-7)
    .map((plan) => plan.completedPomodoros)
    .filter((value) => value > 0);
  if (!history.length) return state.rewardState.dailyGoal;
  return Math.max(1, Math.round(history.reduce((sum, value) => sum + value, 0) / history.length));
};

export const suggestedCapacity = (state: AppState, date = todayKey()) => {
  const base = planCapacityHint(state, date);
  const plan = planForDate(state, date);
  const interruptionPenalty = interruptionsOnDate(state, date).length >= 4 ? 1 : 0;
  const overloadPenalty = plan && plan.committedTaskIds.length > 0 && plan.completedPomodoros < plan.capacityPomodoros / 2 ? 1 : 0;
  return Math.max(1, base - interruptionPenalty - overloadPenalty);
};

const taskPriorityScore = (task: Task) =>
  task.priority === "urgent" ? 40 : task.priority === "high" ? 30 : task.priority === "medium" ? 20 : 10;

const dueScore = (task: Task, now = new Date()) => {
  if (!task.dueAt) return 0;
  const due = new Date(task.dueAt).getTime();
  if (Number.isNaN(due)) return 0;
  const days = Math.ceil((due - now.getTime()) / 86_400_000);
  if (days <= 0) return 28;
  if (days <= 1) return 22;
  if (days <= 3) return 14;
  if (days <= 7) return 8;
  return 2;
};

const estimateRiskScore = (task: Task) => {
  const recent = [...(task.estimateHistory ?? [])].slice(-3);
  const under = recent.filter((entry) => entry.actualPomodoros - entry.estimatedPomodoros >= 2).length;
  return under * 6 + (task.estimatePomodoros > 7 ? 10 : 0);
};

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

const memberName = (state: AppState, memberId?: string) =>
  memberId ? state.projectMembers.find((member) => member.id === memberId)?.name : undefined;

const boardTask = (state: AppState, task: Task, detail: string): ProgressBoardTask => ({
  taskId: task.id,
  title: task.title,
  executorName: memberName(state, task.primaryExecutorMemberId),
  progressPercent: task.progressPercent ?? 0,
  progressNote: task.progressNote,
  expectedStartAt: expectedStartForTask(state, task),
  expectedFinishAt: task.expectedFinishAt,
  detail,
});

const isBlockedTask = (task: Task) => /阻塞|卡住|blocked|blocker|等待/i.test(`${task.progressNote ?? ""} ${task.reviewReturnReason ?? ""}`);

const nearExpectedFinish = (task: Task, now: Date) => {
  if (!task.expectedFinishAt || (task.progressPercent ?? 0) >= 100) return false;
  const finish = new Date(task.expectedFinishAt).getTime();
  if (Number.isNaN(finish)) return false;
  const diff = finish - now.getTime();
  return diff >= 0 && diff <= 24 * 3_600_000;
};

const hasAnyWorkSession = (sessions: WorkSession[], task: Task) =>
  sessions.some((session) => session.taskId === task.id);

export const buildProgressBoard = (state: AppState, projectId: string, now = new Date()): ProgressBoard => {
  const project = state.projects.find((item) => item.id === projectId) ?? state.projects[0];
  const tasks = state.tasks.filter((task) => task.projectId === project?.id && task.status !== "archived" && task.status !== "split");
  const progressTasks = tasks.filter((task) => task.status !== "archived" && task.status !== "split");
  const totalWeight = progressTasks.reduce((sum, task) => sum + Math.max(1, task.estimatePomodoros || 1), 0);
  const weightedProgress = totalWeight
    ? Math.round(progressTasks.reduce((sum, task) => sum + (task.progressPercent ?? (task.status === "completed" ? 100 : 0)) * Math.max(1, task.estimatePomodoros || 1), 0) / totalWeight)
    : 0;
  const projectSessions = state.workSessions.filter((session) =>
    session.status === "active" && tasks.some((task) => task.id === session.taskId),
  );
  const stalledByTask = new Map(stalledTaskRisks(state, now).filter((risk) => tasks.some((task) => task.id === risk.taskId)).map((risk) => [risk.taskId, risk]));
  const assignedNotStarted = tasks
    .filter((task) => task.primaryExecutorMemberId && task.status !== "completed" && task.status !== "pending_review" && !hasAnyWorkSession(state.workSessions, task))
    .map((task) => boardTask(state, task, stalledByTask.get(task.id)?.detail ?? "已分配，但还没有工作会话。"));
  const assignedNotStartedIds = new Set(assignedNotStarted.map((task) => task.taskId));
  const stalled = tasks
    .filter((task) => stalledByTask.has(task.id) && !assignedNotStartedIds.has(task.id))
    .map((task) => boardTask(state, task, stalledByTask.get(task.id)?.detail ?? "任务出现停滞风险。"));
  const stalledIds = new Set(stalled.map((task) => task.taskId));
  const blocked = tasks
    .filter((task) => !assignedNotStartedIds.has(task.id) && !stalledIds.has(task.id) && isBlockedTask(task))
    .map((task) => boardTask(state, task, task.reviewReturnReason ? `退回原因：${task.reviewReturnReason}` : "进展说明显示任务被阻塞。"));
  const blockedIds = new Set(blocked.map((task) => task.taskId));
  const pendingReview = tasks
    .filter((task) => task.status === "pending_review" && !blockedIds.has(task.id))
    .map((task) => boardTask(state, task, "等待项目负责人验收。"));
  const pendingReviewIds = new Set(pendingReview.map((task) => task.taskId));
  const nearFinish = tasks
    .filter((task) =>
      !assignedNotStartedIds.has(task.id) &&
      !stalledIds.has(task.id) &&
      !blockedIds.has(task.id) &&
      !pendingReviewIds.has(task.id) &&
      nearExpectedFinish(task, now)
    )
    .map((task) => boardTask(state, task, "预计完成时间将在 24 小时内到达。"));
  const riskIds = new Set([...assignedNotStartedIds, ...stalledIds, ...blockedIds, ...pendingReviewIds, ...nearFinish.map((task) => task.taskId)]);
  const normal = tasks
    .filter((task) => task.status !== "completed" && !riskIds.has(task.id))
    .map((task) => boardTask(state, task, "正常推进。"));

  return {
    projectId: project?.id ?? "",
    projectName: project?.name ?? "未命名项目",
    projectProgress: weightedProgress,
    activeSessions: projectSessions.map((session) => {
      const task = tasks.find((item) => item.id === session.taskId);
      return {
        workSessionId: session.id,
        taskId: session.taskId,
        taskTitle: task?.title ?? "未知任务",
        executorName: memberName(state, session.executorMemberId),
        startedAt: session.startedAt,
        elapsedSeconds: Math.max(0, Math.round((now.getTime() - new Date(session.startedAt).getTime()) / 1000)),
      };
    }),
    sections: [
      { kind: "assigned_not_started", title: "已分配未开始", tasks: assignedNotStarted },
      { kind: "stalled", title: "停滞风险", tasks: stalled },
      { kind: "blocked", title: "阻塞任务", tasks: blocked },
      { kind: "pending_review", title: "待验收", tasks: pendingReview },
      { kind: "near_finish", title: "临近预计完成", tasks: nearFinish },
      { kind: "normal", title: "正常工作", tasks: normal },
    ],
  };
};

export const taskSuggestions = (state: AppState, date = todayKey(), limit = 5): TaskSuggestion[] => {
  const plan = planForDate(state, date);
  const committedIds = new Set(plan?.committedTaskIds ?? []);
  return [...state.tasks]
    .filter((task) => !committedIds.has(task.id) && (task.status === "pool" || task.status === "in_progress"))
    .map((task) => {
      const score = taskPriorityScore(task) + dueScore(task) + estimateRiskScore(task) - Math.max(0, task.estimatePomodoros - 3);
      const action: TaskSuggestion["action"] = task.estimatePomodoros > 7 ? "split" : score < 16 ? "defer" : "commit";
      const reasonParts = [
        task.priority === "urgent" ? "紧急" : task.priority === "high" ? "高优先级" : "",
        task.dueAt ? "临近到期" : "",
        task.estimatePomodoros > 7 ? "任务过大，建议先拆分" : "",
        estimateRiskScore(task) >= 6 ? "历史容易低估" : "",
      ].filter(Boolean);
      return {
        taskId: task.id,
        score,
        action,
        reason: reasonParts.join(" · ") || `估算 ${task.estimatePomodoros} 个番茄，适合补入今日`,
      };
    })
    .sort((left, right) => {
      const leftTask = state.tasks.find((task) => task.id === left.taskId);
      const rightTask = state.tasks.find((task) => task.id === right.taskId);
      return right.score - left.score || (leftTask?.sortOrder ?? 0) - (rightTask?.sortOrder ?? 0);
    })
    .slice(0, limit);
};

export const suggestedTasks = (state: AppState, limit = 5) =>
  taskSuggestions(state, todayKey(), limit)
    .filter((item) => item.action !== "defer")
    .map((item) => item.taskId);

export const planPressure = (state: AppState, plan: DailyPlan): PlanPressure => {
  const totalEstimate = plan.committedTaskIds
    .map((id) => state.tasks.find((task) => task.id === id))
    .filter((task): task is Task => Boolean(task))
    .reduce((sum, task) => sum + task.estimatePomodoros, 0);
  const remainingEstimate = Math.max(0, totalEstimate - plan.completedPomodoros);
  const overBy = Math.max(0, totalEstimate - plan.capacityPomodoros);
  if (overBy > 0) {
    return {
      level: "overloaded",
      label: "超载",
      detail: `工作队列超过容量 ${overBy} 个番茄，建议移出低优先级任务或拆分大任务。`,
      totalEstimate,
      remainingEstimate,
      overBy,
    };
  }
  if (totalEstimate <= Math.max(1, Math.floor(plan.capacityPomodoros * 0.65))) {
    return {
      level: "light",
      label: "轻松",
      detail: "工作队列低于建议容量，可以保留缓冲，或补入一个小任务。",
      totalEstimate,
      remainingEstimate,
      overBy,
    };
  }
  return {
    level: "balanced",
    label: "合适",
    detail: "工作队列和容量基本匹配，适合按顺序推进。",
    totalEstimate,
    remainingEstimate,
    overBy,
  };
};

export const coachSteps = (state: AppState, date = todayKey()): CoachStep[] => {
  const plan = planForDate(state, date);
  const activeTasks = state.tasks.filter((task) => task.status !== "archived" && task.status !== "split" && task.status !== "completed");
  const hasTask = activeTasks.length > 0;
  const hasCommitment = Boolean(plan?.committedTaskIds.length);
  const hasFocus = state.focusSessions.some((session) => session.mode === "focus") || state.activeTimer?.mode === "focus";
  const hasReview = Boolean(plan?.reviewedAt);
  return [
    {
      id: "create_task",
      title: "先收拢一个活动",
      detail: "用快捷添加写下今天最值得推进的一件事。",
      completed: hasTask,
      actionLabel: "去添加",
    },
    {
      id: "commit_task",
      title: "把任务加入工作队列",
      detail: "不要把任务池当成当前执行队列，只放入近期真的要推进的事。",
      completed: hasCommitment,
      actionLabel: "加入队列",
    },
    {
      id: "start_focus",
      title: "启动第一个番茄",
      detail: "选择工作队列中的第一件事，进入单任务工作会话。",
      completed: hasFocus,
      actionLabel: "开始番茄",
    },
    {
      id: "review_day",
      title: "完成日终回顾",
      detail: "用复盘把今天的中断、估算偏差和明日容量留下来。",
      completed: hasReview,
      actionLabel: "写回顾",
    },
  ];
};

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

export const focusQuality = (state: AppState, date = todayKey()): FocusQuality => {
  const completed = sessionsOnDate(state, date).length;
  const aborted = abortedSessionsOnDate(state, date).length;
  const interruptions = interruptionsOnDate(state, date).length;
  const plan = planForDate(state, date);
  const goal = Math.max(1, state.rewardState.dailyGoal);
  const goalScore = Math.min(45, Math.round((completed / goal) * 45));
  const interruptionPenalty = Math.min(30, interruptions * 5);
  const abortPenalty = Math.min(25, aborted * 8);
  const reviewBonus = plan?.reviewedAt ? 10 : 0;
  const score = Math.max(0, Math.min(100, 45 + goalScore + reviewBonus - interruptionPenalty - abortPenalty));
  const label = score >= 85 ? "高质量专注日" : score >= 65 ? "稳定推进" : score >= 45 ? "需要降噪" : "节奏偏乱";
  const detail =
    score >= 65
      ? `完成 ${completed} 个番茄，中断 ${interruptions} 次，节奏可以延续。`
      : `完成 ${completed} 个番茄，中断 ${interruptions} 次，建议明天减少承诺并提前屏蔽高频分心源。`;
  return { score, label, detail };
};

export const interruptionHotspots = (state: AppState, limit = 3): InterruptionHotspot[] => {
  const buckets = new Map<number, { count: number; internal: number; external: number }>();
  for (const item of state.interruptions) {
    const hour = new Date(item.createdAt).getHours();
    if (Number.isNaN(hour)) continue;
    const bucket = buckets.get(hour) ?? { count: 0, internal: 0, external: 0 };
    bucket.count += 1;
    bucket[item.type] += 1;
    buckets.set(hour, bucket);
  }
  return Array.from(buckets.entries())
    .map(([hour, bucket]) => ({
      hour,
      ...bucket,
      label: `${hour.toString().padStart(2, "0")}:00-${((hour + 1) % 24).toString().padStart(2, "0")}:00`,
    }))
    .sort((left, right) => right.count - left.count || left.hour - right.hour)
    .slice(0, limit);
};

export const nextActions = (state: AppState, date = todayKey()): NextAction[] => {
  const plan = planForDate(state, date);
  const actions: NextAction[] = [];
  const pressure = plan ? planPressure(state, plan) : undefined;
  const unresolved = unresolvedInterruptions(state).length;
  const quality = focusQuality(state, date);
  if (!plan?.committedTaskIds.length) {
    actions.push({
      id: "commit_today",
      title: "先确定工作队列",
      detail: "从任务池里选 1-3 个最值得推进的任务，避免任务池变成压力源。",
      actionLabel: "去工作台",
      target: "workspace",
    });
  }
  if (pressure?.level === "overloaded") {
    actions.push({
      id: "reduce_overload",
      title: "今日计划已经超载",
      detail: `减少 ${pressure.overBy} 个番茄，或先拆分最大任务。`,
      actionLabel: "调整计划",
      target: "workspace",
    });
  }
  if (unresolved > 0) {
    actions.push({
      id: "clear_inbox",
      title: "清空中断收件箱",
      detail: `还有 ${unresolved} 条中断未处理，先转任务或标记已处理。`,
      actionLabel: "处理收件箱",
      target: "workspace",
    });
  }
  if (!state.activeTimer && plan?.committedTaskIds.length) {
    actions.push({
      id: "start_focus",
      title: "启动下一颗番茄",
      detail: "承诺已经有了，现在只需要选择一件事开始。",
      actionLabel: "去专注",
      target: "focus",
    });
  }
  if (!plan?.reviewedAt && (plan?.completedPomodoros ?? 0) > 0) {
    actions.push({
      id: "review_today",
      title: "补一条日终回顾",
      detail: "把今天的中断模式和明日注意事项记下来，明天计划会更准。",
      actionLabel: "写回顾",
      target: "workspace",
    });
  }
  if (quality.score < 55) {
    actions.push({
      id: "tighten_strict",
      title: "明天提前降噪",
      detail: "今天专注质量偏低，建议把高频分心 App/网站加入软严格模式。",
      actionLabel: "去设置",
      target: "settings",
    });
  }
  return actions.slice(0, 4);
};

const dayBefore = (date: Date, offset: number) => {
  const copy = new Date(date);
  copy.setDate(copy.getDate() - offset);
  return todayKey(copy);
};

export const badgeRules = (state: AppState): BadgeRule[] => {
  const completed = completedFocusSessions(state).length;
  const reviewed = state.dailyPlans.some((plan) => Boolean(plan.reviewedAt));
  const lowInterruptionDay = state.dailyPlans.some((plan) => plan.completedPomodoros >= state.rewardState.dailyGoal && interruptionsOnDate(state, plan.date).length <= 1);
  const accurateEstimate = state.tasks.some((task) =>
    task.estimateHistory.some((entry) => Math.abs(entry.actualPomodoros - entry.estimatedPomodoros) <= 1),
  );
  const streak = computeStreak(state);
  return [
    { id: "first_focus", label: "首个番茄", earned: completed > 0 },
    { id: "streak_3", label: "连续 3 天", earned: streak >= 3 },
    { id: "streak_7", label: "连续 7 天", earned: streak >= 7 },
    { id: "streak_14", label: "连续 14 天", earned: streak >= 14 },
    { id: "low_interruption", label: "低中断日", earned: lowInterruptionDay },
    { id: "accurate_estimate", label: "估算准确日", earned: accurateEstimate },
    { id: "daily_review", label: "完成日终回顾", earned: reviewed },
  ];
};

export const computeStreak = (state: AppState, now = new Date()) => {
  let streak = 0;
  for (let offset = 0; offset < 365; offset += 1) {
    const date = dayBefore(now, offset);
    const plan = planForDate(state, date);
    if (!plan || plan.completedPomodoros < state.rewardState.dailyGoal) {
      if (offset === 0) continue;
      break;
    }
    streak += 1;
  }
  return streak;
};

export const deriveRewardState = (state: AppState, timestamp = new Date().toISOString()): RewardState => {
  const badges = new Set(state.rewardState.badges);
  for (const rule of badgeRules(state)) {
    if (rule.earned) badges.add(rule.label);
  }
  return {
    ...state.rewardState,
    streak: computeStreak(state),
    badges: Array.from(badges),
    focusGarden: completedFocusSessions(state).length,
    visualProgress: Math.min(100, completedFocusSessions(state).length * 12),
    lastRewardedAt: timestamp,
  };
};

export const generateRecurringTask = (task: Task, timestamp: string): Task | null => {
  const rule = task.repeatRule ?? "none";
  if (rule === "none") return null;
  const base = rule === "after_completion" ? timestamp : task.dueAt ?? task.completedAt ?? timestamp;
  const next = new Date(base);
  if (rule === "daily") next.setDate(next.getDate() + 1);
  if (rule === "weekly") next.setDate(next.getDate() + 7);
  if (rule === "interval") next.setDate(next.getDate() + Math.max(1, task.repeatIntervalDays ?? 1));
  if (rule === "weekdays") {
    const weekdays = task.repeatWeekdays?.length ? task.repeatWeekdays : [1, 2, 3, 4, 5];
    do {
      next.setDate(next.getDate() + 1);
    } while (!weekdays.includes(next.getDay()));
  }
  if (rule === "monthly") {
    const day = task.repeatDayOfMonth ?? next.getDate();
    next.setMonth(next.getMonth() + 1, Math.min(day, 28));
  }
  if (rule === "after_completion") next.setDate(next.getDate() + Math.max(1, task.repeatIntervalDays ?? 1));
  return {
    ...task,
    id: uid("task"),
    status: "pool",
    actualPomodoros: 0,
    estimateHistory: [],
    completedAt: undefined,
    recurrenceParentId: task.recurrenceParentId ?? task.id,
    nextRepeatAt: next.toISOString(),
    dueAt: task.dueAt ? next.toISOString() : undefined,
    reminderAt: task.reminderAt ? next.toISOString() : undefined,
    lastReminderSentAt: undefined,
    createdAt: timestamp,
    updatedAt: timestamp,
    sortOrder: Date.now(),
  };
};

export const buildInsights = (state: AppState, date = todayKey()): InsightItem[] => {
  const plan = planForDate(state, date);
  const insights: InsightItem[] = [];
  const capacity = suggestedCapacity(state, date);
  insights.push({
    id: "capacity",
    kind: "capacity",
    title: "明日容量建议",
    detail: `建议承诺 ${capacity} 个番茄，基于近 7 天完成量和今日中断修正。`,
    severity: "info",
  });

  if (plan) {
    const rate = dailyCompletionRate(state, plan);
    insights.push({
      id: "commitment",
      kind: "commitment",
      title: "工作队列完成率",
      detail: `工作队列完成度约 ${rate}%。${rate < 60 ? "明天建议减少一到两个番茄容量。" : "节奏稳定，可以维持当前容量。"}`,
      severity: rate < 60 ? "warning" : "success",
    });
  }

  const underEstimated = [...state.tasks]
    .map((task) => {
      const actual = sessionsForTask(state, task.id).length || task.actualPomodoros;
      return { task, delta: actual - task.estimatePomodoros };
    })
    .filter((item) => item.delta >= 2)
    .sort((left, right) => right.delta - left.delta)[0];
  if (underEstimated) {
    insights.push({
      id: "estimate",
      kind: "estimate",
      title: "低估任务类型",
      detail: `「${underEstimated.task.title}」${estimateDeltaLabel(underEstimated.task.estimatePomodoros, underEstimated.task.estimatePomodoros + underEstimated.delta)}，同类任务明天先拆小。`,
      severity: "warning",
    });
  }

  const interruptions = interruptionsOnDate(state, date);
  if (interruptions.length > 0) {
    const internal = interruptions.filter((item) => item.type === "internal").length;
    insights.push({
      id: "interruption",
      kind: "interruption",
      title: "中断模式",
      detail: `今日记录 ${interruptions.length} 次中断，其中内部中断 ${internal} 次。`,
      severity: interruptions.length >= 4 ? "warning" : "info",
    });
  }

  const hotspots = interruptionHotspots(state, 1);
  if (hotspots.length > 0 && hotspots[0].count >= 2) {
    insights.push({
      id: "rhythm",
      kind: "rhythm",
      title: "中断高发时段",
      detail: `${hotspots[0].label} 中断最多，共 ${hotspots[0].count} 次，建议这个时段开启更强严格模式或安排浅任务。`,
      severity: "warning",
    });
  }

  const strictCount = state.strictViolations.filter((item) => item.createdAt.slice(0, 10) === date).length;
  if (strictCount > 0) {
    insights.push({
      id: "strict",
      kind: "strict",
      title: "严格模式违规",
      detail: `今日检测到 ${strictCount} 次分心访问，建议把高频项加入锁定强度。`,
      severity: "warning",
    });
  }

  return insights;
};

export const unresolvedInterruptions = (state: AppState) =>
  state.interruptions.filter((item) => !item.resolvedAt && (item.action === "inbox" || item.action === "defer"));

export const sessionInterruptionCounts = (interruptions: Interruption[], session: FocusSession) => ({
  internal: interruptions.filter((item) => item.sessionId === session.id && item.type === "internal").length,
  external: interruptions.filter((item) => item.sessionId === session.id && item.type === "external").length,
});
