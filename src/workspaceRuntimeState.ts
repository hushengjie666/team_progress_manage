import { ensureTodayPlan } from "./appModel";
import { fetchWorkspaces } from "./teamBackend";
import { loadTeamData } from "./teamBusinessApi";
import type { AppState, Workspace } from "./types";

export async function loadStateWithFreshWorkspaces(
  source: AppState,
  token: string,
  updatedWorkspace?: Workspace,
): Promise<AppState> {
  const workspacePayload = await fetchWorkspaces(source.backend, token);
  const nextWithWorkspaces = {
    ...source,
    auth: {
      ...source.auth,
      workspace:
        updatedWorkspace && source.auth.workspace?.id === updatedWorkspace.id
          ? updatedWorkspace
          : source.auth.workspace,
      workspaces: workspacePayload.workspaces,
      workspaceMemberships: workspacePayload.memberships,
    },
  };
  return ensureTodayPlan(await loadTeamData(nextWithWorkspaces));
}
