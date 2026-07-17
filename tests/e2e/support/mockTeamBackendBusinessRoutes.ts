import type { Route } from "@playwright/test";
import type { BusinessEntity, BusinessRow } from "../../../src/teamBusinessRows";
import { businessRowKey } from "../../../src/teamBusinessRows";
import { applyBusinessRow, rowsForRuntimeStates, rowsFromState } from "./mockTeamBackendState";
import { fulfillJson } from "./mockTeamBackendResponses";
import type { MockTeamBackendRuntime } from "./mockTeamBackendRuntime";

const entityByResource: Record<string, BusinessEntity> = {
  projects: "project",
  "project-members": "project_member",
  tasks: "task",
  "daily-plans": "daily_plan",
  "focus-sessions": "focus_session",
  "work-sessions": "work_session",
  "execution-signals": "execution_signal",
  interruptions: "interruption",
  "reward-state": "reward_state",
  "task-templates": "task_template",
  "template-instances": "template_instance",
};

const bootstrapPayload = (runtime: MockTeamBackendRuntime) => {
  const state = runtime.projectInvitationAccepted && runtime.options.acceptedProjectInvitationState
    ? runtime.options.acceptedProjectInvitationState
    : runtime.initialState;
  const workspace = runtime.mockWorkspaces.find((item) => item.id === runtime.activeWorkspaceId)
    ?? state.auth.workspace!;
  const account = state.auth.account!;
  const membership = runtime.mockMemberships.find((item) =>
    item.workspaceId === workspace.id && item.accountId === account.id,
  ) ?? state.auth.membership!;
  return {
    account: {
      id: account.id, workspace_id: account.workspaceId, name: account.name, email: account.email,
      created_at: account.createdAt, updated_at: account.updatedAt,
    },
    workspace: {
      id: workspace.id, name: workspace.name, type: workspace.type,
      owner_account_id: workspace.ownerAccountId, created_at: workspace.createdAt, updated_at: workspace.updatedAt,
    },
    membership: {
      id: membership.id, workspace_id: membership.workspaceId, account_id: membership.accountId,
      name: membership.name, email: membership.email, role: membership.role, status: membership.status,
      created_at: membership.createdAt, updated_at: membership.updatedAt,
    },
    workspaces: runtime.mockWorkspaces.map((item) => ({
      id: item.id, name: item.name, type: item.type, owner_account_id: item.ownerAccountId,
      created_at: item.createdAt, updated_at: item.updatedAt,
    })),
    workspace_memberships: runtime.mockMemberships.map((item) => ({
      id: item.id, workspace_id: item.workspaceId, account_id: item.accountId, name: item.name,
      email: item.email, role: item.role, status: item.status, created_at: item.createdAt, updated_at: item.updatedAt,
    })),
    rows: runtime.projectInvitationAccepted && runtime.options.acceptedProjectInvitationState
      ? rowsFromState(runtime.options.acceptedProjectInvitationState)
      : rowsForRuntimeStates(runtime.workspaceStates),
    loaded_at: new Date().toISOString(),
    settings: state.settings,
  };
};

const rebuildStates = (runtime: MockTeamBackendRuntime, rows: BusinessRow[]) => {
  const next: typeof runtime.workspaceStates = {};
  const workspaceIds = new Set([...Object.keys(runtime.workspaceStates), ...rows.map((row) => row.workspace_id ?? runtime.activeWorkspaceId)]);
  for (const workspaceId of workspaceIds) {
    const workspace = runtime.mockWorkspaces.find((item) => item.id === workspaceId) ?? runtime.initialState.auth.workspace;
    next[workspaceId] = {
      ...runtime.initialState,
      auth: { ...runtime.initialState.auth, workspace },
      projects: [], projectMembers: [], tasks: [], dailyPlans: [], focusSessions: [], workSessions: [],
      executionSignals: [], interruptions: [], taskTemplates: [], templateInstances: [],
    };
  }
  for (const row of rows) {
    const workspaceId = row.workspace_id ?? runtime.activeWorkspaceId;
    next[workspaceId] = applyBusinessRow(next[workspaceId], row);
  }
  runtime.workspaceStates = next;
};

