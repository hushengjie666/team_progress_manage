import type { Route } from "@playwright/test";
import type { BusinessRow } from "../../../src/teamBusinessRows";
import { applyBusinessRow, rowsForRuntimeStates, rowsFromState } from "./mockTeamBackendState";
import { fulfillJson } from "./mockTeamBackendResponses";
import type { MockTeamBackendRuntime } from "./mockTeamBackendRuntime";

export const handleMockBusinessRoute = async (
  route: Route,
  url: URL,
  runtime: MockTeamBackendRuntime,
) => {
  const request = route.request();
  if (url.pathname === "/team/data" && request.method() === "GET") {
    const rows = runtime.projectInvitationAccepted && runtime.options.acceptedProjectInvitationState
      ? rowsFromState(runtime.options.acceptedProjectInvitationState)
      : rowsForRuntimeStates(runtime.workspaceStates);
    await fulfillJson(route, { rows });
    return true;
  }

  if (url.pathname === "/team/data" && request.method() === "PUT") {
    const body = request.postDataJSON() as { rows?: BusinessRow[] };
    const rows = body.rows ?? [];
    const nextWorkspaceStates: typeof runtime.workspaceStates = {};
    const workspaceIds = new Set([
      ...Object.keys(runtime.workspaceStates),
      ...rows.map((row) => row.workspace_id ?? runtime.activeWorkspaceId),
    ]);
    for (const workspaceId of workspaceIds) {
      const workspace = runtime.mockWorkspaces.find((item) => item.id === workspaceId) ?? runtime.initialState.auth.workspace;
      nextWorkspaceStates[workspaceId] = {
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
        taskTemplates: [],
        templateInstances: [],
      };
    }
    for (const row of rows) {
      const workspaceId = row.workspace_id ?? runtime.activeWorkspaceId;
      nextWorkspaceStates[workspaceId] = applyBusinessRow(nextWorkspaceStates[workspaceId], row);
    }
    runtime.workspaceStates = nextWorkspaceStates;
    await fulfillJson(route, { rows: rowsForRuntimeStates(runtime.workspaceStates) });
    return true;
  }

  return false;
};
