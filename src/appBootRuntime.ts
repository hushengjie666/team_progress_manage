import { applyAuthStatusFailure, applyTeamStateLoadFailure } from "./appBoot";
import { ensureTodayPlan, restoreTimerInState } from "./appModel";
import { bindAccountToMembers } from "./authModel";
import { mergeDemoDataIntoState } from "./demoData";
import { defaultBackendServerUrl } from "./seed";
import { loadState } from "./storage";
import { fetchWorkspaces, getAuthStatus } from "./teamBackend";
import { shouldUseRemoteOriginForBackend } from "./teamBackendModel";
import { loadTeamData } from "./teamBusinessApi";
import type { PersistTeamDataOptions } from "./teamStateRuntime";
import type { Account, AppState, ProjectInvitation, WorkspaceInvitation } from "./types";
import { loadWorkspaceAccountMetadata } from "./workspaceAccountRuntime";

type PersistTeamData = (
  before: AppState,
  after: AppState,
  options?: PersistTeamDataOptions,
) => Promise<AppState | undefined>;

export type AppBootResult = {
  state?: AppState;
  platformAccounts: Account[];
  workspaceInvitations: WorkspaceInvitation[];
  projectInvitations: ProjectInvitation[];
  toast?: string;
};

export type AppBootRuntimeOptions = {
  persistTeamData: PersistTeamData;
};

const shouldLoadDemoData = () => {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  const shouldLoadDemoFromQuery = params.get("demo") === "1";
  let shouldLoadDemoFromSession = false;
  try {
    shouldLoadDemoFromSession = sessionStorage.getItem("timemanage.load_demo") === "1";
    if (shouldLoadDemoFromQuery) sessionStorage.setItem("timemanage.load_demo", "1");
  } catch {
    shouldLoadDemoFromSession = false;
  }
  const shouldLoadDemo = shouldLoadDemoFromQuery || shouldLoadDemoFromSession;
  if (shouldLoadDemo) window.history.replaceState(null, "", window.location.pathname);
  return shouldLoadDemo;
};

const normalizeServerUrl = (serverUrl: string) => serverUrl.trim().replace(/\/+$/, "");

const testBackendServerUrl = () =>
  import.meta.env.VITE_WDIO_TAURI === "1" ? import.meta.env.VITE_TM_TAURI_FUNCTIONAL_BACKEND_URL : "";

const isLocalBackendUrl = (serverUrl: string) => {
  try {
    const { hostname } = new URL(serverUrl);
    return hostname === "127.0.0.1" || hostname === "localhost" || hostname === "::1";
  } catch {
    return false;
  }
};

export const shouldResetSignedOutLocalBackendUrl = (state: AppState) => {
  if (state.auth.token) return false;
  const defaultUrl = defaultBackendServerUrl();
  return isLocalBackendUrl(state.backend.serverUrl) &&
    normalizeServerUrl(state.backend.serverUrl) !== normalizeServerUrl(defaultUrl);
};

export async function loadInitialAppState({ persistTeamData }: AppBootRuntimeOptions): Promise<AppBootResult> {
  const value = await loadState();
  const shouldLoadDemo = shouldLoadDemoData();
  let next = ensureTodayPlan(restoreTimerInState(value));
  let platformAccounts: Account[] = [];
  let workspaceInvitations: WorkspaceInvitation[] = [];
  let projectInvitations: ProjectInvitation[] = [];

  if (shouldUseRemoteOriginForBackend(next.backend.serverUrl)) {
    next = {
      ...next,
      backend: {
        ...next.backend,
        serverUrl: defaultBackendServerUrl(),
      },
    };
  }

  const wdioBackendUrl = testBackendServerUrl();
  if (wdioBackendUrl) {
    next = {
      ...next,
      auth: {
        status: "signed_out",
        bootstrapped: true,
        message: "请使用管理员分配的账号登录",
      },
      backend: {
        ...next.backend,
        serverUrl: wdioBackendUrl,
        token: undefined,
        status: "idle",
        message: "请使用管理员分配的账号登录",
      },
      activeTimer: undefined,
    };
  }

  if (shouldResetSignedOutLocalBackendUrl(next)) {
    next = {
      ...next,
      backend: {
        ...next.backend,
        serverUrl: defaultBackendServerUrl(),
        status: "idle",
        message: "请使用管理员分配的账号登录",
      },
    };
  }

  try {
    const status = await getAuthStatus(next.backend.serverUrl);
    next = {
      ...next,
      auth: {
        ...next.auth,
        status: next.auth.token ? "authenticated" : "signed_out",
        bootstrapped: status.bootstrapped,
        message: "请使用管理员分配的账号登录",
      },
    };
  } catch (error) {
    next = applyAuthStatusFailure(next, error);
  }

  if (next.auth.account && next.auth.token) {
    const token = next.auth.token;
    next = bindAccountToMembers(next, { ...next.auth, status: "authenticated" });
    try {
      const workspacePayload = await fetchWorkspaces(next.backend, token);
      next = {
        ...next,
        auth: {
          ...next.auth,
          workspaces: workspacePayload.workspaces,
          workspaceMemberships: workspacePayload.memberships,
        },
      };
    } catch {
      // Cached workspace metadata is good enough for boot; team state loading is the critical path.
    }
    try {
      next = await loadTeamData(next);
    } catch (error) {
      next = applyTeamStateLoadFailure(next, error);
    }
    try {
      const metadata = await loadWorkspaceAccountMetadata(next, token);
      platformAccounts = metadata.platformAccounts;
      workspaceInvitations = metadata.workspaceInvitations;
      projectInvitations = metadata.projectInvitations;
    } catch {
      platformAccounts = [];
      workspaceInvitations = [];
      projectInvitations = [];
    }
  }

  if (shouldLoadDemo && next.auth.status === "authenticated" && next.auth.token) {
    const demoState = ensureTodayPlan(mergeDemoDataIntoState(next, next.projects[0]?.id));
    const saved = await persistTeamData(next, demoState, { applySuccessState: false, refreshAfterSave: true });
    if (!saved) {
      return { platformAccounts, workspaceInvitations, projectInvitations };
    }
    next = saved;
    try {
      sessionStorage.removeItem("timemanage.load_demo");
    } catch {
      // Demo loading remains one-shot when sessionStorage is available.
    }
    return {
      state: next,
      platformAccounts,
      workspaceInvitations,
      projectInvitations,
      toast: "已将演示数据写入团队后台",
    };
  }

  return { state: next, platformAccounts, workspaceInvitations, projectInvitations };
}
