import { describe, expect, it } from "vitest";
import {
  startTimerInState,
  toggleTimerInState,
} from "./appModel";
import { createInitialState } from "./test/fixtures";

describe("work session concurrency", () => {
  it("enforces one active work session per executor when starting work", () => {
    const state = createInitialState();
    const firstTaskId = state.tasks[0].id;
    const secondTaskId = state.tasks[1].id;
    const started = startTimerInState(
      state,
      "focus",
      firstTaskId,
      "2026-05-10T08:00:00.000Z",
      "session_first",
    );

    const duplicateStart = startTimerInState(
      started,
      "focus",
      firstTaskId,
      "2026-05-10T08:02:00.000Z",
      "session_duplicate",
    );
    expect(duplicateStart.workSessions.filter((session) => session.status === "active")).toHaveLength(1);
    expect(duplicateStart.focusSessions).toHaveLength(1);

    const switched = startTimerInState(
      duplicateStart,
      "focus",
      secondTaskId,
      "2026-05-10T08:05:00.000Z",
      "session_second",
    );
    expect(switched.workSessions.filter((session) => session.status === "active")).toHaveLength(1);
    expect(switched.workSessions[0]).toMatchObject({ taskId: secondTaskId, status: "active" });
    expect(switched.workSessions[1]).toMatchObject({ taskId: firstTaskId, status: "ended", endedAt: "2026-05-10T08:05:00.000Z" });
    expect(switched.focusSessions.find((session) => session.id === "session_first")).toMatchObject({
      endedAt: "2026-05-10T08:05:00.000Z",
      outcome: "skipped",
    });
    expect(switched.executionSignals.map((signal) => signal.type).slice(0, 3)).toEqual([
      "work_started",
      "work_ended",
      "work_started",
    ]);
    expect(switched.executionSignals[1].payload).toMatchObject({ reason: "task_switch", nextTaskId: secondTaskId });
  });

  it("ends a paused work session for the same executor when starting another task", () => {
    const state = createInitialState();
    const firstTaskId = state.tasks[0].id;
    const secondTaskId = state.tasks[1].id;
    const started = startTimerInState(
      state,
      "focus",
      firstTaskId,
      "2026-05-10T08:00:00.000Z",
      "session_paused_first",
    );
    const paused = toggleTimerInState(started, "2026-05-10T08:03:00.000Z");

    const switched = startTimerInState(
      paused,
      "focus",
      secondTaskId,
      "2026-05-10T08:05:00.000Z",
      "session_after_pause",
    );

    expect(switched.workSessions.filter((session) => session.status === "active" || session.status === "paused")).toHaveLength(1);
    expect(switched.workSessions[0]).toMatchObject({ taskId: secondTaskId, status: "active" });
    expect(switched.workSessions.find((session) => session.taskId === firstTaskId)).toMatchObject({
      status: "ended",
      endedAt: "2026-05-10T08:05:00.000Z",
    });
  });
});
