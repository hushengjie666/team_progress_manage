import { useState } from "react";
import type {
  Account,
  AppState,
  ImportSummary,
  ProjectInvitation,
  SyncDiagnosticResult,
  WorkspaceInvitation,
} from "./types";

export function useAppShellDataState() {
  const [state, setState] = useState<AppState | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [syncPassword, setSyncPassword] = useState("");
  const [suppressAutoLogin, setSuppressAutoLogin] = useState(false);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);
  const [syncDiagnostic, setSyncDiagnostic] = useState<SyncDiagnosticResult | null>(null);
  const [platformAccounts, setPlatformAccounts] = useState<Account[]>([]);
  const [workspaceInvitations, setWorkspaceInvitations] = useState<WorkspaceInvitation[]>([]);
  const [projectInvitations, setProjectInvitations] = useState<ProjectInvitation[]>([]);

  return {
    state,
    setState,
    loaded,
    setLoaded,
    syncPassword,
    setSyncPassword,
    suppressAutoLogin,
    setSuppressAutoLogin,
    importSummary,
    setImportSummary,
    syncDiagnostic,
    setSyncDiagnostic,
    platformAccounts,
    setPlatformAccounts,
    workspaceInvitations,
    setWorkspaceInvitations,
    projectInvitations,
    setProjectInvitations,
  };
}
