import type { Route } from "@playwright/test";
import type { BusinessRow } from "../../../src/teamBusinessRows";
import { businessRowKey } from "../../../src/teamBusinessRows";
import type { BusinessOperation } from "../../../src/teamBusinessMutations";
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
    const body = request.postDataJSON() as { protocol_version?: number; operations?: BusinessOperation[] };
    if (body.protocol_version !== 2) {
      await fulfillJson(route, { error: "client write protocol must be upgraded" }, 426);
      return true;
    }
    const rowsByKey = new Map(rowsForRuntimeStates(runtime.workspaceStates).map((row) => [businessRowKey(row), row]));
    for (const operation of body.operations ?? []) {
      if (operation.operation === "create") {
        rowsByKey.set(businessRowKey(operation.row), { ...operation.row, revision: 1 });
        continue;
      }
      const key = businessRowKey({ workspace_id: operation.workspace_id, entity: operation.entity, id: operation.id });
      if (operation.operation === "delete") {
        rowsByKey.delete(key);
        continue;
      }
      const current = rowsByKey.get(key);
      if (!current) continue;
      rowsByKey.set(key, {
        ...current,
        updated_at: operation.updated_at,
        revision: (current.revision ?? 1) + 1,
        payload: mergePayload(current.payload as Record<string, unknown>, operation.patch),
      } as BusinessRow);
    }
    const rows = [...rowsByKey.values()];
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

const mergePayload = (current: Record<string, unknown>, patch: Record<string, unknown>) => {
  const next = structuredClone(current);
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) {
      delete next[key];
      continue;
    }
    if (isObject(value) && isObject(next[key])) {
      next[key] = mergePayload(next[key] as Record<string, unknown>, value);
      continue;
    }
    next[key] = value;
  }
  return next;
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
