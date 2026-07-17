import { describe, expect, it, vi } from "vitest";
import { createAppTaskSplitRuntime } from "./appTaskSplitRuntime";
import { createTestState } from "./test/fixtures";

describe("app task split runtime", () => {
  it("submits the current dialog draft even when the runtime getter is stale", async () => {
    const state = createTestState();
    const task = state.tasks[0];
    const runTeamCommand = vi.fn(async () => state);
    const setPendingSplit = vi.fn();
    const runtime = createAppTaskSplitRuntime({
      getState: () => state,
      getPendingSplit: () => null,
      runTeamCommand,
      setToast: vi.fn(),
      setSelectedTaskId: vi.fn(),
      setPendingSplit,
    });

    runtime.confirmSplitTask({ task, text: "第一步, 第二步\n第三步" });
    await vi.waitFor(() => expect(runTeamCommand).toHaveBeenCalledOnce());

    expect(runTeamCommand).toHaveBeenCalledWith({
      kind: "action",
      resource: "tasks",
      id: task.id,
      action: "split",
      workspaceId: task.workspaceId,
      payload: { child_titles: ["第一步", "第二步", "第三步"] },
      idempotencyKey: `split:${task.id}:第一步|第二步|第三步`,
    });
    await vi.waitFor(() => expect(setPendingSplit).toHaveBeenCalledWith(null));
  });

  it("shows validation and does not submit fewer than two titles", () => {
    const state = createTestState();
    const task = state.tasks[0];
    const runTeamCommand = vi.fn();
    const setToast = vi.fn();
    const runtime = createAppTaskSplitRuntime({
      getState: () => state,
      getPendingSplit: () => null,
      runTeamCommand,
      setToast,
      setSelectedTaskId: vi.fn(),
      setPendingSplit: vi.fn(),
    });

    runtime.confirmSplitTask({ task, text: "只有一个标题" });

    expect(runTeamCommand).not.toHaveBeenCalled();
    expect(setToast).toHaveBeenCalledWith("至少需要两个子任务标题");
  });
});
