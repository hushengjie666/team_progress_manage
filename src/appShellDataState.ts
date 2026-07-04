import { useState } from "react";
import type {
  Account,
  AppState,
  ProjectInvitation,
  BackendDiagnosticResult,
  WorkspaceInvitation,
} from "./types";

export function useAppShellDataState() {
  const [state, setState] = useState<AppState | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [backendPassword, setBackendPassword] = useState("");
  const [suppressAutoLogin, setSuppressAutoLogin] = useState(false);
  const [backendDiagnostic, setBackendDiagnostic] = useState<BackendDiagnosticResult | null>(null);
  const [platformAccounts, setPlatformAccounts] = useState<Account[]>([]);
  const [workspaceInvitations, setWorkspaceInvitations] = useState<WorkspaceInvitation[]>([]);
  const [projectInvitations, setProjectInvitations] = useState<ProjectInvitation[]>([]);

  return {
    state,
    setState,
    loaded,
    setLoaded,
    backendPassword,
    setBackendPassword,
    suppressAutoLogin,
    setSuppressAutoLogin,
    backendDiagnostic,
    setBackendDiagnostic,
    platformAccounts,
    setPlatformAccounts,
    workspaceInvitations,
    setWorkspaceInvitations,
    projectInvitations,
    setProjectInvitations,
  };
}