export const handleMockBusinessRoute = async (route: Route, url: URL, runtime: MockTeamBackendRuntime) => {
  const request = route.request();
  if (url.pathname === "/app/bootstrap" && request.method() === "GET") {
    await fulfillJson(route, bootstrapPayload(runtime));
    return true;
  }
  if (url.pathname === "/settings" && request.method() === "PATCH") {
    runtime.initialState = { ...runtime.initialState, settings: { ...runtime.initialState.settings, ...request.postDataJSON() } };
    await fulfillJson(route, { settings: runtime.initialState.settings });
    return true;
  }

  const parts = url.pathname.split("/").filter(Boolean);
  const entity = entityByResource[parts[0] ?? ""];
  if (!entity) return false;
  const rowsByKey = new Map(rowsForRuntimeStates(runtime.workspaceStates).map((row) => [businessRowKey(row), row]));
  const workspaceId = url.searchParams.get("workspace_id") ?? runtime.activeWorkspaceId;
  const body = (request.postDataJSON() ?? {}) as Record<string, unknown>;
  const id = parts[1] ?? String(body.id ?? "");

  if (request.method() === "POST" && parts.length === 1) {
    const row: BusinessRow = {
      workspace_id: workspaceId, entity, id, updated_at: new Date().toISOString(), payload: body as never,
    };
    rowsByKey.set(businessRowKey(row), row);
    rebuildStates(runtime, [...rowsByKey.values()]);
    await fulfillJson(route, { row });
    return true;
  }
  const currentEntry = [...rowsByKey.entries()].find(([, row]) => row.entity === entity && row.id === id);
  if (!currentEntry) {
    await fulfillJson(route, { error: `${entity} not found` }, 404);
    return true;
  }
  const [currentKey, current] = currentEntry;
  if (request.method() === "POST" && entity === "project" && parts[2] === "move") {
    const targetWorkspace = String(body.target_workspace_id ?? "");
    const projectPatch = isObject(body.patch) ? body.patch : {};
    const taskIds = new Set([...rowsByKey.values()]
      .filter((row) => row.entity === "task" && (row.payload as { projectId?: string }).projectId === id)
      .map((row) => row.id));
    for (const [key, row] of [...rowsByKey.entries()]) {
      const payload = row.payload as Record<string, unknown>;
      const belongsToProject = row.id === id && row.entity === "project"
        || payload.projectId === id
        || (typeof payload.taskId === "string" && taskIds.has(payload.taskId));
      if (!belongsToProject) continue;
      const nextPayload = row.entity === "project" ? mergePayload(payload, projectPatch) : { ...payload };
      nextPayload.workspaceId = targetWorkspace;
      const moved = { ...row, workspace_id: targetWorkspace, payload: nextPayload as never };
      rowsByKey.delete(key);
      rowsByKey.set(businessRowKey(moved), moved);
    }
    rebuildStates(runtime, [...rowsByKey.values()]);
    await fulfillJson(route, { rows: [...rowsByKey.values()] });
    return true;
  }
  if (request.method() === "DELETE") {
    rowsByKey.delete(currentKey);
    rebuildStates(runtime, [...rowsByKey.values()]);
    await fulfillJson(route, {});
    return true;
  }
  if (request.method() === "PATCH") {
    const payload = mergePayload(current.payload as Record<string, unknown>, body);
    const targetWorkspace = typeof payload.workspaceId === "string" ? payload.workspaceId : current.workspace_id;
    const row = { ...current, workspace_id: targetWorkspace, updated_at: new Date().toISOString(), payload: payload as never };
    rowsByKey.delete(currentKey);
    rowsByKey.set(businessRowKey(row), row);
    rebuildStates(runtime, [...rowsByKey.values()]);
    await fulfillJson(route, { row });
    return true;
  }
  return false;
};

const mergePayload = (current: Record<string, unknown>, patch: Record<string, unknown>) => {
  const next = structuredClone(current);
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) delete next[key];
    else if (isObject(value) && isObject(next[key])) next[key] = mergePayload(next[key] as Record<string, unknown>, value);
    else next[key] = value;
  }
  return next;
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
