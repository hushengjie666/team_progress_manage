import { describe, expect, it, vi } from "vitest";
import { today } from "./appModel";
import { createAppTaskCreationRuntime } from "./appTaskCreationRuntime";
import { currentAccountDailyPlanForWorkspaceDate, workspaceIdForTask } from "./dailyPlanScope";
import { createTestState } from "./test/fixtures";
import type { AppState } from "./types";

const createHarness = (initial: AppState, runTeamCommand: ReturnType<typeof vi.fn>) => {
  let current = initial;
  let toast = "";
  const runtime = createAppTaskCreationRuntime({
    getState: () => current,
    getCurrentProjectId: () => current.projects[0]?.id ?? "",
    getDraft: () => ({
      title: "", notes: "", project: "", tags: "", priority: "medium", severity: "medium",
      stage: "planning", estimatePomodoros: 1, dueAt: "", reminderAt: "", repeatRule: "none", repeatIntervalDays: 1,
    }),
    runTeamCommand,
    updateState: (updater) => { current = updater(current); },
    setDraft: vi.fn(),
    setToast: (message) => { toast = message; },
  });
  return { runtime, getCurrent: () => current, getToast: () => toast };
};

describe("createAppTaskCreationRuntime queue commits", () => {
  it("moves a task into today's queue before the backend responds", async () => {
    const source = createTestState();
    const task = source.tasks.find((item) => item.status === "pool")!;
    const workspaceId = workspaceIdForTask(source, task);
    let finishRequest: (value: AppState | undefined) => void = () => undefined;
    const pending = new Promise<AppState | undefined>((resolve) => { finishRequest = resolve; });
    const runTeamCommand = vi.fn(() => pending);
    const { runtime, getCurrent, getToast } = createHarness(source, runTeamCommand);

    runtime.commitTask(task.id);

    const immediate = getCurrent();
    const immediatePlan = currentAccountDailyPlanForWorkspaceDate(immediate, workspaceId, today());
    expect(immediatePlan?.committedTaskIds).toContain(task.id);
    expect(immediate.tasks.find((item) => item.id === task.id)?.status).toBe("committed");
    expect(getToast()).toBe("");
    expect(runTeamCommand).toHaveBeenCalledWith(expect.objectContaining({
      kind: "action",
      resource: "daily-plans",
      id: immediatePlan?.id,
      action: "add-task",
      payload: { task_id: task.id, date: today() },
    }));

    finishRequest(immediate);
    await vi.waitFor(() => expect(getToast()).toBe("已加入工作队列"));
  });

  it("uses one atomic add action when today's plan is missing", () => {
    const source = createTestState({ dailyPlans: [] });
    const task = source.tasks.find((item) => item.status === "pool")!;
    const runTeamCommand = vi.fn(() => new Promise<AppState | undefined>(() => undefined));
    const { runtime, getCurrent } = createHarness(source, runTeamCommand);

    runtime.commitTask(task.id);

    expect(getCurrent().dailyPlans).toHaveLength(1);
    expect(getCurrent().dailyPlans[0].committedTaskIds).toContain(task.id);
    expect(runTeamCommand).toHaveBeenCalledTimes(1);
    expect(runTeamCommand.mock.calls[0]?.[0]).toEqual(expect.objectContaining({
      kind: "action",
      resource: "daily-plans",
      action: "add-task",
    }));
  });

  it("rolls back the visible queue change when the backend rejects it", async () => {
    const source = createTestState();
    const task = source.tasks.find((item) => item.status === "pool")!;
    const workspaceId = workspaceIdForTask(source, task);
    let finishRequest: (value: AppState | undefined) => void = () => undefined;
    const pending = new Promise<AppState | undefined>((resolve) => { finishRequest = resolve; });
    const runTeamCommand = vi.fn(() => pending);
    const { runtime, getCurrent } = createHarness(source, runTeamCommand);

    runtime.commitTask(task.id);
    expect(currentAccountDailyPlanForWorkspaceDate(getCurrent(), workspaceId, today())?.committedTaskIds).toContain(task.id);

    finishRequest(undefined);
    await vi.waitFor(() => {
      expect(currentAccountDailyPlanForWorkspaceDate(getCurrent(), workspaceId, today())?.committedTaskIds).not.toContain(task.id);
    });
    expect(getCurrent().tasks.find((item) => item.id === task.id)?.status).toBe(task.status);
  });
});
