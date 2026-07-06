import { applyTeamStateLoadFailure } from "./appBoot";
import {
  businessRowsFromState,
  mergeBusinessRowsIntoState,
  type BusinessRow,
} from "./teamBusinessRows";
import { preserveLocalActiveRuntime } from "./teamActiveRuntimePreservation";
import type { AppState, BackendConnectionState } from "./types";
import { apiUrl, authHeaders, requestJson } from "./teamBackendHttp";

type TeamDataResponse = {
  rows: BusinessRow[];
};

export async function loadTeamData(local: AppState): Promise<AppState> {
  const token = local.auth.token ?? local.backend.token;
  if (!token) return local;
  const payload = await requestJson<TeamDataResponse>(apiUrl(local.backend.serverUrl, "/team/data"), {
    headers: authHeaders(token),
  });
  return preserveLocalActiveRuntime(mergeBusinessRowsIntoState(local, payload.rows), local);
}

export async function saveTeamDataSnapshot(backend: BackendConnectionState, token: string, state: AppState): Promise<AppState> {
  const savedAt = new Date().toISOString();
  const payload = await requestJson<TeamDataResponse>(apiUrl(backend.serverUrl, "/team/data"), {
    method: "PUT",
    headers: authHeaders(token),
    body: JSON.stringify({ rows: businessRowsFromState(state) }),
  });
  return preserveLocalActiveRuntime(mergeBusinessRowsIntoState({
    ...state,
    backend: {
      ...state.backend,
      lastSavedAt: savedAt,
    },
  }, payload.rows), state);
}

export const applyTeamBusinessFailure = (state: AppState, error: unknown) =>
  applyTeamStateLoadFailure(state, error);
