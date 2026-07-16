import { businessRowKey, businessRowsFromState, type BusinessRow } from "./teamBusinessRows";
import type { AppState } from "./types";

export type BusinessOperation =
  | { operation: "create"; row: BusinessRow }
  | {
      operation: "patch";
      workspace_id: string;
      entity: BusinessRow["entity"];
      id: string;
      expected_revision: number;
      updated_at: string;
      patch: Record<string, unknown>;
    }
  | {
      operation: "delete";
      workspace_id: string;
      entity: BusinessRow["entity"];
      id: string;
      expected_revision: number;
    };

export class MissingBusinessRowRevisionError extends Error {
  constructor(
    readonly operation: "patch" | "delete",
    readonly row: BusinessRow,
  ) {
    super(
      operation === "patch"
        ? `缺少业务数据版本，请先刷新：${row.entity}/${row.id}`
        : `缺少业务数据版本，无法删除：${row.entity}/${row.id}`,
    );
    this.name = "MissingBusinessRowRevisionError";
  }
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const mergePatchBetween = (before: unknown, after: unknown): unknown => {
  if (Object.is(before, after)) return undefined;
  if (!isObject(before) || !isObject(after)) return after;
  const patch: Record<string, unknown> = {};
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const key of keys) {
    if (!(key in after)) {
      patch[key] = null;
      continue;
    }
    const change = mergePatchBetween(before[key], after[key]);
    if (change !== undefined) patch[key] = change;
  }
  return Object.keys(patch).length ? patch : undefined;
};

export function businessOperationsBetween(before: AppState, after: AppState): BusinessOperation[] {
  const beforeRows = new Map(businessRowsFromState(before).map((row) => [businessRowKey(row), row]));
  const afterRows = new Map(businessRowsFromState(after).map((row) => [businessRowKey(row), row]));
  const revisions = before.backend.businessRowRevisions ?? {};
  const operations: BusinessOperation[] = [];

  for (const [key, row] of afterRows) {
    const current = beforeRows.get(key);
    if (!current) {
      operations.push({ operation: "create", row });
      continue;
    }
    const patch = mergePatchBetween(current.payload, row.payload);
    if (patch === undefined) continue;
    const expectedRevision = revisions[key];
    if (!expectedRevision) throw new MissingBusinessRowRevisionError("patch", row);
    operations.push({
      operation: "patch",
      workspace_id: row.workspace_id ?? "",
      entity: row.entity,
      id: row.id,
      expected_revision: expectedRevision,
      updated_at: row.updated_at,
      patch: patch as Record<string, unknown>,
    });
  }

  for (const [key, row] of beforeRows) {
    if (afterRows.has(key)) continue;
    const expectedRevision = revisions[key];
    if (!expectedRevision) throw new MissingBusinessRowRevisionError("delete", row);
    operations.push({
      operation: "delete",
      workspace_id: row.workspace_id ?? "",
      entity: row.entity,
      id: row.id,
      expected_revision: expectedRevision,
    });
  }
  return operations;
}

export function rebaseBusinessOperations(
  before: AppState,
  after: AppState,
  latest: AppState,
): BusinessOperation[] {
  const beforeRows = new Map(businessRowsFromState(before).map((row) => [businessRowKey(row), row]));
  const afterRows = new Map(businessRowsFromState(after).map((row) => [businessRowKey(row), row]));
  const latestRows = new Map(businessRowsFromState(latest).map((row) => [businessRowKey(row), row]));
  const revisions = latest.backend.businessRowRevisions ?? {};
  const operations: BusinessOperation[] = [];

  for (const [key, row] of afterRows) {
    const beforeRow = beforeRows.get(key);
    const latestRow = latestRows.get(key);
    const patch = beforeRow
      ? mergePatchBetween(beforeRow.payload, row.payload)
      : latestRow
        ? mergePatchBetween(latestRow.payload, row.payload)
        : row.payload;
    if (patch === undefined) continue;
    if (!latestRow) {
      operations.push({ operation: "create", row });
      continue;
    }
    const expectedRevision = revisions[key];
    if (!expectedRevision) throw new MissingBusinessRowRevisionError("patch", latestRow);
    operations.push({
      operation: "patch",
      workspace_id: row.workspace_id ?? "",
      entity: row.entity,
      id: row.id,
      expected_revision: expectedRevision,
      updated_at: row.updated_at,
      patch: patch as Record<string, unknown>,
    });
  }

  for (const [key, row] of beforeRows) {
    if (afterRows.has(key)) continue;
    const latestRow = latestRows.get(key);
    if (!latestRow) continue;
    const expectedRevision = revisions[key];
    if (!expectedRevision) throw new MissingBusinessRowRevisionError("delete", latestRow);
    operations.push({
      operation: "delete",
      workspace_id: row.workspace_id ?? "",
      entity: row.entity,
      id: row.id,
      expected_revision: expectedRevision,
    });
  }
  return operations;
}

export const operationsCanRebase = (operations: BusinessOperation[]) =>
  operations.every((operation) => operation.operation !== "delete");
