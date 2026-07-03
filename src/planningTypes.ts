export type InterruptionType = "internal" | "external";
export type InterruptionAction = "defer" | "inbox" | "abort";
export type InsightKind = "capacity" | "estimate" | "interruption" | "reward" | "commitment" | "rhythm";
export type PlanPressureLevel = "light" | "balanced" | "overloaded";
export type ExportFormat = "json" | "csv";
export type CalendarViewMode = "week" | "month";
export type ReportRange = "7d" | "30d" | "quarter" | "year";
export type CommandAction =
  | "navigate_workspace"
  | "navigate_focus"
  | "navigate_calendar"
  | "navigate_daily"
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

export interface DailyPlan {
  id: string;
  workspaceId?: string;
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

export interface Interruption {
  id: string;
  workspaceId?: string;
  sessionId?: string;
  taskId?: string;
  type: InterruptionType;
  note: string;
  action: InterruptionAction;
  createdAt: string;
  resolvedAt?: string;
  convertedTaskId?: string;
}

export interface RewardState {
  streak: number;
  dailyGoal: number;
  badges: string[];
  focusGarden: number;
  visualProgress: number;
  lastRewardedAt?: string;
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
