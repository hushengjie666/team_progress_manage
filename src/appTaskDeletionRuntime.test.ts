import { describe, expect, it, vi } from "vitest";
import { createAppTaskDeletionRuntime } from "./appTaskDeletionRuntime";
import { createTestState } from "./test/fixtures";

describe("createAppTaskDeletionRuntime", () => {
  it("restores deleted task plan memberships during undo", async () => {
    const state = createTestState();
    const task = state.tasks[0];
    const plan = state.dailyPlans[0];
    const commands: unknown[] = [];
    const setSelectedTaskId = vi.fn();
    const setDeletedTaskSnapshot = vi.fn();
    const snapshot = { task, committedPlanIds: [plan.id], deletedAt: "2026-07-17T08:00:00Z" };
    const runtime = createAppTaskDeletionRuntime({
      getState: () => state,
      getSelectedTaskId: () => null,
      getPendingDeleteTask: () => null,
      getDeletedTaskSnapshot: () => snapshot,
      runTeamCommand: vi.fn(async (command) => {
        commands.push(command);
        return state;
      }),
      setToast: vi.fn(),
      setSelectedTaskId,
      setPendingDeleteTask: vi.fn(),
      setDeletedTaskSnapshot,
      undoTimerRef: { current: null },
    });

    runtime.undoDeleteTask();

    await vi.waitFor(() => expect(commands).toHaveLength(2));
    expect(commands).toEqual([
      expect.objectContaining({ kind: "create", entity: "task", payload: task }),
      expect.objectContaining({
        kind: "action",
        resource: "daily-plans",
        id: plan.id,
        action: "add-task",
        payload: { task_id: task.id },
      }),
    ]);
    expect(setSelectedTaskId).toHaveBeenCalledWith(task.id);
    expect(setDeletedTaskSnapshot).toHaveBeenCalledWith(null);
  });
});
