import { describe, expect, it } from "vitest";
import {
  buildInsights,
  coachSteps,
  deriveRewardState,
  estimateDeltaLabel,
  focusQuality,
  interruptionHotspots,
  nextActions,
  pauseTimer,
  planPressure,
  restoreTimer,
  resumeTimer,
  suggestedCapacity,
  taskSuggestions,
  computeStreak,
} from "./domain";
import { todayKey } from "./seed";
import { createInitialState, iso } from "./test/fixtures";
import {
  endSessionInState,
  ensureTodayPlan,
  finishExpiredTimerInState,
  getTodayPlan,
  removeTaskFromTodayInState,
  shouldFinishExpiredTimerInState,
  startTimerInState,
  toggleTimerInState,
} from "./appModel";
import { addTaskToTodayInState } from "./workSessionTransitions";
import { buildCsvBundle, createBackupSnapshot, mergeImportedState, summarizeImportPayload } from "./dataPortability";
import { calendarSummaries, filteredStateForReport, instantiateTemplate, parseQuickInput, reviewSummary } from "./planning";
import { normalizeAppStatePayload } from "./storage";
import { mergeRowsIntoState, type SyncRow } from "./sync";
import {
  acceptTaskInState,
  addProjectMemberToState,
  assignTaskInState,
  createProjectInState,
  reorderProjectsInState,
  returnTaskForReviewInState,
  submitTaskForReviewInState,
  updateProjectMemberInState,
  updateTaskProgressInState,
} from "./teamProgress";
import { buildProjectOverviewTaskBoard, createProjectTaskInState, deriveProjectDetailModel, filterProjectTasks, projectAccessForCurrentMember, projectTasksForProject } from "./projectDetail";
import { resolveMemberIdForProject } from "./memberIdentity";
import {
  buildMyProjectTaskCards,
  buildProjectOverviewCards,
  filterTodayCommittedTasksForMember,
  filterMyTasksByProjectSelection,
  quickAddProjectIdForSelection,
} from "./projectOverview";
import { bindAccountToMembers } from "./authModel";
import type { ActiveTimer, AppState, FocusSession, ProjectMember, Task, TaskTemplate } from "./types";

