import { applyTeamStateLoadFailure } from "./appBoot";
import {
  mergeBusinessRowsIntoState,
  type BusinessRow,
} from "./teamBusinessRows";
import {
  businessOperationsBetween,
  MissingBusinessRowRevisionError,
  operationsCanRebase,
  rebaseBusinessOperations,
  type BusinessOperation,
} from "./teamBusinessMutations";
import { preserveLocalActiveRuntime } from "./teamActiveRuntimePreservation";
import type { AppState, BackendConnectionState } from "./types";
import { apiUrl, authHeaders, requestJson, TeamHttpError } from "./teamBackendHttp";

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

const submitTeamOperations = async (
  backend: BackendConnectionState,
  token: string,
  operations: BusinessOperation[],
) => requestJson<TeamDataResponse>(apiUrl(backend.serverUrl, "/team/data"), {
  method: "PUT",
  headers: authHeaders(token),
  body: JSON.stringify({ protocol_version: 2, operations }),
});

export async function saveTeamDataChanges(
  backend: BackendConnectionState,
  token: string,
  before: AppState,
  state: AppState,
): Promise<AppState> {
  const savedAt = new Date().toISOString();
  let operations: BusinessOperation[];
  try {
    operations = businessOperationsBetween(before, state);
  } catch (error) {
    if (!(error instanceof MissingBusinessRowRevisionError) || error.operation === "delete") throw error;
    const latest = await loadTeamData(before);
    operations = rebaseBusinessOperations(before, state, latest);
    if (!operationsCanRebase(operations)) throw error;
  }
  let payload: TeamDataResponse;
  try {
    payload = await submitTeamOperations(backend, token, operations);
  } catch (error) {
    if (!(error instanceof TeamHttpError) || error.status !== 409 || !operationsCanRebase(operations)) throw error;
    const latest = await loadTeamData(before);
    const rebased = rebaseBusinessOperations(before, state, latest);
    if (!operationsCanRebase(rebased)) throw error;
    payload = await submitTeamOperations(backend, token, rebased);
  }
  return preserveLocalActiveRuntime(mergeBusinessRowsIntoState({
    ...state,
    backend: {
      ...state.backend,
      lastSavedAt: savedAt,
    },
  }, payload.rows), state);
}

export const saveTeamDataSnapshot = (
  backend: BackendConnectionState,
  token: string,
  state: AppState,
) => saveTeamDataChanges(backend, token, state, state);

export const applyTeamBusinessFailure = (state: AppState, error: unknown) =>
  applyTeamStateLoadFailure(state, error);
