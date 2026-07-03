import { applyAuthStatusFailure, applyTeamStateLoadFailure } from "./appBoot";
import { ensureTodayPlan, restoreTimerInState } from "./appModel";
import { bindAccountToMembers } from "./authModel";
import { mergeDemoDataIntoState } from "./demoData";
import { defaultSyncServerUrl } from "./seed";
import { loadState } from "./storage";
import { fetchWorkspaces, getAuthStatus } from "./sync";
import { shouldUseRemoteOriginForSync } from "./syncModel";
import { loadTeamBusinessState } from "./teamBusinessApi";
import type { PersistBusinessChangesOptions } from "./teamStateRuntime";
import type { Account, AppState, ProjectInvitation, WorkspaceInvitation } from "./types";
import { loadWorkspaceAccountMetadata } from "./workspaceAccountRuntime";

type PersistBusinessChanges = (
  before: AppState,
  after: AppState,
  options?: PersistBusinessChangesOptions,
) => Promise<AppState | undefined>;

export type AppBootResult = {
  state?: AppState;
  platformAccounts: Account[];
  workspaceInvitations: WorkspaceInvitation[];
  projectInvitations: ProjectInvitation[];
  toast?: string;
};

export type AppBootRuntimeOptions = {
  persistBusinessChanges: PersistBusinessChanges;
};

const shouldLoadDemoData = () => {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  const shouldLoadDemo = params.get("demo") === "1" || sessionStorage.getItem("timemanage.load_demo") === "1";
  if (params.get("demo") === "1") sessionStorage.setItem("timemanage.load_demo", "1");
  if (shouldLoadDemo) window.history.replaceState(null, "", window.location.pathname);
  return shouldLoadDemo;
};

export async function loadInitialAppState({ persistBusinessChanges }: AppBootRuntimeOptions): Promise<AppBootResult> {
  const value = await loadState();
  const shouldLoadDemo = shouldLoadDemoData();
  let next = ensureTodayPlan(restoreTimerInState(value));
  let platformAccounts: Account[] = [];
  let workspaceInvitations: WorkspaceInvitation[] = [];
  let projectInvitations: ProjectInvitation[] = [];

  if (shouldUseRemoteOriginForSync(next.sync.serverUrl)) {
    next = {
      ...next,
      sync: {
        ...next.sync,
        serverUrl: defaultSyncServerUrl(),
      },
    };
  }

  try {
    const status = await getAuthStatus(next.sync.serverUrl);
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
      const workspacePayload = await fetchWorkspaces(next.sync, token);
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
      next = await loadTeamBusinessState(next);
    } catch (error) {
      next = applyTeamStateLoadFailure(next, error);
    }
    const metadata = await loadWorkspaceAccountMetadata(next, token);
    platformAccounts = metadata.platformAccounts;
    workspaceInvitations = metadata.workspaceInvitations;
    projectInvitations = metadata.projectInvitations;
  }

  if (shouldLoadDemo && next.auth.status === "authenticated" && next.auth.token) {
    const demoState = ensureTodayPlan(mergeDemoDataIntoState(next, next.projects[0]?.id));
    const saved = await persistBusinessChanges(next, demoState, { applySuccessState: false, refreshAfterSave: true });
    if (!saved) {
      return { platformAccounts, workspaceInvitations, projectInvitations };
    }
    next = saved;
    sessionStorage.removeItem("timemanage.load_demo");
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
