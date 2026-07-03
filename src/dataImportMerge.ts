import { isCurrentAppStatePayload, parseCurrentAppStatePayload } from "./storage";
import type { AppState, BackupSnapshot, ImportSummary } from "./types";

export const summarizeImportPayload = (payload: unknown, current?: AppState): ImportSummary => {
  if (!isCurrentAppStatePayload(payload)) {
    const version = payload && typeof payload === "object" && !Array.isArray(payload)
      ? (payload as Partial<AppState>).version
      : undefined;
    return {
      valid: false,
      message: "导入文件不是当前版本的完整 TimeManage JSON。",
      taskCount: 0,
      sessionCount: 0,
      planCount: 0,
      interruptionCount: 0,
      taskDelta: 0,
      sessionDelta: 0,
      planDelta: 0,
      version: typeof version === "number" ? version : undefined,
      warnings: ["请选择当前版本导出的完整 JSON 文件。"],
    };
  }

  return {
    valid: true,
    message: "文件可导入，确认前会自动下载当前数据备份。",
    taskCount: payload.tasks.length,
    sessionCount: payload.focusSessions.length,
    planCount: payload.dailyPlans.length,
    interruptionCount: payload.interruptions.length,
    taskDelta: payload.tasks.length - (current?.tasks.length ?? 0),
    sessionDelta: payload.focusSessions.length - (current?.focusSessions.length ?? 0),
    planDelta: payload.dailyPlans.length - (current?.dailyPlans.length ?? 0),
    version: payload.version,
    warnings: [],
  };
};

export const mergeImportedState = (current: AppState, payload: unknown, backup: BackupSnapshot): AppState => {
  const incoming = parseCurrentAppStatePayload(payload);
  if (incoming.version !== current.version) throw new Error("导入文件版本不兼容，请使用当前版本导出的 JSON。");
  const timestamp = new Date().toISOString();

  return {
    ...incoming,
    backupSnapshots: [backup, ...(current.backupSnapshots ?? [])].slice(0, 10),
    sync: {
      ...incoming.sync,
      status: "idle",
      message: "已从 JSON 导入数据，请同步到团队后台确认保存。",
    },
    updatedAt: timestamp,
  };
};
