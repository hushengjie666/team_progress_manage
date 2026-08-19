import type { AppState, BackendConnectionState } from "./types";
import type { BusinessDeletedRow, BusinessEntity, BusinessRow } from "./teamBusinessRows";
import { apiUrl, authHeaders, requestJson } from "./teamBackendHttp";

export type TeamDomainCommand =
  | { kind: "settings"; patch: Record<string, unknown> }
  | { kind: "create"; entity: BusinessEntity; workspaceId?: string; payload: Record<string, unknown>; idempotencyKey?: string }
  | { kind: "patch"; entity: BusinessEntity; id: string; workspaceId?: string; patch: Record<string, unknown>; idempotencyKey?: string }
  | { kind: "delete"; entity: BusinessEntity; id: string; workspaceId?: string; idempotencyKey?: string }
  | {
      kind: "action";
      resource: "projects" | "tasks" | "daily-plans" | "work-sessions" | "task-templates";
      id: string;
      action: string;
      workspaceId?: string;
      payload?: Record<string, unknown>;
      idempotencyKey?: string;
    };

export type TeamDomainCommandResult = {
	mutation_id: string;
	delta: true;
	rows: BusinessRow[];
	deleted: BusinessDeletedRow[];
	settings: Record<string, unknown>;
	server_time: string;
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

let mutationSequence = 0;

const commandMutationKey = (command: TeamDomainCommand) => normalizeIdempotencyKey(
	command.kind !== "settings" && command.idempotencyKey
		? command.idempotencyKey
		: `mutation:${Date.now()}:${mutationSequence += 1}:${Math.random().toString(36).slice(2)}`,
);

const requireDeltaResponse = (value: TeamDomainCommandResult | undefined): TeamDomainCommandResult => {
	if (!value || value.delta !== true || !Array.isArray(value.rows) || !Array.isArray(value.deleted)) {
		throw new Error("团队后台写入协议不匹配，请确认后台已升级到 API 2");
	}
	return {
		...value,
		settings: value.settings ?? {},
	};
};

export async function submitTeamDomainCommand(
  backend: BackendConnectionState,
  token: string,
  command: TeamDomainCommand,
): Promise<TeamDomainCommandResult> {
	const mutationKey = commandMutationKey(command);
	const mutationHeaders = {
		...authHeaders(token),
		"Idempotency-Key": mutationKey,
		"X-TimeManage-Mutation-ID": mutationKey,
	};
	if (command.kind === "settings") {
		return requireDeltaResponse(await requestJson<TeamDomainCommandResult>(apiUrl(backend.serverUrl, "/settings"), {
			method: "PATCH",
			headers: mutationHeaders,
			body: JSON.stringify(command.patch),
		}));
	}
	if (command.kind === "action") {
		return requireDeltaResponse(await requestJson<TeamDomainCommandResult>(
			apiUrl(backend.serverUrl, withWorkspace(`/${command.resource}/${encodeURIComponent(command.id)}/${command.action}`, command.workspaceId)),
			{
				method: "POST",
				headers: mutationHeaders,
				body: JSON.stringify({ ...command.payload, workspace_id: command.workspaceId, mutation_id: mutationKey }),
			},
		));
	}
  const resource = resourcePathByEntity[command.entity];
  if (command.kind === "create") {
		return requireDeltaResponse(await requestJson<TeamDomainCommandResult>(apiUrl(backend.serverUrl, withWorkspace(`/${resource}`, command.workspaceId)), {
			method: "POST",
			headers: mutationHeaders,
			body: JSON.stringify(command.payload),
		}));
  }
  const url = apiUrl(backend.serverUrl, withWorkspace(`/${resource}/${encodeURIComponent(command.id)}`, command.workspaceId));
  if (command.kind === "patch") {
		return requireDeltaResponse(await requestJson<TeamDomainCommandResult>(url, {
			method: "PATCH",
			headers: mutationHeaders,
			body: JSON.stringify(command.patch),
		}));
	}
	return requireDeltaResponse(await requestJson<TeamDomainCommandResult>(url, {
		method: "DELETE",
		headers: mutationHeaders,
	}));
}

export type TeamMutationBehavior = {
	resourceKey: string;
	optimistic?: (state: AppState) => {
		next: AppState;
		rollback: (current: AppState) => AppState;
	};
	pendingMode: "background" | "blocking";
};

export type RunTeamDomainCommand = (
	command: TeamDomainCommand,
	behavior?: TeamMutationBehavior,
) => Promise<AppState | undefined>;
