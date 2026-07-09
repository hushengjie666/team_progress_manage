import { describe, expect, it } from "vitest";
import {
  endSessionInState,
  finishExpiredTimerInState,
  shouldFinishExpiredTimerInState,
  startTimerInState,
  toggleTimerInState,
} from "./appModel";
import { todayKey } from "./seed";
import { createInitialState } from "./test/fixtures";

describe("timer app model", () => {
  it("finishes an expired active timer through the app model", () => {
    const state = createInitialState();
    const taskId = state.tasks[0].id;
    const started = startTimerInState(
      state,
      "focus",
      taskId,
      `${todayKey()}T08:00:00.000Z`,
      "session_expired_model",
    );
    const timestamp = `${todayKey()}T08:30:00.000Z`;

    expect(shouldFinishExpiredTimerInState(started, timestamp)).toBe(true);

    const finished = finishExpiredTimerInState(started, timestamp);
    const finishedTask = finished.tasks.find((task) => task.id === taskId);
    const finishedSession = finished.focusSessions.find((session) => session.id === "session_expired_model");
    const workSession = finished.workSessions.find((session) => session.focusSessionId === "session_expired_model");

    expect(finished.activeTimer).toMatchObject({
      mode: "short_break",
      remaining: state.settings.shortBreakMinutes * 60,
      isRunning: false,
      pausedAt: timestamp,
    });
    expect(finishedTask?.actualPomodoros).toBe(1);
    expect(finishedTask?.status).toBe("in_progress");
    expect(finishedSession?.outcome).toBe("completed");
    expect(workSession?.status).toBe("ended");
  });

  it("prepares the next focus timer after a break without starting it", () => {
    const state = createInitialState();
    const breakStarted = startTimerInState(
      state,
      "short_break",
      undefined,
      `${todayKey()}T09:00:00.000Z`,
      "session_break_model",
    );
    const timestamp = `${todayKey()}T09:05:00.000Z`;

    const finished = finishExpiredTimerInState(breakStarted, timestamp);

    expect(finished.activeTimer).toMatchObject({
      mode: "focus",
      remaining: state.settings.focusMinutes * 60,
      isRunning: false,
      pausedAt: timestamp,
    });
  });

  it("records work session execution signals around a focus timer", () => {
    const state = createInitialState();
    const taskId = state.tasks[0].id;
    const started = startTimerInState(
      state,
      "focus",
      taskId,
      "2026-05-10T08:00:00.000Z",
      "session_work_test",
    );
    expect(started.activeTimer?.workSessionId).toBe(started.workSessions[0].id);
    expect(started.workSessions[0]).toMatchObject({
      taskId,
      executorMemberId: "member_owner",
      focusSessionId: "session_work_test",
      status: "active",
    });
    expect(started.executionSignals[0]).toMatchObject({
      workSessionId: started.workSessions[0].id,
      taskId,
      executorMemberId: "member_owner",
      type: "work_started",
    });

    const paused = toggleTimerInState(started, "2026-05-10T08:05:00.000Z");
    expect(paused.activeTimer?.isRunning).toBe(false);
    expect(paused.workSessions[0]).toMatchObject({ status: "paused", pausedAt: "2026-05-10T08:05:00.000Z" });

    const resumed = toggleTimerInState(paused, "2026-05-10T08:07:00.000Z");
    expect(resumed.activeTimer?.isRunning).toBe(true);
    expect(resumed.workSessions[0]).toMatchObject({ status: "active", pausedAt: undefined, totalPausedSeconds: 120 });

    const ended = endSessionInState(resumed, "completed", "2026-05-10T08:32:00.000Z");
    expect(ended.activeTimer).toBeUndefined();
    expect(ended.workSessions[0]).toMatchObject({
      status: "ended",
      endedAt: "2026-05-10T08:32:00.000Z",
      totalPausedSeconds: 120,
    });
    expect(ended.executionSignals.map((signal) => signal.type).slice(0, 4)).toEqual([
      "work_ended",
      "work_resumed",
      "work_paused",
      "work_started",
    ]);
  });
});
