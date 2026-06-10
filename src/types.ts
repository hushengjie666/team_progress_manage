export type Priority = "low" | "medium" | "high" | "urgent";
export type Severity = "low" | "medium" | "high" | "very_high";
export type TaskStatus = "pool" | "committed" | "in_progress" | "completed" | "archived";
export type SessionMode = "focus" | "short_break" | "long_break";
export type SessionOutcome = "completed" | "aborted" | "skipped";
export type InterruptionType = "internal" | "external";
export type InterruptionAction = "defer" | "inbox" | "abort";
export type Strictness = "soft" | "balanced" | "locked";
export type PermissionState = "unknown" | "granted" | "denied" | "unavailable";
export type SyncStatus = "idle" | "offline" | "authenticating" | "syncing" | "synced" | "error";
export type RepeatRule = "none" | "daily" | "weekly" | "interval" | "weekdays" | "monthly" | "after_completion";
export type TimerEndSound = "soft" | "bell" | "digital";
export type WhiteNoise = "off" | "rain" | "brown" | "cafe";
export type SyncIntent = "local" | "self_hosted";
export type StrictModeIntent = "soft" | "balanced" | "locked";
export type TimerSettlement = "pending" | "none";
export type WorkSessionStatus = "active" | "paused" | "ended";
export type ExecutionSignalType = "work_started" | "work_paused" | "work_resumed" | "work_ended";
export type InsightKind = "capacity" | "estimate" | "interruption" | "reward" | "commitment" | "strict" | "rhythm";
export type CoachStepId = "create_task" | "commit_task" | "start_focus" | "review_day";
export type PlanPressureLevel = "light" | "balanced" | "overloaded";
export type ExportFormat = "json" | "csv";
export type CalendarViewMode = "week" | "month";
export type ReportRange = "7d" | "30d" | "quarter" | "year";
export type CommandAction =
  | "navigate_workspace"
  | "navigate_focus"
  | "navigate_calendar"
  | "navigate_reports"
  | "navigate_settings"
  | "add_quick_task"
  | "start_focus"
  | "toggle_timer"
  | "record_internal_interruption"
  | "record_external_interruption"
  | "open_task"
  | "open_sync_settings"
  | "open_shortcut_help";
export type NativePlatform = "browser" | "tauri_macos" | "ios";
export type ProjectMemberRole = "project_owner" | "executor";

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
  createdAt: string;
  completedAt?: string;
}

export interface EstimateEntry {
  id: string;
  estimatedPomodoros: number;
  actualPomodoros: number;
  recordedAt: string;
  source: "completion" | "manual";
}

export interface Task {
  id: string;
  title: string;
  notes: string;
  tags: string[];
  projectId: string;
  project: string;
  creatorMemberId?: string;
  primaryExecutorMemberId?: string;
  collaboratorMemberIds?: string[];
  expectedStartAt?: string;
  expectedFinishAt?: string;
  progressPercent?: number;
  priority: Priority;
  severity: Severity;
  estimatePomodoros: number;
  status: TaskStatus;
  dueAt?: string;
  reminderAt?: string;
  repeatRule?: RepeatRule;
  repeatIntervalDays?: number;
  repeatWeekdays?: number[];
  repeatDayOfMonth?: number;
  recurrenceParentId?: string;
  nextRepeatAt?: string;
  lastReminderSentAt?: string;
  subtasks: Subtask[];
  sortOrder: number;
  actualPomodoros: number;
  estimateHistory: EstimateEntry[];
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  defaultExpectedStartHours: number;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
}

export interface ProjectMember {
  id: string;
  projectId: string;
  name: string;
  email?: string;
  roles: ProjectMemberRole[];
  createdAt: string;
  updatedAt: string;
}

