import type { Request, Route } from "@playwright/test";
import type { BusinessDeletedRow, BusinessEntity, BusinessRow } from "../../../src/teamBusinessRows";
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

const mutationDelta = (
  request: Request,
  rows: BusinessRow[],
  deleted: BusinessDeletedRow[] = [],
  settings: Record<string, unknown> = {},
) => ({
  mutation_id: request.headers()["x-timemanage-mutation-id"] ?? request.headers()["idempotency-key"] ?? `mutation_${Date.now()}`,
  delta: true,
  rows,
  deleted,
  settings,
  server_time: new Date().toISOString(),
});

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
    await fulfillJson(route, mutationDelta(request, [], [], runtime.initialState.settings));
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
    await fulfillJson(route, mutationDelta(request, [row]));
    return true;
  }
  const currentEntry = [...rowsByKey.entries()].find(([, row]) => row.entity === entity && row.id === id);
  if (request.method() === "POST" && entity === "daily_plan" && ["add-task", "remove-task", "move-task"].includes(parts[2] ?? "")) {
    const timestamp = new Date().toISOString();
    const taskId = String(body.task_id ?? "");
    const action = parts[2];
    const currentPayload = currentEntry?.[1].payload as Record<string, unknown> | undefined;
    const committedTaskIds = Array.isArray(currentPayload?.committedTaskIds)
      ? [...currentPayload.committedTaskIds] as string[]
      : [];
    if (action === "add-task" && !committedTaskIds.includes(taskId)) committedTaskIds.push(taskId);
    if (action === "remove-task") {
      const index = committedTaskIds.indexOf(taskId);
      if (index >= 0) committedTaskIds.splice(index, 1);
    }
    if (action === "move-task") {
      const index = committedTaskIds.indexOf(taskId);
      const target = index + Number(body.direction ?? 0);
      if (index >= 0 && target >= 0 && target < committedTaskIds.length) {
        [committedTaskIds[index], committedTaskIds[target]] = [committedTaskIds[target], committedTaskIds[index]];
      }
    }
    const planPayload = currentPayload
      ? { ...currentPayload, committedTaskIds, updatedAt: timestamp }
      : {
          id,
          workspaceId,
          ownerAccountId: runtime.initialState.auth.account?.id,
          date: String(body.date ?? ""),
          capacityPomodoros: 8,
          committedTaskIds,
          completedPomodoros: 0,
          suggestedTaskIds: [],
          reflection: "",
          review: { mood: "normal", wins: "", blockers: "", interruptionPattern: "", tomorrowFocus: "" },
          createdAt: timestamp,
          updatedAt: timestamp,
        };
    const planRow: BusinessRow = {
      workspace_id: workspaceId,
      account_id: runtime.initialState.auth.account?.id,
      entity: "daily_plan",
      id,
      updated_at: timestamp,
      payload: planPayload as never,
    };
    if (currentEntry) rowsByKey.delete(currentEntry[0]);
    rowsByKey.set(businessRowKey(planRow), planRow);
    const changedRows: BusinessRow[] = [planRow];
    const taskEntry = [...rowsByKey.entries()].find(([, row]) => row.entity === "task" && row.id === taskId);
    if (taskEntry) {
      const taskPayload = taskEntry[1].payload as Record<string, unknown>;
      const nextStatus = action === "add-task" && taskPayload.status === "pool"
        ? "committed"
        : action === "remove-task" && taskPayload.status === "committed" ? "pool" : taskPayload.status;
      const taskRow: BusinessRow = {
        ...taskEntry[1],
        updated_at: timestamp,
        payload: { ...taskPayload, status: nextStatus, updatedAt: timestamp } as never,
      };
      rowsByKey.set(taskEntry[0], taskRow);
      changedRows.push(taskRow);
    }
    rebuildStates(runtime, [...rowsByKey.values()]);
    await fulfillJson(route, mutationDelta(request, changedRows));
    return true;
  }
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
    const changedRows: BusinessRow[] = [];
    const deleted: BusinessDeletedRow[] = [];
    for (const [key, row] of [...rowsByKey.entries()]) {
      const payload = row.payload as Record<string, unknown>;
      const belongsToProject = row.id === id && row.entity === "project"
        || payload.projectId === id
        || (typeof payload.taskId === "string" && taskIds.has(payload.taskId));
      if (!belongsToProject) continue;
      const nextPayload = row.entity === "project" ? mergePayload(payload, projectPatch) : { ...payload };
      nextPayload.workspaceId = targetWorkspace;
      const moved = { ...row, workspace_id: targetWorkspace, payload: nextPayload as never };
      deleted.push({ workspace_id: row.workspace_id, account_id: row.account_id, entity: row.entity, id: row.id });
      changedRows.push(moved);
      rowsByKey.delete(key);
      rowsByKey.set(businessRowKey(moved), moved);
    }
    rebuildStates(runtime, [...rowsByKey.values()]);
    await fulfillJson(route, mutationDelta(request, changedRows, deleted));
    return true;
  }
  if (request.method() === "DELETE") {
    rowsByKey.delete(currentKey);
    rebuildStates(runtime, [...rowsByKey.values()]);
    await fulfillJson(route, mutationDelta(request, [], [{
      workspace_id: current.workspace_id,
      account_id: current.account_id,
      entity: current.entity,
      id: current.id,
    }]));
    return true;
  }
  if (request.method() === "PATCH") {
    const payload = mergePayload(current.payload as Record<string, unknown>, body);
    const targetWorkspace = typeof payload.workspaceId === "string" ? payload.workspaceId : current.workspace_id;
    const row = { ...current, workspace_id: targetWorkspace, updated_at: new Date().toISOString(), payload: payload as never };
    rowsByKey.delete(currentKey);
    rowsByKey.set(businessRowKey(row), row);
    rebuildStates(runtime, [...rowsByKey.values()]);
    await fulfillJson(route, mutationDelta(request, [row]));
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
