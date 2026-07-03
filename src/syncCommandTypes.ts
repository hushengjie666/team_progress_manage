import type { AppState, SyncDiagnosticResult, SyncState } from "./types";

export type SyncSetState = (updater: AppState | null | ((current: AppState | null) => AppState | null)) => void;
export type SyncUpdateState = (updater: (value: AppState) => AppState) => void;
export type SetSyncStatus = (patch: Partial<SyncState>) => void;

export type SyncCommandRuntimeOptions = {
  getState: () => AppState | null;
  getSyncPassword: () => string;
  setState: SyncSetState;
  updateState: SyncUpdateState;
  setToast: (message: string) => void;
  setSyncDiagnostic: (result: SyncDiagnosticResult | null) => void;
};

export type SyncCommandRuntime = {
  updateSyncSetting: <K extends keyof SyncState>(key: K, value: SyncState[K]) => void;
  checkSyncHealth: () => Promise<void>;
  handleSyncLogin: () => Promise<void>;
  handleSyncNow: () => Promise<void>;
  runSyncDiagnostics: () => Promise<void>;
};

export type SyncConnectionCommands = Pick<SyncCommandRuntime, "updateSyncSetting" | "checkSyncHealth" | "handleSyncLogin">;
export type SyncDataCommands = Pick<SyncCommandRuntime, "handleSyncNow" | "runSyncDiagnostics">;
