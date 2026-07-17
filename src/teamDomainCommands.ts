import type { AppState, BackendConnectionState } from "./types";
import type { BusinessEntity, BusinessRow } from "./teamBusinessRows";
import { apiUrl, authHeaders, requestJson } from "./teamBackendHttp";

export type TeamDomainCommand =
  | { kind: "settings"; patch: Record<string, unknown> }
  | { kind: "create"; entity: BusinessEntity; workspaceId?: string; payload: Record<string, unknown> }
  | { kind: "patch"; entity: BusinessEntity; id: string; workspaceId?: string; patch: Record<string, unknown> }
  | { kind: "delete"; entity: BusinessEntity; id: string; workspaceId?: string }
  | {
      kind: "action";
      resource: "projects" | "tasks" | "daily-plans" | "work-sessions" | "task-templates";
      id: string;
      action: string;
      workspaceId?: string;
      payload?: Record<string, unknown>;
      idempotencyKey?: string;
    };

const resourcePathByEntity: Record<BusinessEntity, string> = {
  project: "projects",
  project_member: "project-members",
  task: "tasks",
  daily_plan: "daily-plans",
  focus_session: "focus-sessions",
  work_session: "work-sessions",
  execution_signal: "execution-signals",
  interruption: "interruptions",
  reward_state: "reward-state",
  task_template: "task-templates",
  template_instance: "template-instances",
};

const withWorkspace = (path: string, workspaceId?: string) =>
  workspaceId ? `${path}?workspace_id=${encodeURIComponent(workspaceId)}` : path;

export function normalizeIdempotencyKey(value: string) {
  if (/^[\x21-\x7e]{1,191}$/.test(value)) return value;

  let first = 0x811c9dc5;
  let second = 0x9e3779b9;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    first = Math.imul(first ^ code, 0x01000193);
    second = Math.imul(second ^ code, 0x85ebca6b);
  }
  return `tm-${(first >>> 0).toString(16).padStart(8, "0")}-${(second >>> 0).toString(16).padStart(8, "0")}`;
}

export async function submitTeamDomainCommand(
  backend: BackendConnectionState,
  token: string,
  command: TeamDomainCommand,
) {
  if (command.kind === "settings") {
    return requestJson<{ settings: Record<string, unknown> }>(apiUrl(backend.serverUrl, "/settings"), {
      method: "PATCH",
      headers: authHeaders(token),
      body: JSON.stringify(command.patch),
    });
  }
  if (command.kind === "action") {
    return requestJson<{ rows: BusinessRow[] }>(
      apiUrl(backend.serverUrl, withWorkspace(`/${command.resource}/${encodeURIComponent(command.id)}/${command.action}`, command.workspaceId)),
      {
        method: "POST",
        headers: {
          ...authHeaders(token),
          ...(command.idempotencyKey ? { "Idempotency-Key": normalizeIdempotencyKey(command.idempotencyKey) } : {}),
        },
        body: JSON.stringify({ ...command.payload, workspace_id: command.workspaceId }),
      },
    );
  }
  const resource = resourcePathByEntity[command.entity];
  if (command.kind === "create") {
    return requestJson<{ row: BusinessRow }>(apiUrl(backend.serverUrl, withWorkspace(`/${resource}`, command.workspaceId)), {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify(command.payload),
    });
  }
  const url = apiUrl(backend.serverUrl, withWorkspace(`/${resource}/${encodeURIComponent(command.id)}`, command.workspaceId));
  if (command.kind === "patch") {
    return requestJson<{ row: BusinessRow }>(url, {
      method: "PATCH",
      headers: authHeaders(token),
      body: JSON.stringify(command.patch),
    });
  }
  return requestJson<void>(url, { method: "DELETE", headers: authHeaders(token) });
}

export type RunTeamDomainCommand = (command: TeamDomainCommand) => Promise<AppState | undefined>;
