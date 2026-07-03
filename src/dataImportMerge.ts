import { normalizeAppStatePayload } from "./storage";
import type { AppState, BackupSnapshot, ImportSummary } from "./types";
import type { ExportableState } from "./dataBackupExport";

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
  if (summary.version !== current.version) {
    throw new Error("导入文件版本不兼容，请使用当前版本导出的 JSON。");
  }
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
      message: "已从 JSON 导入数据，请同步到团队后台确认保存。",
      tombstones: incoming.sync?.tombstones ?? current.sync.tombstones ?? [],
    },
    updatedAt: timestamp,
  });
  return merged;
};
