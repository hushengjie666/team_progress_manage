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

export type BackendConnectionStatus = "idle" | "authenticating" | "loading" | "saving" | "ready" | "error";

export interface BackendServerConfig {
  addr: string;
  mysqlDsn: string;
  username: string;
  password: string;
  secret: string;
}

export interface BackendDiagnosticStep {
  id: "health" | "login" | "save" | "load";
  label: string;
  ok: boolean;
  latencyMs?: number;
  detail: string;
}

export interface BackendDiagnosticResult {
  checkedAt: string;
  serverUrl: string;
  lastError?: string;
  steps: BackendDiagnosticStep[];
}

export interface BackendConnectionState {
  serverUrl: string;
  username: string;
  deviceId: string;
  token?: string;
  lastLoadedAt?: string;
  lastSavedAt?: string;
  status: BackendConnectionStatus;
  message: string;
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
  backend: BackendConnectionState;
  taskTemplates: TaskTemplate[];
  templateInstances: TemplateInstance[];
  activeTimer?: ActiveTimer;
  updatedAt: string;
}
