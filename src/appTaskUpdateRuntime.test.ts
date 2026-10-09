import { describe, expect, it, vi } from "vitest";
import { createAppTaskUpdateRuntime } from "./appTaskUpdateRuntime";
import { createTestState } from "./test/fixtures";
import type { RunTeamDomainCommand } from "./teamDomainCommands";

describe("task metadata updates", () => {
  it.each(["pool", "in_progress", "pending_review"] as const)("does not send the old %s status when editing metadata", (status) => {
    const state = createTestState();
    state.tasks[0] = { ...state.tasks[0], status, reviewSubmittedAt: "2026-10-09T08:00:00Z" };
    const runTeamCommand = vi.fn<RunTeamDomainCommand>().mockResolvedValue(undefined);
    const runtime = createAppTaskUpdateRuntime({ getState: () => state, runTeamCommand });

    runtime.updateTaskProgress(state.tasks[0].id, 60, "进度说明");

    expect(runTeamCommand.mock.calls[0]?.[0]).toMatchObject({
      kind: "patch",
      entity: "task",
      patch: { progressPercent: 60, progressNote: "进度说明" },
    });
    const command = runTeamCommand.mock.calls[0]?.[0];
    expect(command).toHaveProperty("patch");
    expect((command as unknown as { patch: unknown }).patch).toEqual({ progressPercent: 60, progressNote: "进度说明" });
  });

  it("diffs functional updates and sends null to clear optional fields", () => {
    const state = createTestState();
    const runTeamCommand = vi.fn<RunTeamDomainCommand>().mockResolvedValue(undefined);
    const runtime = createAppTaskUpdateRuntime({ getState: () => state, runTeamCommand });

    runtime.updateTask(state.tasks[0].id, (task) => ({ ...task, notes: "新备注", dueAt: undefined }));

    expect(runTeamCommand.mock.calls[0]?.[0]).toMatchObject({ patch: { notes: "新备注", dueAt: null } });
    expect((runTeamCommand.mock.calls[0]?.[0] as unknown as { patch: unknown }).patch).toEqual({ notes: "新备注", dueAt: null });
  });
});
