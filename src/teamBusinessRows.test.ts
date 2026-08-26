import { afterEach, describe, expect, it, vi } from "vitest";
import { businessRowsFromState, mergeBusinessRowChangesIntoState } from "./teamBusinessRows";
import { createTestState, withWorkSession } from "./test/fixtures";

afterEach(() => {
  vi.useRealTimers();
});

describe("business delta merge", () => {
  it("is idempotent for repeated rows and deletion markers", () => {
    const source = createTestState();
    const task = source.tasks[0];
    const updated = { ...task, title: "服务端更新", updatedAt: "2026-08-19T04:00:00.000Z" };
    const row = businessRowsFromState({ ...source, tasks: [updated, ...source.tasks.slice(1)] })
      .find((item) => item.entity === "task" && item.id === task.id)!;

    const once = mergeBusinessRowChangesIntoState(source, [row]);
    const twice = mergeBusinessRowChangesIntoState(once, [row]);
    expect(twice.tasks.filter((item) => item.id === task.id)).toEqual([updated]);

    const deleted = mergeBusinessRowChangesIntoState(twice, [], [{
      workspace_id: row.workspace_id,
      account_id: row.account_id,
      entity: "task",
      id: task.id,
    }]);
    const deletedAgain = mergeBusinessRowChangesIntoState(deleted, [], [{
      workspace_id: row.workspace_id,
      entity: "task",
      id: task.id,
    }]);
    expect(deletedAgain.tasks.some((item) => item.id === task.id)).toBe(false);
  });

  it("does not recalculate a running timer for an unrelated business delta", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-25T08:08:00.000Z"));
    const base = createTestState();
    const workSessionId = "work_stable_timer";
    const focusSessionId = "focus_stable_timer";
    const withSession = withWorkSession({
      ...base,
      focusSessions: [{
        id: focusSessionId,
        taskId: base.tasks[0].id,
        mode: "focus",
        duration: 1500,
        startedAt: "2026-08-25T08:00:00.000Z",
        interruptionCounts: { internal: 0, external: 0 },
      }],
    }, {
      id: workSessionId,
      focusSessionId,
      taskId: base.tasks[0].id,
      status: "active",
      startedAt: "2026-08-25T08:00:00.000Z",
      updatedAt: "2026-08-25T08:00:00.000Z",
    });
    const local = {
      ...withSession,
      activeTimer: {
        sessionId: focusSessionId,
        workSessionId,
        taskId: base.tasks[0].id,
        mode: "focus" as const,
        duration: 1500,
        remaining: 1380,
        isRunning: true,
        startedAt: "2026-08-25T08:05:00.000Z",
        plannedEndAt: "2026-08-25T08:31:00.000Z",
        totalPausedSeconds: 0,
        cycleIndex: 1,
      },
    };
    const task = { ...local.tasks[0], notes: "无关增量", updatedAt: "2026-08-25T08:08:00.000Z" };
    const row = businessRowsFromState({ ...local, tasks: [task, ...local.tasks.slice(1)] })
      .find((item) => item.entity === "task" && item.id === task.id)!;

    const merged = mergeBusinessRowChangesIntoState(local, [row], [], "2026-08-25T08:02:00.000Z");

    expect(merged.activeTimer).toEqual(local.activeTimer);
  });

  it("preserves the prepared break when the completed work session is confirmed", () => {
    const base = createTestState();
    const completedAt = "2026-08-26T08:25:00.000Z";
    const completed = withWorkSession(base, {
      id: "work_completed_focus",
      focusSessionId: "focus_completed",
      taskId: base.tasks[0].id,
      status: "ended",
      startedAt: "2026-08-26T08:00:00.000Z",
      endedAt: completedAt,
      updatedAt: completedAt,
    });
    const local = {
      ...completed,
      activeTimer: {
        sessionId: "prepared_break",
        mode: "short_break" as const,
        duration: 300,
        remaining: 300,
        isRunning: false,
        prepared: true,
        startedAt: completedAt,
        plannedEndAt: "2026-08-26T08:30:00.000Z",
        pausedAt: completedAt,
        totalPausedSeconds: 0,
        cycleIndex: 1,
      },
    };
    const row = businessRowsFromState(completed)
      .find((item) => item.entity === "work_session" && item.id === "work_completed_focus")!;

    const merged = mergeBusinessRowChangesIntoState(local, [row], [], completedAt);

    expect(merged.activeTimer).toEqual(local.activeTimer);
  });
});
