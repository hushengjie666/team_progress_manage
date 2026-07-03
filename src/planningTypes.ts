export type InterruptionType = "internal" | "external";
export type InterruptionAction = "defer" | "inbox" | "abort";
export type PlanPressureLevel = "light" | "balanced" | "overloaded";
export type CommandAction =
  | "navigate_workspace"
  | "navigate_focus"
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
  ownerAccountId?: string;
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

export interface BadgeRule {
  id: string;
  label: string;
  earned: boolean;
}
