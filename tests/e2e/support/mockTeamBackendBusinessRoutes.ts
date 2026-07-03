import type { Route } from "@playwright/test";
import type { BusinessRow } from "../../../src/teamBusinessRows";
import { applyRemoteChange, rowsForRuntimeStates, rowsFromState } from "./mockTeamBackendState";
import { fulfillJson } from "./mockTeamBackendResponses";
import type { MockTeamBackendRuntime } from "./mockTeamBackendRuntime";

export const handleMockBusinessRoute = async (
  route: Route,
  url: URL,
  runtime: MockTeamBackendRuntime,
) => {
  const request = route.request();
  if (url.pathname === "/team/business-state") {
    const rows = runtime.projectInvitationAccepted && runtime.options.acceptedProjectInvitationState
      ? rowsFromState(runtime.options.acceptedProjectInvitationState)
      : rowsForRuntimeStates(runtime.workspaceStates);
    await fulfillJson(route, { rows });
    return true;
  }

  if (url.pathname === "/team/business-changes") {
    const body = request.postDataJSON() as { changes?: BusinessRow[] };
    for (const change of body.changes ?? []) {
      const workspaceId = change.workspace_id ?? runtime.activeWorkspaceId;
      const workspace = runtime.mockWorkspaces.find((item) => item.id === workspaceId) ?? runtime.initialState.auth.workspace;
      runtime.workspaceStates[workspaceId] = applyRemoteChange(
        runtime.workspaceStates[workspaceId] ?? {
          ...runtime.initialState,
          auth: {
            ...runtime.initialState.auth,
            workspace,
          },
          projects: [],
          projectMembers: [],
          tasks: [],
          dailyPlans: [],
          focusSessions: [],
          workSessions: [],
          executionSignals: [],
          interruptions: [],
        },
        change,
      );
    }
    runtime.revision += body.changes?.length ?? 0;
    await fulfillJson(route, { rows: rowsForRuntimeStates(runtime.workspaceStates) });
    return true;
  }

  return false;
};