export interface DailyPlan {
  id: string;
  date: string;
  capacityPomodoros: number;
  committedTaskIds: string[];
  completedPomodoros: number;
  recommendedCapacityPomodoros?: number;
  suggestedCapacityPomodoros?: number;
  suggestedTaskIds: string[];
  overloadAcknowledged?: boolean;
  reflection: string;
  review: DailyReview;
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DailyReview {
  mood: "low" | "normal" | "good" | "great";
  wins: string;
  blockers: string;
  interruptionPattern: string;
  tomorrowFocus: string;
}

export interface FocusSession {
  id: string;
  taskId?: string;
  mode: SessionMode;
  duration: number;
  startedAt: string;
  endedAt?: string;
  outcome?: SessionOutcome;
  interruptionCounts: {
    internal: number;
    external: number;
  };
  strictProfileId?: string;
}

export interface WorkSession {
  id: string;
  taskId: string;
  executorMemberId?: string;
  focusSessionId: string;
  status: WorkSessionStatus;
  startedAt: string;
  pausedAt?: string;
  endedAt?: string;
  totalPausedSeconds: number;
  createdAt: string;
  updatedAt: string;
}

export interface ExecutionSignal {
  id: string;
  workSessionId: string;
  taskId: string;
  executorMemberId?: string;
  type: ExecutionSignalType;
  createdAt: string;
  payload?: Record<string, unknown>;
}

export interface Interruption {
  id: string;
  sessionId?: string;
  taskId?: string;
  type: InterruptionType;
  note: string;
  action: InterruptionAction;
  createdAt: string;
  resolvedAt?: string;
  convertedTaskId?: string;
}

export interface BlockProfile {
  id: string;
  name: string;
  apps: string[];
  websites: string[];
  schedule: string;
  strictness: Strictness;
  platformPermissionState: PermissionState;
  createdAt: string;
  updatedAt: string;
}

export interface RewardState {
  streak: number;
  dailyGoal: number;
  badges: string[];
  focusGarden: number;
  visualProgress: number;
  lastRewardedAt?: string;
}

export interface Settings {
  focusMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  longBreakEvery: number;
  autoStartBreaks: boolean;
  autoStartFocus: boolean;
  strictModeEnabled: boolean;
  notificationsEnabled: boolean;
  soundEnabled: boolean;
  activeBlockProfileId?: string;
  whiteNoise: WhiteNoise;
  whiteNoiseVolume: number;
  timerEndSound: TimerEndSound;
  notificationSettings: NotificationSettings;
  dismissedCoachSteps?: CoachStepId[];
  advancedSyncVisible?: boolean;
  reportFilter?: ReportFilter;
  calendarViewMode?: CalendarViewMode;
  commandPaletteHintDismissed?: boolean;
}

export interface CoachStep {
  id: CoachStepId;
  title: string;
  detail: string;
  completed: boolean;
  actionLabel: string;
}

export interface PlanPressure {
  level: PlanPressureLevel;
  label: string;
  detail: string;
  totalEstimate: number;
  remainingEstimate: number;
  overBy: number;
}

export interface TaskSuggestion {
  taskId: string;
  reason: string;
  score: number;
  action: "commit" | "split" | "defer";
}

export interface FocusQuality {
  score: number;
  label: string;
  detail: string;
}

export interface InterruptionHotspot {
  hour: number;
  count: number;
  internal: number;
  external: number;
  label: string;
}

export interface NextAction {
  id: string;
  title: string;
  detail: string;
  actionLabel: string;
  target: "workspace" | "focus" | "calendar" | "reports" | "settings";
}

export interface Onboarding {
  completed: boolean;
  distractionSources: string[];
  desiredHabit: string;
  currentDailyWasteMinutes: number;
  dailyGoalPomodoros: number;
  preferredFocusMinutes: number;
  strictModeIntent: StrictModeIntent;
  syncIntent: SyncIntent;
}

export interface NotificationSettings {
  permissionState: PermissionState;
  lastCheckedAt?: string;
}

export interface ActiveTimer {
  sessionId: string;
  taskId?: string;
  workSessionId?: string;
  mode: SessionMode;
  duration: number;
  remaining: number;
  isRunning: boolean;
  startedAt: string;
  plannedEndAt: string;
  pausedAt?: string;
  totalPausedSeconds: number;
  cycleIndex: number;
  pendingSettlement?: TimerSettlement;
  strictStarted: boolean;
}

export interface StrictCheckResult {
  platform: NativePlatform;
  appName?: string;
  url?: string;
  matched: boolean;
  matchedType?: "app" | "website";
  matchedValue?: string;
  message: string;
}

export interface StrictViolation {
  id: string;
  sessionId?: string;
  taskId?: string;
  profileId?: string;
  appName?: string;
  url?: string;
  matchedType: "app" | "website";
  matchedValue: string;
  action: "recorded" | "paused" | "aborted";
  createdAt: string;
}

export interface InsightItem {
  id: string;
  kind: InsightKind;
  title: string;
  detail: string;
  severity: "info" | "warning" | "success";
}

export interface BadgeRule {
  id: string;
  label: string;
  earned: boolean;
}

export interface SyncServerConfig {
  addr: string;
  dataPath: string;
  username: string;
  password: string;
  secret: string;
}

export interface BackupSnapshot {
  id: string;
  createdAt: string;
  reason: "manual_export" | "before_import" | "auto";
  taskCount: number;
  sessionCount: number;
  planCount: number;
  sourceVersion: number;
  payload?: string;
}

export interface ImportSummary {
  valid: boolean;
  message: string;
  taskCount: number;
  sessionCount: number;
  planCount: number;
  interruptionCount: number;
  taskDelta: number;
  sessionDelta: number;
  planDelta: number;
  version?: number;
  warnings: string[];
}

export interface SyncDiagnosticStep {
  id: "health" | "login" | "push" | "pull";
  label: string;
  ok: boolean;
  latencyMs?: number;
  detail: string;
}

export interface SyncDiagnosticResult {
  checkedAt: string;
  serverUrl: string;
  remoteRevision?: number;
  conflictCount: number;
  lastError?: string;
  steps: SyncDiagnosticStep[];
}

export interface CalendarDaySummary {
  date: string;
  committedTaskIds: string[];
  completedPomodoros: number;
  plannedPomodoros: number;
  interruptionCount: number;
  abortedPomodoros: number;
  overdueTaskIds: string[];
  reminderTaskIds: string[];
  reviewed: boolean;
  reviewedAt?: string;
  review?: DailyReview;
}

export interface TaskTemplate {
  id: string;
  name: string;
  description: string;
  project: string;
  tags: string[];
  priority: Priority;
  severity: Severity;
  estimatePomodoros: number;
  subtasks: string[];
  repeatRule?: RepeatRule;
}

export interface TemplateInstance {
  templateId: string;
  taskId: string;
  createdAt: string;
}

export interface ReportFilter {
  range: ReportRange;
  project: string;
  tag: string;
  taskId: string;
}

export interface ReviewSummary {
  rangeLabel: string;
  completedPomodoros: number;
  commitmentRate: number;
  estimateDelta: number;
  interruptionCount: number;
  topInterruptionHour?: string;
  underestimatedProjects: string[];
  capacityAdvice: string;
}

export interface ParsedQuickInput {
  title: string;
  tags: string[];
  project?: string;
  estimatePomodoros: number;
  dueAt?: string;
  priority?: Priority;
}

export interface NativeCapabilityState {
  platform: NativePlatform;
  label: string;
  available: boolean;
  permissionState: PermissionState;
  capabilities: string[];
  fallback: string;
  lastCheckedAt?: string;
}

export interface SyncTombstone {
  entity: string;
  id: string;
  deletedAt: string;
}

export interface SyncConflict {
  entity: string;
  id: string;
  localUpdatedAt?: string;
  remoteUpdatedAt: string;
  revision: number;
  remotePayload?: unknown;
}

export interface SyncState {
  enabled: boolean;
  serverUrl: string;
  username: string;
  deviceId: string;
  token?: string;
  autoSync: boolean;
  intervalSeconds: number;
  retryCount: number;
  nextRetryAt?: string;
  lastPulledRevision: number;
  lastSyncedAt?: string;
  status: SyncStatus;
  message: string;
  conflictCount: number;
  tombstones: SyncTombstone[];
  conflicts: SyncConflict[];
}

export interface AppState {
  version: number;
  onboarding: Onboarding;
  settings: Settings;
  currentMemberId?: string;
  projects: Project[];
  projectMembers: ProjectMember[];
  tasks: Task[];
  dailyPlans: DailyPlan[];
  focusSessions: FocusSession[];
  workSessions: WorkSession[];
  executionSignals: ExecutionSignal[];
  interruptions: Interruption[];
  strictViolations: StrictViolation[];
  blockProfiles: BlockProfile[];
  rewardState: RewardState;
  sync: SyncState;
  backupSnapshots: BackupSnapshot[];
  taskTemplates: TaskTemplate[];
  templateInstances: TemplateInstance[];
  nativeCapabilities: NativeCapabilityState[];
  activeTimer?: ActiveTimer;
  updatedAt: string;
}

export interface StrictModeStatus {
  active: boolean;
  platform: NativePlatform;
  permission_state: PermissionState;
  message: string;
}
