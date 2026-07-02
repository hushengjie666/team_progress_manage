import { describe, expect, it } from "vitest";
import { createTestState } from "./test/fixtures";
import { applySyncConflictResolution, syncConflictResolutionToast } from "./conflictResolutionModel";
import type { SyncConflict } from "./types";

const timestamp = "2026-07-01T09:00:00.000Z";

const withConflict = (conflict: SyncConflict) => {
  const state = createTestState();
  return {
    ...state,
    sync: {
      ...state.sync,
      conflicts: [conflict],
      conflictCount: 1,
      message: "有冲突",
    },
  };
};

describe("conflict resolution model", () => {
  it("keeps local data and clears the resolved conflict", () => {
    const conflict: SyncConflict = {
      entity: "task",
      id: "task_write_prd",
      revision: 4,
      remoteUpdatedAt: timestamp,
      remotePayload: { title: "远端标题" },
    };
    const state = withConflict(conflict);

    const next = applySyncConflictResolution(state, conflict, "local", timestamp);

    expect(next.tasks.find((task) => task.id === "task_write_prd")?.title).toBe("整理时间管理系统 PRD");
    expect(next.sync.conflicts).toEqual([]);
    expect(next.sync.conflictCount).toBe(0);
    expect(next.sync.message).toContain("保留本地版本");
  });

  it("applies remote task fields when the user chooses remote", () => {
    const conflict: SyncConflict = {
      entity: "task",
      id: "task_write_prd",
      revision: 5,
      remoteUpdatedAt: timestamp,
      remotePayload: { title: "远端标题", progressPercent: 80 },
    };
    const state = withConflict(conflict);

    const next = applySyncConflictResolution(state, conflict, "remote", timestamp);
    const task = next.tasks.find((item) => item.id === "task_write_prd");

    expect(task?.title).toBe("远端标题");
    expect(task?.progressPercent).toBe(80);
    expect(next.sync.conflicts).toEqual([]);
    expect(syncConflictResolutionToast("remote")).toBe("已使用远端版本");
  });
});
