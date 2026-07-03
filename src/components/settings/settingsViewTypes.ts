import type {
  Account,
  ProjectMember,
  Settings,
  SyncDiagnosticResult,
  SyncState,
} from "../../types";
import type { SettingsDataSummary, SettingsSection } from "./settingsTypes";

export type SettingsViewProps = {
  projectMembers: ProjectMember[];
  accounts: Account[];
  settings: Settings;
  dailyGoal: number;
  sync: SyncState;
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
  syncPassword: string;
  setSyncPassword: (value: string) => void;
  updateSyncSetting: <K extends keyof SyncState>(key: K, value: SyncState[K]) => void;
  checkSyncHealth: () => Promise<void>;
  handleSyncLogin: () => Promise<void>;
  handleSyncNow: () => Promise<void>;
  runSyncDiagnostics: () => Promise<void>;
  syncDiagnostic: SyncDiagnosticResult | null;
  loadDemoData: () => void;
};
