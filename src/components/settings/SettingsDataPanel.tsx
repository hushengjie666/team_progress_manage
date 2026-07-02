import { DatabaseBackup, Download, Upload } from "lucide-react";
import { useRef } from "react";
import type { BackupSnapshot, ImportSummary } from "../../types";

export function SettingsDataPanel({
  backupSnapshots,
  exportJson,
  exportCsv,
  previewImportFile,
  importSummary,
  confirmImport,
  restoreBackup,
}: {
  backupSnapshots: BackupSnapshot[];
  exportJson: () => void;
  exportCsv: () => void;
  previewImportFile: (file: File) => Promise<void>;
  importSummary: ImportSummary | null;
  confirmImport: () => void;
  restoreBackup: (backupId: string) => void;
}) {
  const importInputRef = useRef<HTMLInputElement | null>(null);

  return (
    <section className="band settings-panel data-management">
      <div className="section-title">
        <div>
          <p className="eyebrow">数据安全</p>
          <h2>备份与导入</h2>
        </div>
        <DatabaseBackup size={20} />
      </div>
      <p className="muted">导入前会自动下载当前完整 JSON 备份；CSV 用于人工审计，不建议作为恢复来源。</p>
      <div className="button-row">
        <button className="primary-button" onClick={exportJson}>
          <Download size={16} />
          导出完整 JSON
        </button>
        <button className="secondary-button" onClick={exportCsv}>
          <Download size={16} />
          导出 CSV
        </button>
        <button className="secondary-button" onClick={() => importInputRef.current?.click()}>
          <Upload size={16} />
          选择 JSON 导入
        </button>
        <input
          ref={importInputRef}
          type="file"
          accept="application/json,.json"
          className="hidden-file-input"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void previewImportFile(file);
            event.currentTarget.value = "";
          }}
        />
      </div>
      {importSummary && (
        <div className={importSummary.valid ? "import-summary" : "import-summary invalid"}>
          <strong>{importSummary.message}</strong>
          <span>
            任务 {importSummary.taskCount} · 番茄 {importSummary.sessionCount} · 计划 {importSummary.planCount} · 中断 {importSummary.interruptionCount}
          </span>
          <small>
            与当前相比：任务 {importSummary.taskDelta >= 0 ? "+" : ""}{importSummary.taskDelta} · 番茄 {importSummary.sessionDelta >= 0 ? "+" : ""}{importSummary.sessionDelta} · 计划 {importSummary.planDelta >= 0 ? "+" : ""}{importSummary.planDelta}
          </small>
          {importSummary.warnings.map((warning) => (
            <small key={warning}>{warning}</small>
          ))}
          <button className="primary-button" disabled={!importSummary.valid} onClick={confirmImport}>
            确认导入
          </button>
        </div>
      )}
      <div className="backup-list">
        {backupSnapshots.slice(0, 4).map((backup) => (
          <article className="backup-item" key={backup.id}>
            <strong>{new Date(backup.createdAt).toLocaleString()}</strong>
            <span>{backup.reason === "before_import" ? "导入前备份" : backup.reason === "manual_export" ? "手动导出" : "自动备份"}</span>
            <small>任务 {backup.taskCount} · 番茄 {backup.sessionCount} · 计划 {backup.planCount}</small>
            <button className="small-button" disabled={!backup.payload} onClick={() => restoreBackup(backup.id)}>
              恢复
            </button>
          </article>
        ))}
        {!backupSnapshots.length && <p className="empty">还没有备份记录。</p>}
      </div>
    </section>
  );
}
