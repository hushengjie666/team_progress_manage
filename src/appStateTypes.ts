import type {
  Project,
  ProjectMember,
} from "./projectTypes";
import type {
  DailyPlan,
  Interruption,
  RewardState,
} from "./planningTypes";
import type {
  ActiveTimer,
  ExecutionSignal,
  FocusSession,
  WorkSession,
} from "./timerTypes";
import type {
  Task,
  TaskTemplate,
  TemplateInstance,
} from "./taskTypes";
import type {
  Account,
  AuthStatus,
  Workspace,
  WorkspaceMembership,
} from "./workspaceTypes";
import type {
  Settings,
} from "./appSettingsTypes";

export type SyncStatus = "idle" | "authenticating" | "syncing" | "synced" | "error";

export interface SyncServerConfig {
  addr: string;
  mysqlDsn: string;
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
  lastError?: string;
  steps: SyncDiagnosticStep[];
}

export interface SyncTombstone {
  entity: string;
  id: string;
  workspaceId?: string;
  deletedAt: string;
}

export interface SyncState {
  serverUrl: string;
  username: string;
  deviceId: string;
  token?: string;
  lastPulledRevision: number;
  lastSyncedAt?: string;
  status: SyncStatus;
  message: string;
  tombstones: SyncTombstone[];
}

export interface AuthState {
  status: AuthStatus;
  token?: string;
  expiresAt?: string;
  account?: Account;
  workspace?: Workspace;
  membership?: WorkspaceMembership;
  workspaces?: Workspace[];
  workspaceMemberships?: WorkspaceMembership[];
  bootstrapped?: boolean;
  message: string;
}

export interface AppState {
  version: number;
  settings: Settings;
  auth: AuthState;
  projects: Project[];
  projectMembers: ProjectMember[];
  tasks: Task[];
  dailyPlans: DailyPlan[];
  focusSessions: FocusSession[];
  workSessions: WorkSession[];
  executionSignals: ExecutionSignal[];
  interruptions: Interruption[];
  rewardState: RewardState;
  sync: SyncState;
  backupSnapshots: BackupSnapshot[];
  taskTemplates: TaskTemplate[];
  templateInstances: TemplateInstance[];
  activeTimer?: ActiveTimer;
  updatedAt: string;
}
