import { ensureTodayPlan, today } from "./appModel";
import { buildCsvBundle, createBackupSnapshot, exportStateJson, mergeImportedState, summarizeImportPayload } from "./dataPortability";
import type { AppState, ImportSummary } from "./types";

type PendingImportPayloadRef = { current: unknown };
type CommitTeamState = (before: AppState, after: AppState) => void;
type DownloadText = (filename: string, text: string, mime?: string) => void;

export type DataPortabilityRuntimeOptions = {
  getState: () => AppState | null;
  pendingImportPayloadRef: PendingImportPayloadRef;
  setImportSummary: (summary: ImportSummary | null) => void;
  setToast: (message: string) => void;
  commitTeamState: CommitTeamState;
  downloadText?: DownloadText;
};

export type DataPortabilityRuntime = {
  exportJson: () => void;
  exportCsv: () => void;
  previewImportFile: (file: Pick<File, "text">) => Promise<void>;
  confirmImport: () => void;
  restoreBackup: (backupId: string) => void;
};

export const downloadTextFile: DownloadText = (filename, text, mime = "text/plain;charset=utf-8") => {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};

export function createDataPortabilityRuntime({
  getState,
  pendingImportPayloadRef,
  setImportSummary,
  setToast,
  commitTeamState,
  downloadText = downloadTextFile,
}: DataPortabilityRuntimeOptions): DataPortabilityRuntime {
  const exportJson = () => {
    const state = getState();
    if (!state) return;
    const snapshot = createBackupSnapshot(state, "manual_export");
    commitTeamState(state, {
      ...state,
      backupSnapshots: [snapshot, ...(state.backupSnapshots ?? [])].slice(0, 10),
      updatedAt: new Date().toISOString(),
    });
    downloadText(`timemanage-${today()}.json`, exportStateJson(state), "application/json;charset=utf-8");
    setToast("完整 JSON 已导出");
  };

  const exportCsv = () => {
    const state = getState();
    if (!state) return;
    downloadText(`timemanage-${today()}.csv`, buildCsvBundle(state), "text/csv;charset=utf-8");
    setToast("CSV 审计文件已导出");
  };

  const previewImportFile = async (file: Pick<File, "text">) => {
    const state = getState();
    try {
      const payload = JSON.parse(await file.text());
      pendingImportPayloadRef.current = payload;
      setImportSummary(summarizeImportPayload(payload, state ?? undefined));
    } catch {
      pendingImportPayloadRef.current = null;
      setImportSummary(summarizeImportPayload(null, state ?? undefined));
    }
  };

  const confirmImport = () => {
    const state = getState();
    if (!state || !pendingImportPayloadRef.current) return;
    const backup = createBackupSnapshot(state, "before_import");
    downloadText(`timemanage-before-import-${today()}.json`, exportStateJson(state), "application/json;charset=utf-8");
    try {
      commitTeamState(state, ensureTodayPlan(mergeImportedState(state, pendingImportPayloadRef.current, backup)));
      pendingImportPayloadRef.current = null;
      setImportSummary(null);
      setToast("导入完成，已自动备份导入前数据");
    } catch (error) {
      const message = error instanceof Error ? error.message : "导入失败";
      setToast(message);
    }
  };

  const restoreBackup = (backupId: string) => {
    const state = getState();
    if (!state) return;
    const backup = state.backupSnapshots.find((item) => item.id === backupId);
    if (!backup?.payload) {
      setToast("这条备份只有摘要，无法直接恢复");
      return;
    }
    try {
      const payload = JSON.parse(backup.payload);
      const restorePoint = createBackupSnapshot(state, "auto");
      commitTeamState(state, ensureTodayPlan(mergeImportedState(state, payload, restorePoint)));
      setToast("已从备份恢复，恢复前状态也已保留为自动备份");
    } catch {
      setToast("备份内容无法解析");
    }
  };

  return {
    exportJson,
    exportCsv,
    previewImportFile,
    confirmImport,
    restoreBackup,
  };
}
