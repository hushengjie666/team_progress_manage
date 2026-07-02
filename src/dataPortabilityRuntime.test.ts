import { describe, expect, it } from "vitest";
import { createTestState } from "./test/fixtures";
import { createDataPortabilityRuntime } from "./dataPortabilityRuntime";
import { exportStateJson } from "./dataPortability";
import type { AppState, ImportSummary } from "./types";

const createHarness = (initial = createTestState()) => {
  let current: AppState | null = initial;
  let toast = "";
  let importSummary: ImportSummary | null = null;
  const downloads: { filename: string; text: string; mime?: string }[] = [];
  const pendingImportPayloadRef = { current: null as unknown };
  const runtime = createDataPortabilityRuntime({
    getState: () => current,
    pendingImportPayloadRef,
    setImportSummary: (summary) => {
      importSummary = summary;
    },
    setToast: (message) => {
      toast = message;
    },
    commitTeamState: (_before, after) => {
      current = after;
    },
    downloadText: (filename, text, mime) => {
      downloads.push({ filename, text, mime });
    },
  });
  return {
    runtime,
    pendingImportPayloadRef,
    downloads,
    getCurrent: () => current,
    getToast: () => toast,
    getImportSummary: () => importSummary,
  };
};

describe("data portability runtime", () => {
  it("exports JSON and records a manual backup snapshot", () => {
    const { runtime, downloads, getCurrent, getToast } = createHarness();

    runtime.exportJson();

    expect(downloads[0]?.filename).toMatch(/^timemanage-.*\.json$/);
    expect(downloads[0]?.mime).toBe("application/json;charset=utf-8");
    expect(getCurrent()?.backupSnapshots[0]?.reason).toBe("manual_export");
    expect(getToast()).toBe("完整 JSON 已导出");
  });

  it("previews invalid imports without keeping a pending payload", async () => {
    const { runtime, pendingImportPayloadRef, getImportSummary } = createHarness();

    await runtime.previewImportFile({ text: async () => "{ broken json" });

    expect(pendingImportPayloadRef.current).toBeNull();
    expect(getImportSummary()?.valid).toBe(false);
  });

  it("confirms import through the commit interface", async () => {
    const state = createTestState();
    const { runtime, pendingImportPayloadRef, downloads, getCurrent, getToast, getImportSummary } = createHarness(state);
    const payload = { ...state, tasks: state.tasks.slice(0, 1), backupSnapshots: [] };
    pendingImportPayloadRef.current = payload;

    runtime.confirmImport();

    expect(downloads[0]?.filename).toMatch(/^timemanage-before-import-.*\.json$/);
    expect(getCurrent()?.tasks).toHaveLength(1);
    expect(pendingImportPayloadRef.current).toBeNull();
    expect(getImportSummary()).toBeNull();
    expect(getToast()).toBe("导入完成，已自动备份导入前数据");
  });

  it("restores only backups that carry payloads", () => {
    const state = createTestState({
      backupSnapshots: [{
        id: "backup_summary",
        createdAt: "2026-07-01T08:00:00.000Z",
        reason: "manual_export",
        taskCount: 1,
        sessionCount: 0,
        planCount: 0,
        sourceVersion: 1,
      }],
    });
    const { runtime, getToast } = createHarness(state);

    runtime.restoreBackup("backup_summary");

    expect(getToast()).toBe("这条备份只有摘要，无法直接恢复");
  });

  it("restores backup payloads through the commit interface", () => {
    const state = createTestState();
    const backupPayload = { ...state, tasks: state.tasks.slice(0, 1), backupSnapshots: [] };
    const { runtime, getCurrent, getToast } = createHarness({
      ...state,
      backupSnapshots: [{
        id: "backup_full",
        createdAt: "2026-07-01T08:00:00.000Z",
        reason: "manual_export",
        taskCount: 1,
        sessionCount: 0,
        planCount: 0,
        sourceVersion: 1,
        payload: exportStateJson(backupPayload),
      }],
    });

    runtime.restoreBackup("backup_full");

    expect(getCurrent()?.tasks).toHaveLength(1);
    expect(getToast()).toBe("已从备份恢复，恢复前状态也已保留为自动备份");
  });
});
