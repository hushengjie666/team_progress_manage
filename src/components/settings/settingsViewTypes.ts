import type {
  Account,
  ProjectMember,
  Settings,
  BackendDiagnosticResult,
  BackendConnectionState,
} from "../../types";
import type { SettingsDataSummary, SettingsSection } from "./settingsTypes";

export type SettingsViewProps = {
  projectMembers: ProjectMember[];
  accounts: Account[];
  settings: Settings;
  dailyGoal: number;
  backend: BackendConnectionState;
  dataSummary: SettingsDataSummary;
  activeSection: SettingsSection;
  setActiveSection: (section: SettingsSection) => void;
  updateSettings: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  createAccount: (name: string, email: string, password?: string) => void;
  updateAccount: (account: Account) => void;
  updateAccountPassword: (account: Account, password: string) => void;
  disableAccount: (accountId: string) => void;
  canManageMembers?: boolean;
  askNotificationPermissions: () => Promise<void>;
  backendPassword: string;
  setBackendPassword: (value: string) => void;
  updateBackendSetting: <K extends keyof BackendConnectionState>(key: K, value: BackendConnectionState[K]) => void;
  checkBackendHealth: () => Promise<void>;
  handleBackendLogin: () => Promise<void>;
  handleBackendRefresh: () => Promise<void>;
  runBackendDiagnostics: () => Promise<void>;
  backendDiagnostic: BackendDiagnosticResult | null;
  loadDemoData: () => void;
};
