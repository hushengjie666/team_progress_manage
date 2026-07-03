import { describe, expect, it } from "vitest";
import { startTimerInState } from "./appModel";
import { createInitialState } from "./test/fixtures";
import {
  acceptTaskInState,
  returnTaskForReviewInState,
  submitTaskForReviewInState,
  updateTaskProgressInState,
} from "./teamProgress";

describe("team progress review transitions", () => {
  it("updates task progress with bounded percent and a manual progress note", () => {
    const state = createInitialState();
    const updated = updateTaskProgressInState(
      state,
      state.tasks[0].id,
      140,
      "完成接口联调，剩余验收清单。",
      "2026-05-10T11:00:00.000Z",
    );
    expect(updated.tasks[0]).toMatchObject({
      progressPercent: 100,
      progressNote: "完成接口联调，剩余验收清单。",
      updatedAt: "2026-05-10T11:00:00.000Z",
    });

    const reset = updateTaskProgressInState(updated, updated.tasks[0].id, -20, "", "2026-05-10T12:00:00.000Z");
    expect(reset.tasks[0]).toMatchObject({ progressPercent: 0, progressNote: "" });
  });

  it("submits a task for review before it can be accepted as completed", () => {
    const state = createInitialState();
    const inProgressState = { ...state, tasks: state.tasks.map((task, index) => index === 0 ? { ...task, status: "in_progress" as const } : task) };
    const submitted = submitTaskForReviewInState(
      inProgressState,
      state.tasks[0].id,
      "member_owner",
      "2026-05-10T10:00:00.000Z",
    );
    expect(submitted.tasks[0]).toMatchObject({
      status: "pending_review",
      progressPercent: 100,
      reviewSubmittedAt: "2026-05-10T10:00:00.000Z",
      reviewSubmittedByMemberId: "member_owner",
    });
    expect(submitted.tasks[0].completedAt).toBeUndefined();

    const accepted = acceptTaskInState(
      submitted,
      submitted.tasks[0].id,
      "member_owner",
      "2026-05-10T11:00:00.000Z",
    );
    expect(accepted.tasks[0]).toMatchObject({
      status: "completed",
      completedAt: "2026-05-10T11:00:00.000Z",
      reviewAcceptedAt: "2026-05-10T11:00:00.000Z",
      reviewAcceptedByMemberId: "member_owner",
    });
    expect(accepted.tasks[0].estimateHistory).toHaveLength(1);
  });

  it("does not resubmit tasks already waiting for review", () => {
    const state = createInitialState();
    const inProgressState = { ...state, tasks: state.tasks.map((task, index) => index === 0 ? { ...task, status: "in_progress" as const } : task) };
    const submitted = submitTaskForReviewInState(
      inProgressState,
      state.tasks[0].id,
      "member_owner",
      "2026-05-10T10:00:00.000Z",
    );
    const resubmitted = submitTaskForReviewInState(
      submitted,
      state.tasks[0].id,
      "member_other",
      "2026-05-10T11:00:00.000Z",
    );

    expect(resubmitted.tasks[0]).toMatchObject({
      status: "pending_review",
      reviewSubmittedAt: "2026-05-10T10:00:00.000Z",
      reviewSubmittedByMemberId: "member_owner",
      updatedAt: "2026-05-10T10:00:00.000Z",
    });
  });

  it("does not start a timer for tasks waiting for review", () => {
    const state = createInitialState();
    const pendingReviewState = {
      ...state,
      tasks: state.tasks.map((task, index) => index === 0 ? { ...task, status: "pending_review" as const } : task),
    };

    const started = startTimerInState(
      pendingReviewState,
      "focus",
      state.tasks[0].id,
      "2026-05-10T10:00:00.000Z",
      "session_pending_review",
    );

    expect(started.activeTimer).toBeUndefined();
    expect(started.tasks[0].status).toBe("pending_review");
    expect(started.workSessions).toHaveLength(0);
  });

  it("ends active work when submitting an in-progress task for review", () => {
    const state = createInitialState();
    const taskId = state.tasks[0].id;
    const started = startTimerInState(
      state,
      "focus",
      taskId,
      "2026-05-10T10:00:00.000Z",
      "session_review_submit",
    );
    const workSessionId = started.activeTimer?.workSessionId;

    const submitted = submitTaskForReviewInState(
      started,
      taskId,
      "member_owner",
      "2026-05-10T10:05:00.000Z",
    );

    expect(submitted.tasks.find((task) => task.id === taskId)).toMatchObject({
      status: "pending_review",
      progressPercent: 100,
      reviewSubmittedAt: "2026-05-10T10:05:00.000Z",
    });
    expect(submitted.activeTimer).toBeUndefined();
    expect(submitted.workSessions.find((session) => session.id === workSessionId)).toMatchObject({
      status: "ended",
      endedAt: "2026-05-10T10:05:00.000Z",
    });
    expect(submitted.focusSessions.find((session) => session.id === "session_review_submit")).toMatchObject({
      endedAt: "2026-05-10T10:05:00.000Z",
      outcome: "skipped",
    });
  });

  it("only submits committed or in-progress tasks for review", () => {
    const state = createInitialState();
    const poolState = { ...state, tasks: state.tasks.map((task, index) => index === 0 ? { ...task, status: "pool" as const } : task) };
    const poolAttempt = submitTaskForReviewInState(poolState, state.tasks[0].id, "member_owner", "2026-05-10T10:00:00.000Z");
    const committedState = { ...state, tasks: state.tasks.map((task, index) => index === 0 ? { ...task, status: "committed" as const } : task) };
    const committedAttempt = submitTaskForReviewInState(committedState, state.tasks[0].id, "member_owner", "2026-05-10T10:00:00.000Z");

    expect(poolAttempt.tasks[0].status).toBe("pool");
    expect(committedAttempt.tasks[0].status).toBe("pending_review");
  });

  it("returns a pending review task with a reason", () => {
    const state = createInitialState();
    const inProgressState = { ...state, tasks: state.tasks.map((task, index) => index === 0 ? { ...task, status: "in_progress" as const } : task) };
    const submitted = submitTaskForReviewInState(inProgressState, state.tasks[0].id, "member_owner", "2026-05-10T10:00:00.000Z");
    const returned = returnTaskForReviewInState(
      submitted,
      submitted.tasks[0].id,
      "验收口径缺少异常场景。",
      "member_owner",
      "2026-05-10T11:00:00.000Z",
    );
    expect(returned.tasks[0]).toMatchObject({
      status: "in_progress",
      progressPercent: 99,
      reviewReturnedAt: "2026-05-10T11:00:00.000Z",
      reviewReturnedByMemberId: "member_owner",
      reviewReturnReason: "验收口径缺少异常场景。",
    });
    expect(returned.tasks[0].completedAt).toBeUndefined();
  });
});
