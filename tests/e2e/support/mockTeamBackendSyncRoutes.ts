import type { Route } from "@playwright/test";
import type { SyncRow } from "../../../src/sync";
import { applyRemoteChange, rowsFromState } from "./mockTeamBackendState";
import { fulfillJson } from "./mockTeamBackendResponses";
import type { MockTeamBackendRuntime } from "./mockTeamBackendRuntime";

export const handleMockSyncRoute = async (
  route: Route,
  url: URL,
  runtime: MockTeamBackendRuntime,
) => {
  const request = route.request();
  if (url.pathname === "/team/state" || url.pathname === "/team/state/all") {
    const serverState = runtime.projectInvitationAccepted && runtime.options.acceptedProjectInvitationState
      ? runtime.options.acceptedProjectInvitationState
      : runtime.workspaceStates[runtime.activeWorkspaceId] ?? runtime.initialState;
    await fulfillJson(route, { current_revision: runtime.revision, changes: rowsFromState(serverState, runtime.revision) });
    return true;
  }

  if (url.pathname === "/team/revision") {
    await fulfillJson(route, { current_revision: runtime.revision });
    return true;
  }

  if (url.pathname === "/team/changes") {
    const body = request.postDataJSON() as { changes?: SyncRow[] };
    const changesWithRevision = (body.changes ?? []).map((change) => ({ ...change, revision: ++runtime.revision, version: 1 }));
    const serverState = runtime.workspaceStates[runtime.activeWorkspaceId] ?? runtime.initialState;
    runtime.workspaceStates[runtime.activeWorkspaceId] = changesWithRevision.reduce(applyRemoteChange, serverState);
    await fulfillJson(route, { current_revision: runtime.revision });
    return true;
  }

  return false;
};
