import { createInitialState, defaultNativeCapabilities, defaultTaskTemplates } from "./seed";
import { isTauri } from "./env";
import type { ActiveTimer, AppState, BlockProfile, DailyPlan, DailyReview, RepeatRule, Settings, StrictCheckResult, StrictModeStatus, Task } from "./types";

const STORAGE_KEY = "timemanage.app_state.v1";

const normalizeTask = (task: Partial<Task>, index: number): Task => {
  const timestamp = task.updatedAt ?? task.createdAt ?? new Date().toISOString();
  const allowedRepeatRules: RepeatRule[] = ["none", "daily", "weekly", "interval", "weekdays", "monthly", "after_completion"];
  return {
    id: task.id ?? `task_migrated_${index}`,
    title: task.title ?? "未命名任务",
    notes: task.notes ?? "",
    tags: task.tags ?? [],
    project: task.project ?? "Inbox",
    priority: task.priority ?? "medium",
    severity: task.severity ?? "medium",
    estimatePomodoros: task.estimatePomodoros ?? 1,
    status: task.status ?? "pool",
    dueAt: task.dueAt,
    reminderAt: task.reminderAt,
    repeatRule: task.repeatRule && allowedRepeatRules.includes(task.repeatRule) ? task.repeatRule : "none",
    repeatIntervalDays: task.repeatIntervalDays,
    repeatWeekdays: task.repeatWeekdays ?? [],
    repeatDayOfMonth: task.repeatDayOfMonth,
    recurrenceParentId: task.recurrenceParentId,
    nextRepeatAt: task.nextRepeatAt,
    lastReminderSentAt: task.lastReminderSentAt,
    subtasks: task.subtasks ?? [],
    sortOrder: task.sortOrder ?? index * 10,
    actualPomodoros: task.actualPomodoros ?? 0,
    estimateHistory: task.estimateHistory ?? [],
    createdAt: task.createdAt ?? timestamp,
    updatedAt: timestamp,
    completedAt: task.completedAt,
  };
};

const normalizeReview = (review?: Partial<DailyReview>): DailyReview => ({
  mood: review?.mood ?? "normal",
  wins: review?.wins ?? "",
  blockers: review?.blockers ?? "",
  interruptionPattern: review?.interruptionPattern ?? "",
  tomorrowFocus: review?.tomorrowFocus ?? "",
});

const normalizePlan = (plan: Partial<DailyPlan>): DailyPlan => {
  const timestamp = plan.updatedAt ?? plan.createdAt ?? new Date().toISOString();
  return {
    id: plan.id ?? `plan_${plan.date ?? timestamp.slice(0, 10)}`,
    date: plan.date ?? timestamp.slice(0, 10),
    capacityPomodoros: plan.capacityPomodoros ?? 8,
    committedTaskIds: plan.committedTaskIds ?? [],
    completedPomodoros: plan.completedPomodoros ?? 0,
    recommendedCapacityPomodoros: plan.recommendedCapacityPomodoros,
    suggestedCapacityPomodoros: plan.suggestedCapacityPomodoros,
    suggestedTaskIds: plan.suggestedTaskIds ?? [],
    overloadAcknowledged: plan.overloadAcknowledged ?? false,
    reflection: plan.reflection ?? "",
    review: normalizeReview(plan.review),
    reviewedAt: plan.reviewedAt,
    createdAt: plan.createdAt ?? timestamp,
    updatedAt: timestamp,
  };
};

const mergeSettings = (initial: Settings, parsed?: Partial<Settings>): Settings => ({
  ...initial,
  ...parsed,
  dismissedCoachSteps: parsed?.dismissedCoachSteps ?? initial.dismissedCoachSteps ?? [],
  advancedSyncVisible: parsed?.advancedSyncVisible ?? initial.advancedSyncVisible ?? false,
  reportFilter: {
    range: "30d",
    project: "all",
    tag: "all",
    taskId: "all",
    ...(initial.reportFilter ?? {}),
    ...parsed?.reportFilter,
  },
  calendarViewMode: parsed?.calendarViewMode ?? initial.calendarViewMode ?? "week",
  commandPaletteHintDismissed: parsed?.commandPaletteHintDismissed ?? initial.commandPaletteHintDismissed ?? false,
  notificationSettings: {
    ...initial.notificationSettings,
    ...parsed?.notificationSettings,
  },
});

