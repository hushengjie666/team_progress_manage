import type { BusinessDeletedRow, BusinessRow } from "../../../src/teamBusinessRows";

export function deleteMockBusinessRows(rows: Map<string, BusinessRow>, currentKey: string) {
  const current = rows.get(currentKey)!;
  const deleted: BusinessDeletedRow[] = [];
  const changed: BusinessRow[] = [];
  const scoped = [...rows.entries()].filter(([, row]) => row.workspace_id === current.workspace_id);
  const payloadFor = (row: BusinessRow) => row.payload as Record<string, unknown>;
  const taskIds = new Set(current.entity === "task" ? [current.id] : current.entity === "project"
    ? scoped.filter(([, row]) => row.entity === "task" && payloadFor(row).projectId === current.id).map(([, row]) => row.id)
    : []);
  const focusIds = new Set(scoped.filter(([, row]) => row.entity === "work_session" && taskIds.has(String(payloadFor(row).taskId)))
    .map(([, row]) => String(payloadFor(row).focusSessionId)));
  for (const [key, row] of scoped) {
    const payload = payloadFor(row);
    const dependent = current.entity === "project" && (
      payload.projectId === current.id || taskIds.has(String(payload.taskId)) || row.entity === "focus_session" && focusIds.has(row.id)
    );
    if (key === currentKey || dependent) {
      rows.delete(key);
      deleted.push({ workspace_id: row.workspace_id, account_id: row.account_id, entity: row.entity, id: row.id });
    } else if (row.entity === "daily_plan" && taskIds.size > 0) {
      const patch = Object.fromEntries(["committedTaskIds", "suggestedTaskIds"].map((field) => [
        field, (Array.isArray(payload[field]) ? payload[field] as string[] : []).filter((id) => !taskIds.has(id)),
      ]));
      const next = { ...row, payload: { ...payload, ...patch } as never };
      rows.set(key, next);
      changed.push(next);
    }
  }
  return { deleted, changed };
}
