import { createInitialState, defaultNativeCapabilities, defaultTaskTemplates } from "./seed";
import { isTauri } from "./env";
import { currentProjectMemberForAccount } from "./memberIdentity";
import {
  attachTeamMembersToProjectMembers,
  dedupeProjectMemberBindingsWithAliases,
  dedupeTeamMembers,
  migrateTeamMembers,
  normalizeProjectMember,
} from "./storageTeamMembers";
import type {
  ActiveTimer,
  AppState,
  BlockProfile,
  DailyPlan,
  DailyReview,
  ExecutionSignal,
  ExecutionSignalType,
  Project,
  ProjectMember,
  RepeatRule,
  Settings,
  StrictCheckResult,
  StrictModeStatus,
  Task,
  TaskStage,
  TaskStatus,
  TeamMember,
  WorkSession,
  WorkSessionStatus,
} from "./types";

const STORAGE_KEY = "timemanage.app_state.v1";

type NormalizableAppState = Omit<Partial<AppState>, "projects" | "teamMembers" | "projectMembers" | "tasks" | "workSessions" | "executionSignals"> & {
  projects?: Partial<Project>[];
  teamMembers?: Partial<TeamMember>[];
  projectMembers?: Partial<ProjectMember>[];
  tasks?: Partial<Task>[];
  workSessions?: Partial<WorkSession>[];
  executionSignals?: Partial<ExecutionSignal>[];
};

const normalizeProject = (project: Partial<Project>, fallback: Project, index: number): Project => {
  const timestamp = project.updatedAt ?? project.createdAt ?? fallback.updatedAt ?? new Date().toISOString();
  const sortOrder = Number.isFinite(project.sortOrder) ? project.sortOrder : project.id === fallback.id ? fallback.sortOrder : undefined;
  return {
    id: project.id ?? (index === 0 ? fallback.id : `project_migrated_${index}`),
    name: project.name?.trim() || fallback.name,
    description: project.description ?? "",
    defaultExpectedStartHours: Math.max(1, project.defaultExpectedStartHours ?? fallback.defaultExpectedStartHours ?? 24),
    sortOrder,
    createdAt: project.createdAt ?? timestamp,
    updatedAt: timestamp,
    archivedAt: project.archivedAt,
  };
};

const clampProgress = (value?: number) => Math.max(0, Math.min(100, value ?? 0));
const allowedTaskStatuses: TaskStatus[] = ["pool", "committed", "in_progress", "pending_review", "completed", "split", "archived"];
const allowedTaskStages: TaskStage[] = ["sales", "requirements", "design", "development", "testing", "deployment", "acceptance"];

const normalizeTask = (task: Partial<Task>, index: number, projectId: string): Task => {
  const timestamp = task.updatedAt ?? task.createdAt ?? new Date().toISOString();
  const allowedRepeatRules: RepeatRule[] = ["none", "daily", "weekly", "interval", "weekdays", "monthly", "after_completion"];
  return {
    id: task.id ?? `task_migrated_${index}`,
    title: task.title ?? "未命名任务",
    notes: task.notes ?? "",
    tags: task.tags ?? [],
    projectId: task.projectId ?? projectId,
    project: task.project ?? "Inbox",
    creatorMemberId: task.creatorMemberId,
    primaryExecutorMemberId: task.primaryExecutorMemberId,
    collaboratorMemberIds: task.collaboratorMemberIds ?? [],
    expectedStartAt: task.expectedStartAt,
    expectedFinishAt: task.expectedFinishAt,
    progressPercent: clampProgress(task.progressPercent),
    progressNote: task.progressNote ?? "",
    priority: task.priority ?? "medium",
    severity: task.severity ?? "medium",
    stage: task.stage && allowedTaskStages.includes(task.stage) ? task.stage : "requirements",
    estimatePomodoros: task.estimatePomodoros ?? 1,
    status: task.status && allowedTaskStatuses.includes(task.status) ? task.status : "pool",
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
    reviewSubmittedAt: task.reviewSubmittedAt,
    reviewSubmittedByMemberId: task.reviewSubmittedByMemberId,
    reviewAcceptedAt: task.reviewAcceptedAt,
    reviewAcceptedByMemberId: task.reviewAcceptedByMemberId,
    reviewReturnedAt: task.reviewReturnedAt,
    reviewReturnedByMemberId: task.reviewReturnedByMemberId,
    reviewReturnReason: task.reviewReturnReason,
    completedAt: task.completedAt,
  };
};

const restoreSplitParentTasks = (tasks: Task[]) =>
  tasks.map((task) => {
    if (task.status !== "archived") return task;
    const hasSplitChildren = tasks.some(
      (candidate) =>
        candidate.id !== task.id &&
        candidate.projectId === task.projectId &&
        candidate.notes.includes(`由「${task.title}」拆分而来。`),
    );
    return hasSplitChildren ? { ...task, status: "split" as const } : task;
  });

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

const normalizeWorkSession = (session: Partial<WorkSession>, index: number): WorkSession | undefined => {
  if (!session.taskId || !session.focusSessionId) return undefined;
  const timestamp = session.updatedAt ?? session.createdAt ?? session.startedAt ?? new Date().toISOString();
  const allowedStatuses: WorkSessionStatus[] = ["active", "paused", "ended"];
  return {
    id: session.id ?? `work_session_migrated_${index}`,
    taskId: session.taskId,
    executorMemberId: session.executorMemberId,
    focusSessionId: session.focusSessionId,
    status: session.status && allowedStatuses.includes(session.status) ? session.status : "ended",
    startedAt: session.startedAt ?? timestamp,
    pausedAt: session.pausedAt,
    endedAt: session.endedAt,
    totalPausedSeconds: session.totalPausedSeconds ?? 0,
    createdAt: session.createdAt ?? timestamp,
    updatedAt: timestamp,
  };
};