const normalizeActiveTimer = (timer?: Partial<ActiveTimer>): ActiveTimer | undefined => {
  if (!timer?.sessionId || !timer.startedAt) return undefined;
  const duration = timer.duration ?? 25 * 60;
  return {
    sessionId: timer.sessionId,
    taskId: timer.taskId,
    mode: timer.mode ?? "focus",
    duration,
    remaining: timer.remaining ?? duration,
    isRunning: timer.isRunning ?? false,
    startedAt: timer.startedAt,
    plannedEndAt: timer.plannedEndAt ?? new Date(new Date(timer.startedAt).getTime() + duration * 1000).toISOString(),
    pausedAt: timer.pausedAt,
    totalPausedSeconds: timer.totalPausedSeconds ?? 0,
    cycleIndex: timer.cycleIndex ?? 1,
    pendingSettlement: timer.pendingSettlement,
    strictStarted: timer.strictStarted ?? false,
  };
};

const mergeStoredState = (payload: string): AppState => {
  const initial = createInitialState();
  const parsed = JSON.parse(payload) as Partial<AppState>;
  return {
    ...initial,
    ...parsed,
    onboarding: { ...initial.onboarding, ...parsed.onboarding },
    settings: mergeSettings(initial.settings, parsed.settings),
    tasks: (parsed.tasks ?? initial.tasks).map(normalizeTask),
    dailyPlans: (parsed.dailyPlans ?? initial.dailyPlans).map(normalizePlan),
    rewardState: { ...initial.rewardState, ...parsed.rewardState },
    strictViolations: parsed.strictViolations ?? [],
    backupSnapshots: (parsed.backupSnapshots ?? []).map((snapshot) => ({ ...snapshot, payload: snapshot.payload })),
    taskTemplates: parsed.taskTemplates?.length ? parsed.taskTemplates : defaultTaskTemplates,
    templateInstances: parsed.templateInstances ?? [],
    nativeCapabilities: parsed.nativeCapabilities?.length ? parsed.nativeCapabilities : defaultNativeCapabilities,
    activeTimer: normalizeActiveTimer(parsed.activeTimer),
    sync: { ...initial.sync, ...parsed.sync, tombstones: parsed.sync?.tombstones ?? [], conflicts: parsed.sync?.conflicts ?? [] },
  } as AppState;
};

const readBrowserState = (): AppState => {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return createInitialState();
  try {
    return mergeStoredState(stored);
  } catch {
    return createInitialState();
  }
};

export async function loadState(): Promise<AppState> {
  if (isTauri()) {
    const { invoke } = await import("@tauri-apps/api/core");
    const payload = await invoke<string | null>("load_state");
    if (payload) return mergeStoredState(payload);
  }
  return readBrowserState();
}

export async function saveState(state: AppState): Promise<void> {
  const payload = JSON.stringify({ ...state, updatedAt: new Date().toISOString() });
  if (isTauri()) {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("save_state", { payload });
    return;
  }
  localStorage.setItem(STORAGE_KEY, payload);
}

export async function requestStrictPermissions(): Promise<StrictModeStatus> {
  if (isTauri()) {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke<StrictModeStatus>("request_strict_permissions");
  }
  return {
    active: false,
    platform: "browser",
    permission_state: "unavailable",
    message: "浏览器预览无法启用系统权限，Tauri Apple 构建会接入前台 App/URL 软检测。",
  };
}

export async function startStrictMode(profile?: BlockProfile): Promise<StrictModeStatus> {
  if (isTauri()) {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke<StrictModeStatus>("start_strict_mode", {
      profileJson: JSON.stringify(profile ?? null),
    });
  }
  return {
    active: true,
    platform: "browser",
    permission_state: "unavailable",
    message: "浏览器预览已进入软严格模式：退出会记录为失败，但不会屏蔽系统 App。",
  };
}

export async function stopStrictMode(): Promise<StrictModeStatus> {
  if (isTauri()) {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke<StrictModeStatus>("stop_strict_mode");
  }
  return {
    active: false,
    platform: "browser",
    permission_state: "unavailable",
    message: "严格模式已停止。",
  };
}

export async function checkStrictModeViolation(profile?: BlockProfile): Promise<StrictCheckResult> {
  if (isTauri()) {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke<StrictCheckResult>("check_strict_violation", {
      profileJson: JSON.stringify(profile ?? null),
    });
  }
  return {
    platform: "browser",
    matched: false,
    message: "浏览器预览无法读取前台 App 或网站，严格模式已降级为软记录。",
  };
}
