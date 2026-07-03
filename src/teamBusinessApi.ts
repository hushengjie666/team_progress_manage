import { applyTeamStateLoadFailure } from "./appBoot";
import {
  businessChangesBetween,
  mergeBusinessRowsIntoState,
  type BusinessRow,
} from "./teamBusinessRows";
import { preserveLocalActiveRuntime } from "./teamActiveRuntimePreservation";
import type { AppState, SyncState } from "./types";
import { apiUrl, authHeaders, requestJson } from "./syncHttp";

type BusinessStateResponse = {
  rows: BusinessRow[];
};

export async function loadTeamBusinessState(local: AppState): Promise<AppState> {
  const token = local.auth.token ?? local.sync.token;
  if (!token) return local;
  const payload = await requestJson<BusinessStateResponse>(apiUrl(local.sync.serverUrl, "/team/business-state"), {
    headers: authHeaders(token),
  });
  return preserveLocalActiveRuntime(mergeBusinessRowsIntoState(local, payload.rows), local);
}

export async function saveTeamBusinessChanges(sync: SyncState, token: string, before: AppState, after: AppState): Promise<AppState | undefined> {
  const changes = businessChangesBetween(before, after);
  if (changes.length === 0) return after;
  const payload = await requestJson<BusinessStateResponse>(apiUrl(sync.serverUrl, "/team/business-changes"), {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ changes }),
  });
  return mergeBusinessRowsIntoState(after, payload.rows);
}

export const applyTeamBusinessFailure = (state: AppState, error: unknown) =>
  applyTeamStateLoadFailure(state, error);