const normalizeExecutionSignal = (signal: Partial<ExecutionSignal>, index: number): ExecutionSignal | undefined => {
  if (!signal.workSessionId || !signal.taskId) return undefined;
  const allowedTypes: ExecutionSignalType[] = ["work_started", "work_paused", "work_resumed", "work_ended"];
  const timestamp = signal.createdAt ?? new Date().toISOString();
  return {
    id: signal.id ?? `signal_migrated_${index}`,
    workSessionId: signal.workSessionId,
    taskId: signal.taskId,
    executorMemberId: signal.executorMemberId,
    type: signal.type && allowedTypes.includes(signal.type) ? signal.type : "work_started",
    createdAt: timestamp,
    payload: signal.payload,
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
    workSessionId: timer.workSessionId,
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

export const normalizeAppStatePayload = (parsed: NormalizableAppState): AppState => {
  const initial = createInitialState();
  const projects = (parsed.projects ?? initial.projects).map((project, index) => normalizeProject(project, initial.projects[0], index));
  const starterProjectId = projects[0]?.id ?? initial.projects[0].id;
  const rawProjectMembers = (parsed.projectMembers ?? initial.projectMembers).map((member, index) =>
    normalizeProjectMember(member, initial.projectMembers[0], member.projectId ?? starterProjectId, index),
  );
  const migratedTeamMembers = migrateTeamMembers(rawProjectMembers, parsed.teamMembers, initial.teamMembers[0]);
  const deduped = dedupeTeamMembers(migratedTeamMembers, rawProjectMembers, parsed.auth?.account?.id);
  const teamMembers = deduped.teamMembers;
  const dedupedProjectMembers = dedupeProjectMemberBindingsWithAliases(attachTeamMembersToProjectMembers(deduped.projectMembers, teamMembers));
  const projectMembers = dedupedProjectMembers.projectMembers;
  const currentMemberId = parsed.currentMemberId && projectMembers.some((member) => member.id === parsed.currentMemberId)
    ? parsed.currentMemberId
    : projectMembers[0]?.id;
  const tasks = restoreSplitParentTasks((parsed.tasks ?? initial.tasks).map((task, index) => {
    const taskProjectId = task.projectId && projects.some((project) => project.id === task.projectId) ? task.projectId : starterProjectId;
    return normalizeTask(task, index, taskProjectId);
  }));
  const syncToken = parsed.auth?.token ?? parsed.sync?.token;
  const normalizedSync = {
    ...initial.sync,
    ...parsed.sync,
    enabled: Boolean(syncToken) || parsed.sync?.enabled || initial.sync.enabled,
    autoSync: syncToken ? true : (parsed.sync?.autoSync ?? initial.sync.autoSync),
    token: syncToken ?? parsed.sync?.token,
    tombstones: parsed.sync?.tombstones ?? [],
    conflicts: parsed.sync?.conflicts ?? [],
    entityAliases: [
      ...deduped.teamMemberAliases.map((alias) => ({ entity: "team_member" as const, ...alias })),
      ...dedupedProjectMembers.projectMemberAliases.map((alias) => ({ entity: "project_member" as const, ...alias })),
    ],
  };
  const normalized = {
    ...initial,
    ...parsed,
    onboarding: { ...initial.onboarding, ...parsed.onboarding, completed: true },
    settings: mergeSettings(initial.settings, parsed.settings),
    auth: { ...initial.auth, ...parsed.auth },
    currentMemberId,
    projects,
    teamMembers,
    projectMembers,
    tasks,
    dailyPlans: (parsed.dailyPlans ?? initial.dailyPlans).map(normalizePlan),
    workSessions: (parsed.workSessions ?? initial.workSessions).map(normalizeWorkSession).filter((session): session is WorkSession => Boolean(session)),
    executionSignals: (parsed.executionSignals ?? initial.executionSignals).map(normalizeExecutionSignal).filter((signal): signal is ExecutionSignal => Boolean(signal)),
    rewardState: { ...initial.rewardState, ...parsed.rewardState },
    strictViolations: parsed.strictViolations ?? [],
    backupSnapshots: (parsed.backupSnapshots ?? []).map((snapshot) => ({ ...snapshot, payload: snapshot.payload })),
    taskTemplates: parsed.taskTemplates?.length ? parsed.taskTemplates : defaultTaskTemplates,
    templateInstances: parsed.templateInstances ?? [],
    nativeCapabilities: parsed.nativeCapabilities?.length ? parsed.nativeCapabilities : defaultNativeCapabilities,
    activeTimer: normalizeActiveTimer(parsed.activeTimer),
    sync: normalizedSync,
  } as AppState;
  const authenticatedMember = normalized.auth.account ? currentProjectMemberForAccount(normalized) : undefined;
  return authenticatedMember ? { ...normalized, currentMemberId: authenticatedMember.id } : normalized;
};

const mergeStoredState = (payload: string): AppState => normalizeAppStatePayload(JSON.parse(payload) as Partial<AppState>);

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
