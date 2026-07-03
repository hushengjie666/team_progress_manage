import { describe, expect, it } from "vitest";
import { buildCsvBundle, createBackupSnapshot, mergeImportedState, summarizeImportPayload } from "./dataPortability";
import { createInitialState } from "./test/fixtures";

describe("data import and export", () => {
  it("imports current-schema data and keeps a backup snapshot", () => {
    const state = createInitialState();
    const backup = createBackupSnapshot(state, "before_import", "2026-05-10T10:00:00.000Z");
    const imported = mergeImportedState(
      state,
      {
        ...state,
        tasks: [
          {
            ...state.tasks[0],
            id: "imported_current_task",
            projectId: state.projects[0].id,
            progressPercent: 75,
            progressNote: "导入前已经完成一部分。",
          },
        ],
      },
      backup,
    );
    expect(imported.projects.length).toBeGreaterThan(0);
    expect(imported.tasks[0].projectId).toBe(imported.projects[0].id);
    expect(imported.tasks[0].progressPercent).toBe(75);
    expect(imported.tasks[0].progressNote).toBe("导入前已经完成一部分。");
    expect(imported.backupSnapshots[0]).toMatchObject({ reason: "before_import" });
  });

  it("rejects imported data from unsupported schema versions", () => {
    const state = createInitialState();
    const backup = createBackupSnapshot(state, "before_import", "2026-05-10T10:00:00.000Z");

    expect(() => mergeImportedState(state, { ...state, version: 1 }, backup)).toThrow("当前版本");
  });

  it("rejects incomplete imports instead of backfilling missing fields", () => {
    const state = createInitialState();
    const backup = createBackupSnapshot(state, "before_import", "2026-05-10T10:00:00.000Z");
    const incomplete = { ...state };
    delete (incomplete as Partial<typeof state>).dailyPlans;

    const summary = summarizeImportPayload(incomplete);

    expect(summary.valid).toBe(false);
    expect(summary.message).toContain("完整");
    expect(() => mergeImportedState(state, incomplete, backup)).toThrow("完整");
  });

  it("summarizes imports, creates backups, and exports CSV", () => {
    const state = createInitialState();
    const summary = summarizeImportPayload(state);
    expect(summary.valid).toBe(true);
    expect(summary.taskCount).toBe(state.tasks.length);
    expect(buildCsvBundle(state)).toContain("# tasks.csv");
    const backup = createBackupSnapshot(state, "before_import", "2026-05-10T10:00:00.000Z");
    expect(backup.payload).toContain("project_starter");
    const imported = mergeImportedState(state, { ...state, tasks: [] }, backup);
    expect(imported.tasks).toHaveLength(0);
    expect(imported.backupSnapshots[0]).toMatchObject({ reason: "before_import" });
  });
});
