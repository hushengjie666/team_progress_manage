import { uid } from "./seed";
import { normalizeAppStatePayload } from "./storage";
import type { AppState, BackupSnapshot, ImportSummary } from "./types";

type ExportableState = Omit<AppState, "backupSnapshots"> & { backupSnapshots?: BackupSnapshot[] };

const stripBackupPayloads = (state: AppState): ExportableState => ({
  ...state,
  backupSnapshots: (state.backupSnapshots ?? []).map((snapshot) => ({ ...snapshot, payload: undefined })),
});

const csvCell = (value: unknown) => {
  const text = value === undefined || value === null ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
};

const toCsv = (headers: string[], rows: unknown[][]) => [headers.map(csvCell).join(","), ...rows.map((row) => row.map(csvCell).join(","))].join("\n");

export const createBackupSnapshot = (state: AppState, reason: BackupSnapshot["reason"], timestamp = new Date().toISOString()): BackupSnapshot => ({
  id: uid("backup"),
  createdAt: timestamp,
  reason,
  taskCount: state.tasks.length,
  sessionCount: state.focusSessions.length,
  planCount: state.dailyPlans.length,
  sourceVersion: state.version,
  payload: JSON.stringify(stripBackupPayloads(state), null, 2),
});

export const exportStateJson = (state: AppState) =>
  JSON.stringify(
    {
      ...stripBackupPayloads(state),
      exportedAt: new Date().toISOString(),
    },
    null,
    2,
  );

export const summarizeImportPayload = (payload: unknown, current?: AppState): ImportSummary => {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return {
      valid: false,
      message: "导入文件不是有效的 TimeManage JSON 对象。",
      taskCount: 0,
      sessionCount: 0,
      planCount: 0,
      interruptionCount: 0,
      taskDelta: 0,
      sessionDelta: 0,
      planDelta: 0,
      warnings: ["请选择从 TimeManage 导出的完整 JSON 文件。"],
    };
  }
  const value = payload as Partial<AppState>;
  const warnings: string[] = [];
  if (!Array.isArray(value.tasks)) warnings.push("缺少任务列表，将使用空任务列表。");
  if (!Array.isArray(value.dailyPlans)) warnings.push("缺少每日计划，将使用空计划列表。");
  if (!value.settings) warnings.push("缺少设置，将使用默认设置补齐。");
  if (!value.sync) warnings.push("缺少同步配置，将使用本机默认配置补齐。");
  const valid = Array.isArray(value.tasks) || Array.isArray(value.focusSessions) || Array.isArray(value.dailyPlans);
  return {
    valid,
    message: valid ? "文件可导入，确认前会自动下载当前数据备份。" : "文件结构不完整，无法导入。",
    taskCount: Array.isArray(value.tasks) ? value.tasks.length : 0,
    sessionCount: Array.isArray(value.focusSessions) ? value.focusSessions.length : 0,
    planCount: Array.isArray(value.dailyPlans) ? value.dailyPlans.length : 0,
    interruptionCount: Array.isArray(value.interruptions) ? value.interruptions.length : 0,
    taskDelta: (Array.isArray(value.tasks) ? value.tasks.length : 0) - (current?.tasks.length ?? 0),
    sessionDelta: (Array.isArray(value.focusSessions) ? value.focusSessions.length : 0) - (current?.focusSessions.length ?? 0),
    planDelta: (Array.isArray(value.dailyPlans) ? value.dailyPlans.length : 0) - (current?.dailyPlans.length ?? 0),
    version: typeof value.version === "number" ? value.version : undefined,
    warnings,
  };
};

export const mergeImportedState = (current: AppState, payload: unknown, backup: BackupSnapshot): AppState => {
  const summary = summarizeImportPayload(payload);
  if (!summary.valid) throw new Error(summary.message);
  const incoming = payload as Partial<ExportableState>;
  const timestamp = new Date().toISOString();
  const merged = normalizeAppStatePayload({
    ...current,
    ...incoming,
    backupSnapshots: [backup, ...(current.backupSnapshots ?? [])].slice(0, 10),
    sync: {
      ...current.sync,
      ...incoming.sync,
      status: "idle",
      message: "已从 JSON 导入本地数据，建议立即执行一次同步。",
      conflicts: incoming.sync?.conflicts ?? current.sync.conflicts ?? [],
      tombstones: incoming.sync?.tombstones ?? current.sync.tombstones ?? [],
    },
    updatedAt: timestamp,
  });
  return merged;
};

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