describe("timer domain", () => {
  it("restores an expired running timer without opening settlement", () => {
    const timer: ActiveTimer = {
      sessionId: "session_1",
      mode: "focus",
      duration: 1500,
      remaining: 1500,
      isRunning: true,
      startedAt: iso("2026-05-10T08:00:00Z"),
      plannedEndAt: iso("2026-05-10T08:25:00Z"),
      totalPausedSeconds: 0,
      cycleIndex: 1,
      strictStarted: true,
    };
    const restored = restoreTimer(timer, new Date("2026-05-10T08:30:00Z"));
    expect(restored).toMatchObject({
      remaining: 0,
      isRunning: false,
    });
    expect(restored?.pendingSettlement).toBeUndefined();
  });

  it("finishes an expired active timer through the app model", () => {
    const state = createInitialState();
    const taskId = state.tasks[0].id;
    const started = startTimerInState(
      state,
      "focus",
      taskId,
      `${todayKey()}T08:00:00.000Z`,
      undefined,
      "session_expired_model",
    );
    const timestamp = `${todayKey()}T08:30:00.000Z`;

    expect(shouldFinishExpiredTimerInState(started, timestamp)).toBe(true);

    const finished = finishExpiredTimerInState(started, timestamp);
    const finishedTask = finished.tasks.find((task) => task.id === taskId);
    const finishedSession = finished.focusSessions.find((session) => session.id === "session_expired_model");
    const workSession = finished.workSessions.find((session) => session.focusSessionId === "session_expired_model");

    expect(finished.activeTimer).toBeUndefined();
    expect(finishedTask?.actualPomodoros).toBe(1);
    expect(finishedTask?.status).toBe("in_progress");
    expect(finishedSession?.outcome).toBe("completed");
    expect(workSession?.status).toBe("ended");
  });

  it("extends planned end time after pause and resume", () => {
    const timer: ActiveTimer = {
      sessionId: "session_1",
      mode: "focus",
      duration: 1500,
      remaining: 1200,
      isRunning: true,
      startedAt: iso("2026-05-10T08:00:00Z"),
      plannedEndAt: iso("2026-05-10T08:25:00Z"),
      totalPausedSeconds: 0,
      cycleIndex: 1,
      strictStarted: false,
    };
    const paused = pauseTimer(timer, iso("2026-05-10T08:05:00Z"));
    const resumed = resumeTimer(paused, iso("2026-05-10T08:07:00Z"));
    expect(resumed.isRunning).toBe(true);
    expect(resumed.totalPausedSeconds).toBe(120);
    expect(new Date(resumed.plannedEndAt).getTime()).toBe(new Date("2026-05-10T08:27:00Z").getTime());
  });

  it("records work session execution signals around a focus timer", () => {
    const state = createInitialState();
    const taskId = state.tasks[0].id;
    const started = startTimerInState(
      state,
      "focus",
      taskId,
      "2026-05-10T08:00:00.000Z",
      undefined,
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

  it("adds a focused task to today's queue when starting work", () => {
    const state = createInitialState();
    const taskId = state.tasks[1].id;
    const initialPlan = getTodayPlan(state);
    const withoutTaskInToday: AppState = {
      ...state,
      tasks: state.tasks.map((task) => (task.id === taskId ? { ...task, status: "pool" as const } : task)),
      dailyPlans: state.dailyPlans.some((plan) => plan.id === initialPlan.id)
        ? state.dailyPlans.map((plan) => (plan.id === initialPlan.id ? { ...plan, committedTaskIds: [] } : plan))
        : [{ ...initialPlan, committedTaskIds: [] }],
    };

    const started = startTimerInState(
      withoutTaskInToday,
      "focus",
      taskId,
      "2026-05-10T08:00:00.000Z",
      undefined,
      "session_queue_start",
    );

    expect(getTodayPlan(started).committedTaskIds).toContain(taskId);
    expect(started.tasks.find((task) => task.id === taskId)).toMatchObject({ status: "in_progress" });
    expect(started.workSessions[0]).toMatchObject({ taskId, status: "active" });
  });

  it("claims an unassigned task for the current member when starting focus", () => {
    const state = createInitialState();
    const taskId = state.tasks[3].id;
    const started = startTimerInState(
      state,
      "focus",
      taskId,
      "2026-05-10T08:00:00.000Z",
      undefined,
      "session_claim_unassigned",
    );

    expect(started.tasks.find((task) => task.id === taskId)).toMatchObject({
      primaryExecutorMemberId: "member_owner",
      status: "in_progress",
    });
    expect(started.workSessions[0]).toMatchObject({
      taskId,
      executorMemberId: "member_owner",
    });
  });

  it("claims an unassigned task for the current member when adding it to today's queue", () => {
    const state = createInitialState();
    const taskId = state.tasks[3].id;

    const queued = addTaskToTodayInState(state, taskId, "2026-05-10T08:00:00.000Z");

    expect(getTodayPlan(queued).committedTaskIds).toContain(taskId);
    expect(queued.tasks.find((task) => task.id === taskId)).toMatchObject({
      primaryExecutorMemberId: "member_owner",
      status: "committed",
    });
  });

  it("claims a cross-project unassigned task with the current account's project member", () => {
    const state = createInitialState();
    const withSecondProject = createProjectInState(
      state,
      "图像识别",
      "第二项目",
      "2026-05-10T09:00:00.000Z",
      (prefix) => `${prefix}_queue_claim`,
      { accountId: "account_owner", name: "项目负责人", email: "owner@example.com" },
    );
    const secondMember = withSecondProject.projectMembers.find((member) => member.projectId === "project_queue_claim")!;
    const task: Task = {
      ...state.tasks[3],
      id: "queue_cross_project_unassigned",
      projectId: "project_queue_claim",
      project: "图像识别",
      primaryExecutorMemberId: undefined,
      collaboratorMemberIds: [],
      status: "pool",
    };

    const queued = addTaskToTodayInState(
      { ...withSecondProject, tasks: [task] },
      task.id,
      "2026-05-10T09:10:00.000Z",
    );

    expect(queued.tasks.find((item) => item.id === task.id)?.primaryExecutorMemberId).toBe(secondMember.id);
  });

  it("ends active work sessions when removing a task from today's queue", () => {
    const state = createInitialState();
    const taskId = state.tasks[0].id;
    const started = startTimerInState(
      state,
      "focus",
      taskId,
      "2026-05-10T08:00:00.000Z",
      undefined,
      "session_remove_today",
    );

    const removed = removeTaskFromTodayInState(started, taskId, "2026-05-10T08:12:00.000Z");

    expect(getTodayPlan(removed).committedTaskIds).not.toContain(taskId);
    expect(removed.activeTimer).toBeUndefined();
    expect(removed.workSessions.find((session) => session.taskId === taskId)).toMatchObject({
      status: "ended",
      endedAt: "2026-05-10T08:12:00.000Z",
    });
    expect(removed.executionSignals[0]).toMatchObject({
      taskId,
      type: "work_ended",
      payload: expect.objectContaining({ reason: "removed_from_today" }),
    });
  });

  it("repairs active work sessions that are missing from today's queue", () => {
    const state = createInitialState();
    const taskId = state.tasks[0].id;
    const started = startTimerInState(
      state,
      "focus",
      taskId,
      `${todayKey()}T08:00:00.000Z`,
      undefined,
      "session_repair_today",
    );
    const inconsistent: AppState = {
      ...started,
      dailyPlans: started.dailyPlans.map((plan) =>
        plan.date === todayKey() ? { ...plan, committedTaskIds: [] } : plan,
      ),
    };

    const repaired = ensureTodayPlan(inconsistent);

    expect(getTodayPlan(repaired).committedTaskIds).toContain(taskId);
  });

  it("repairs a focus active timer that is missing its work session", () => {
    const state = createInitialState();
    const taskId = state.tasks[0].id;
    const started = startTimerInState(
      state,
      "focus",
      taskId,
      `${todayKey()}T08:00:00.000Z`,
      undefined,
      "session_missing_work_session",
    );
    const inconsistent: AppState = {
      ...started,
      workSessions: [],
      executionSignals: [],
      activeTimer: started.activeTimer ? { ...started.activeTimer, workSessionId: undefined } : undefined,
    };

    const repaired = ensureTodayPlan(inconsistent);

    expect(repaired.activeTimer?.workSessionId).toBeDefined();
    expect(repaired.workSessions[0]).toMatchObject({
      taskId,
      focusSessionId: "session_missing_work_session",
      status: "active",
    });
    expect(repaired.executionSignals[0]).toMatchObject({
      taskId,
      type: "work_started",
      payload: expect.objectContaining({ source: "active_timer_repair" }),
    });
  });

  it("ends a cross-day active timer even when its work session is missing", () => {
    const state = createInitialState();
    const taskId = state.tasks[0].id;
    const yesterday = new Date(`${todayKey()}T00:00:00.000Z`);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const yesterdayKey = yesterday.toISOString().slice(0, 10);
    const inconsistent: AppState = {
      ...state,
      tasks: state.tasks.map((task) => (task.id === taskId ? { ...task, status: "in_progress" as const } : task)),
      workSessions: [],
      executionSignals: [],
      activeTimer: {
        sessionId: "session_missing_cross_day",
        taskId,
        mode: "focus",
        duration: 1500,
        remaining: 600,
        isRunning: true,
        startedAt: `${yesterdayKey}T23:40:00.000Z`,
        plannedEndAt: `${yesterdayKey}T23:55:00.000Z`,
        totalPausedSeconds: 0,
        cycleIndex: 1,
        strictStarted: false,
      },
    };

    const repaired = ensureTodayPlan(inconsistent);

    expect(repaired.activeTimer).toBeUndefined();
    expect(repaired.workSessions[0]).toMatchObject({
      taskId,
      focusSessionId: "session_missing_cross_day",
      status: "ended",
    });
    expect(repaired.executionSignals.map((signal) => signal.type).slice(0, 2)).toEqual(["work_ended", "work_started"]);
  });

  it("marks project detail tasks active from the local active timer even before work session repair", () => {
    const state = createInitialState();
    const projectId = state.projects[0].id;
    const taskId = state.tasks[0].id;
    const started = startTimerInState(
      state,
      "focus",
      taskId,
      `${todayKey()}T08:00:00.000Z`,
      undefined,
      "session_project_active_timer",
    );
    const inconsistent: AppState = {
      ...started,
      workSessions: [],
    };

    const model = deriveProjectDetailModel(inconsistent, projectId, {
      query: "",
      status: "all",
      executor: "all",
      priority: "all",
      sort: "status",
    });

    expect(model?.activeProjectTaskIds).toContain(taskId);
  });

  it("does not mark pending-review project tasks active from stale runtime state", () => {
    const state = createInitialState();
    const projectId = state.projects[0].id;
    const taskId = state.tasks[0].id;
    const started = startTimerInState(
      state,
      "focus",
      taskId,
      `${todayKey()}T08:00:00.000Z`,
      undefined,
      "session_pending_review_runtime",
    );
    const inconsistent: AppState = {
      ...started,
      tasks: started.tasks.map((task) => task.id === taskId ? { ...task, status: "pending_review" as const } : task),
    };

    const model = deriveProjectDetailModel(inconsistent, projectId, {
      query: "",
      status: "all",
      executor: "all",
      priority: "all",
      sort: "status",
    });

    expect(model?.activeProjectTaskIds).not.toContain(taskId);
  });

  it("does not mark completed project tasks active from stale runtime state", () => {
    const state = createInitialState();
    const projectId = state.projects[0].id;
    const taskId = state.tasks[0].id;
    const started = startTimerInState(
      state,
      "focus",
      taskId,
      `${todayKey()}T08:00:00.000Z`,
      undefined,
      "session_completed_runtime",
    );
    const inconsistent: AppState = {
      ...started,
      tasks: started.tasks.map((task) => task.id === taskId ? { ...task, status: "completed" as const } : task),
    };

    const model = deriveProjectDetailModel(inconsistent, projectId, {
      query: "",
      status: "all",
      executor: "all",
      priority: "all",
      sort: "status",
    });

    expect(model?.activeProjectTaskIds).not.toContain(taskId);
  });

  it("ends stale active work sessions instead of adding them to today's queue", () => {
    const state = createInitialState();
    const taskId = state.tasks[0].id;
    const yesterday = new Date(new Date(`${todayKey()}T08:00:00.000Z`).getTime() - 24 * 60 * 60 * 1000).toISOString();
    const stale: AppState = {
      ...state,
      workSessions: [
        {
          id: "work_stale_today_queue",
          taskId,
          executorMemberId: "member_owner",
          focusSessionId: "session_stale_today_queue",
          status: "active",
          startedAt: yesterday,
          totalPausedSeconds: 0,
          createdAt: yesterday,
          updatedAt: yesterday,
        },
      ],
      focusSessions: [
        {
          id: "session_stale_today_queue",
          taskId,
          mode: "focus",
          duration: 1500,
          startedAt: yesterday,
          interruptionCounts: { internal: 0, external: 0 },
        },
      ],
      dailyPlans: state.dailyPlans.map((plan) => (plan.date === todayKey() ? { ...plan, committedTaskIds: [] } : plan)),
    };

    const repaired = ensureTodayPlan(stale);

    expect(getTodayPlan(repaired).committedTaskIds).not.toContain(taskId);
    expect(repaired.workSessions[0]).toMatchObject({ status: "ended" });
    expect(repaired.executionSignals[0]).toMatchObject({
      taskId,
      type: "work_ended",
      payload: expect.objectContaining({ reason: "stale_active_session" }),
    });
  });

  it("enforces one active work session per executor when starting work", () => {
    const state = createInitialState();
    const firstTaskId = state.tasks[0].id;
    const secondTaskId = state.tasks[1].id;
    const started = startTimerInState(
      state,
      "focus",
      firstTaskId,
      "2026-05-10T08:00:00.000Z",
      undefined,
      "session_first",
    );

    const duplicateStart = startTimerInState(
      started,
      "focus",
      firstTaskId,
      "2026-05-10T08:02:00.000Z",
      undefined,
      "session_duplicate",
    );
    expect(duplicateStart.workSessions.filter((session) => session.status === "active")).toHaveLength(1);
    expect(duplicateStart.focusSessions).toHaveLength(1);

    const switched = startTimerInState(
      duplicateStart,
      "focus",
      secondTaskId,
      "2026-05-10T08:05:00.000Z",
      undefined,
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
      undefined,
      "session_paused_first",
    );
    const paused = toggleTimerInState(started, "2026-05-10T08:03:00.000Z");

    const switched = startTimerInState(
      paused,
      "focus",
      secondTaskId,
      "2026-05-10T08:05:00.000Z",
      undefined,
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
