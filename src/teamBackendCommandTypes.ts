import type { AppState, BackendDiagnosticResult, BackendConnectionState } from "./types";

export type BackendSetState = (updater: AppState | null | ((current: AppState | null) => AppState | null)) => void;
export type BackendUpdateState = (updater: (value: AppState) => AppState) => void;
export type SetBackendConnectionStatus = (patch: Partial<BackendConnectionState>) => void;

export type BackendCommandRuntimeOptions = {
  getState: () => AppState | null;
  getBackendPassword: () => string;
  setState: BackendSetState;
  updateState: BackendUpdateState;
  setToast: (message: string) => void;
  setBackendDiagnostic: (result: BackendDiagnosticResult | null) => void;
};

export type BackendCommandRuntime = {
  updateBackendSetting: <K extends keyof BackendConnectionState>(key: K, value: BackendConnectionState[K]) => void;
  checkBackendHealth: () => Promise<void>;
  handleBackendLogin: () => Promise<void>;
  handleBackendRefresh: () => Promise<void>;
  runBackendDiagnostics: () => Promise<void>;
};

export type BackendConnectionCommands = Pick<BackendCommandRuntime, "updateBackendSetting" | "checkBackendHealth" | "handleBackendLogin">;
export type BackendDataCommands = Pick<BackendCommandRuntime, "handleBackendRefresh" | "runBackendDiagnostics">;
