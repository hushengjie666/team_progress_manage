import type { AppState } from "./types";

const csvCell = (value: unknown) => {
  const text = value === undefined || value === null ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
};

const toCsv = (headers: string[], rows: unknown[][]) => [headers.map(csvCell).join(","), ...rows.map((row) => row.map(csvCell).join(","))].join("\n");

export const exportTasksCsv = (state: AppState) =>
  toCsv(
    ["id", "title", "project", "tags", "priority", "severity", "stage", "estimatePomodoros", "actualPomodoros", "progressPercent", "progressNote", "status", "dueAt", "repeatRule", "updatedAt"],
    state.tasks.map((task) => [
      task.id,
      task.title,
      task.project,
      task.tags.join("|"),
      task.priority,
      task.severity,
      task.stage,
      task.estimatePomodoros,
      task.actualPomodoros,
      task.progressPercent ?? 0,
      task.progressNote ?? "",
      task.status,
      task.dueAt ?? "",
      task.repeatRule ?? "none",
      task.updatedAt,
    ]),
  );

export const exportSessionsCsv = (state: AppState) =>
  toCsv(
    ["id", "taskId", "mode", "duration", "startedAt", "endedAt", "outcome", "internalInterruptions", "externalInterruptions"],
    state.focusSessions.map((session) => [
      session.id,
      session.taskId ?? "",
      session.mode,
      session.duration,
      session.startedAt,
      session.endedAt ?? "",
      session.outcome ?? "",
      session.interruptionCounts.internal,
      session.interruptionCounts.external,
    ]),
  );

export const exportInterruptionsCsv = (state: AppState) =>
  toCsv(
    ["id", "sessionId", "taskId", "type", "action", "note", "createdAt", "resolvedAt"],
    state.interruptions.map((item) => [
      item.id,
      item.sessionId ?? "",
      item.taskId ?? "",
      item.type,
      item.action,
      item.note,
      item.createdAt,
      item.resolvedAt ?? "",
    ]),
  );

export const buildCsvBundle = (state: AppState) =>
  [
    "# tasks.csv",
    exportTasksCsv(state),
    "",
    "# sessions.csv",
    exportSessionsCsv(state),
    "",
    "# interruptions.csv",
    exportInterruptionsCsv(state),
  ].join("\n");
