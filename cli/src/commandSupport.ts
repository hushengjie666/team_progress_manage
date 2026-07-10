import { readFileSync } from "node:fs";
import type { Command } from "commander/esm.mjs";
import type { TimeManageClient } from "./client.js";

type Entity = Record<string, unknown>;

export type CliRuntime = {
  client: () => TimeManageClient;
  output: (value: unknown) => void;
};

export const parseData = <T>(value: string): T => {
  const source = value.startsWith("@") ? readFileSync(value.slice(1), "utf8") : value;
  try {
    return JSON.parse(source) as T;
  } catch {
    throw new Error("--data must be valid JSON or @path-to-json-file.");
  }
};

export const splitList = (value?: string) =>
  value?.split(",").map((item) => item.trim()).filter(Boolean) ?? [];

export const numberValue = (value: string, label: string, min?: number, max?: number) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`${label} must be a number.`);
  if (min !== undefined && parsed < min) throw new Error(`${label} must be >= ${min}.`);
  if (max !== undefined && parsed > max) throw new Error(`${label} must be <= ${max}.`);
  return parsed;
};

export const integerValue = (value: string, label: string, min?: number, max?: number) => {
  const parsed = numberValue(value, label, min, max);
  if (!Number.isInteger(parsed)) throw new Error(`${label} must be an integer.`);
  return parsed;
};

export const enumValue = <T extends string>(value: string, label: string, allowed: readonly T[]) => {
  if (!allowed.includes(value as T)) throw new Error(`${label} must be one of: ${allowed.join(", ")}.`);
  return value as T;
};

const entityLabel = (entity: Entity) =>
  String(entity.title ?? entity.name ?? entity.email ?? entity.id ?? "result");

const formatEntity = (entity: Entity) => {
  const label = entityLabel(entity);
  const suffix = [entity.status, entity.progressPercent === undefined ? undefined : `${entity.progressPercent}%`]
    .filter((value) => value !== undefined && value !== "")
    .join(" · ");
  const id = entity.id ? ` (${entity.id})` : "";
  return `${label}${suffix ? ` — ${suffix}` : ""}${id}`;
};

export const writeResult = (write: (text: string) => void, value: unknown, json: boolean) => {
  if (json || value === null || value === undefined) {
    write(`${JSON.stringify(value ?? null, null, 2)}\n`);
    return;
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    write(`${String(value)}\n`);
    return;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      write("没有结果。\n");
      return;
    }
    for (const item of value) {
      write(`${item && typeof item === "object" ? formatEntity(item as Entity) : String(item)}\n`);
    }
    return;
  }
  const entity = value as Entity;
  if (entity.id || entity.title || entity.name || entity.email) {
    write(`${formatEntity(entity)}\n`);
    return;
  }
  write(`${JSON.stringify(value, null, 2)}\n`);
};

const uniqueEntity = (items: Entity[], ref: string, kind: string, keys: string[]) => {
  const normalized = ref.trim().toLowerCase();
  const exact = items.filter((item) => keys.some((key) => String(item[key] ?? "").toLowerCase() === normalized));
  if (exact.length === 1) return String(exact[0].id);
  const fuzzy = items.filter((item) => keys.some((key) => String(item[key] ?? "").toLowerCase().includes(normalized)));
  if (fuzzy.length === 1) return String(fuzzy[0].id);
  const matches = exact.length > 1 ? exact : fuzzy;
  if (matches.length > 1) throw new Error(`${kind} ref is ambiguous: ${ref}. Matches: ${matches.map(entityLabel).join(", ")}`);
  throw new Error(`${kind} not found: ${ref}`);
};

export const resolveProjectId = async (client: TimeManageClient, ref: string) =>
  uniqueEntity(await client.listProjects() as Entity[], ref, "Project", ["id", "name"]);

export const resolveTaskId = async (client: TimeManageClient, ref: string, projectId?: string) =>
  uniqueEntity(await client.listTasks({ projectId, status: "all", includeArchived: true, includeSplit: true }) as Entity[], ref, "Task", ["id", "title"]);

export const resolveWorkspaceId = async (client: TimeManageClient, ref: string) => {
  const result = await client.listWorkspaces() as unknown as { workspaces?: Entity[] } | Entity[];
  return uniqueEntity(Array.isArray(result) ? result : result.workspaces ?? [], ref, "Workspace", ["id", "name"]);
};

export const resolveWorkspaceMembershipId = async (client: TimeManageClient, ref: string, workspaceId?: string) => {
  const result = await client.listWorkspaces() as unknown as { memberships?: Entity[] };
  const memberships = workspaceId
    ? (result.memberships ?? []).filter((membership) => membership.workspaceId === workspaceId)
    : result.memberships ?? [];
  return uniqueEntity(memberships, ref, "Workspace membership", ["id", "name", "email"]);
};

export const resolveMemberId = async (client: TimeManageClient, ref: string, projectId?: string) =>
  uniqueEntity(await client.listMembers(projectId, true) as Entity[], ref, "Member", ["id", "name", "email"]);

export const resolveAccountId = async (client: TimeManageClient, ref: string) =>
  uniqueEntity(await client.listPlatformAccounts() as unknown as Entity[], ref, "Account", ["id", "name", "email"]);

export const resolveTemplateId = async (client: TimeManageClient, ref: string) =>
  uniqueEntity(await client.listTaskTemplates() as unknown as Entity[], ref, "Template", ["id", "name"]);

export const resolveWorkspaceInvitationId = async (client: TimeManageClient, ref: string) =>
  uniqueEntity(await client.listWorkspaceInvitations() as unknown as Entity[], ref, "Workspace invitation", ["id", "inviteeEmail", "email"]);

export const resolveProjectInvitationId = async (client: TimeManageClient, ref: string) =>
  uniqueEntity(await client.listProjectInvitations() as unknown as Entity[], ref, "Project invitation", ["id", "inviteeEmail", "email", "projectName"]);

export const addDataOption = (command: Command, description = "JSON object or @path.json") =>
  command.requiredOption("--data <json-or-file>", description);
