import { applyTeamStateLoadFailure } from "./appBoot";
import { mergeBusinessRowsIntoState, type BusinessRow } from "./teamBusinessRows";
import type { AppState } from "./types";
import type { ServerAccount, ServerWorkspace, ServerWorkspaceMembership } from "./teamBackendCoreTypes";
import { apiUrl, authHeaders, requestJson, TeamHttpError } from "./teamBackendHttp";
import { mapAccount, mapWorkspace, mapWorkspaceMembership } from "./teamBackendMappers";
import { compatibilityStateForHttpError, TeamBackendCompatibilityError } from "./teamBackendCompatibility";
import type { Settings } from "./types";
import { preserveLocalUnpersistedTimer } from "./teamActiveRuntimePreservation";
import { recoverTeamActiveTimer } from "./teamActiveTimerReconciliation";

type AppBootstrapResponse = {
  account: ServerAccount;
  workspace: ServerWorkspace;
  membership: ServerWorkspaceMembership;
  workspaces: ServerWorkspace[];
  workspace_memberships: ServerWorkspaceMembership[];
  rows: BusinessRow[];
  loaded_at: string;
  settings?: Partial<Settings>;
};

export async function loadTeamData(local: AppState): Promise<AppState> {
  const token = local.auth.token ?? local.backend.token;
  if (!token) return local;
  let payload: AppBootstrapResponse;
  try {
    payload = await requestJson<AppBootstrapResponse>(apiUrl(local.backend.serverUrl, "/app/bootstrap"), {
      headers: authHeaders(token),
    });
  } catch (error) {
    if (error instanceof TeamHttpError && error.status === 404) {
      throw new TeamBackendCompatibilityError(compatibilityStateForHttpError(error));
    }
    throw error;
  }
  const merged = mergeBusinessRowsIntoState(local, payload.rows);
  const settings = { ...merged.settings, ...(payload.settings ?? {}) };
  const account = mapAccount(payload.account);
  const mergedWithAccount: AppState = {
    ...merged,
    auth: { ...merged.auth, account },
  };
  const recoveredTimer = recoverTeamActiveTimer(mergedWithAccount, settings, local, payload.loaded_at);
  const remoteState: AppState = {
    ...mergedWithAccount,
    settings,
    auth: {
      ...merged.auth,
      status: "authenticated",
      account,
      workspace: mapWorkspace(payload.workspace),
      membership: mapWorkspaceMembership(payload.membership),
      workspaces: payload.workspaces.map(mapWorkspace),
      workspaceMemberships: payload.workspace_memberships.map(mapWorkspaceMembership),
      message: "已登录",
    },
    backend: {
      ...merged.backend,
      status: "ready",
      message: "团队在线数据已加载",
      lastLoadedAt: payload.loaded_at,
      failureKind: undefined,
    },
    activeTimer: recoveredTimer,
  };
  return preserveLocalUnpersistedTimer(remoteState, local);
}

export const applyTeamBusinessFailure = (state: AppState, error: unknown) =>
  applyTeamStateLoadFailure(state, error);

export async function importTeamBusinessData(local: AppState, rows: BusinessRow[]) {
  const token = local.auth.token ?? local.backend.token;
  if (!token) throw new Error("请先登录团队后台");
  await requestJson<{ rows: BusinessRow[] }>(apiUrl(local.backend.serverUrl, "/app/import"), {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ rows }),
  });
  return loadTeamData(local);
}
