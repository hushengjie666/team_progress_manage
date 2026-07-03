import type { Route } from "@playwright/test";
import {
  accountResponse,
  ownerMembershipResponse,
  workspaceResponse,
} from "./mockTeamBackendSerializers";
import { fulfillError, fulfillJson } from "./mockTeamBackendResponses";
import type { MockTeamBackendRuntime } from "./mockTeamBackendRuntime";

export const handleMockAuthRoute = async (
  route: Route,
  url: URL,
  runtime: MockTeamBackendRuntime,
) => {
  const request = route.request();
  if (url.pathname === "/auth/status") {
    await fulfillJson(route, {
      bootstrapped: true,
      workspace_id: runtime.initialState.auth.workspace?.id,
      workspace_name: runtime.initialState.auth.workspace?.name,
    });
    return true;
  }

  if (url.pathname === "/auth/switch-workspace") {
    const body = request.postDataJSON() as { workspace_id?: string };
    const workspace = runtime.mockWorkspaces.find((item) => item.id === body.workspace_id);
    if (!workspace) {
      await fulfillError(route, 403, "workspace access denied");
      return true;
    }

    runtime.activeWorkspaceId = workspace.id;
    await fulfillJson(route, {
      token: "e2e-token",
      user_id: runtime.initialState.auth.account?.id,
      expires_at: runtime.initialState.auth.expiresAt,
      account: accountResponse(runtime.initialState.auth.account, workspace.id),
      workspace: workspaceResponse(workspace),
      membership: ownerMembershipResponse(workspace, runtime.initialState.auth.account),
      workspaces: runtime.mockWorkspaces.map(workspaceResponse),
    });
    return true;
  }

  return false;
};
