import { describe, expect, it } from "vitest";
import {
  buildInsights,
  buildProgressBoard,
  coachSteps,
  deriveRewardState,
  estimateDeltaLabel,
  expectedStartForTask,
  focusQuality,
  generateRecurringTask,
  interruptionHotspots,
  nextActions,
  pauseTimer,
  planPressure,
  restoreTimer,
  resumeTimer,
  stalledTaskRisks,
  suggestedCapacity,
  taskSuggestions,
  computeStreak,
} from "./domain";
import { createInitialState as createEmptyInitialState, todayKey } from "./seed";
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
  deleteTeamMemberInState,
  reorderProjectsInState,
  returnTaskForReviewInState,
  submitTaskForReviewInState,
  updateProjectMemberInState,
  updateTeamMemberInState,
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
import type { ActiveTimer, AppState, DailyPlan, FocusSession, ProjectMember, Task, TaskTemplate } from "./types";

const iso = (value: string) => new Date(value).toISOString();

const createInitialState = (): AppState => {
  const state = createEmptyInitialState();
  const now = `${todayKey()}T08:00:00.000Z`;
  const tasks: Task[] = [
    {
      id: "task_write_prd",
      title: "整理时间管理系统 PRD",
      notes: "测试任务备注。",
      tags: ["方法论", "产品"],
      projectId: "project_starter",
      project: "TimeManage",
      creatorMemberId: "member_owner",
      primaryExecutorMemberId: "member_owner",
      collaboratorMemberIds: [],
      progressPercent: 0,
      progressNote: "",
      priority: "urgent",
      severity: "high",
      stage: "requirements",
      estimatePomodoros: 3,
      status: "committed",
      dueAt: iso("2026-05-10T18:00:00Z"),
      repeatRule: "none",
      subtasks: [],
      sortOrder: 10,
      actualPomodoros: 0,
      estimateHistory: [],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "task_block_apps",
      title: "配置分心源屏蔽清单",
      notes: "测试任务备注。",
      tags: ["严格模式", "Apple"],
      projectId: "project_starter",
      project: "自律系统",
      creatorMemberId: "member_owner",
      primaryExecutorMemberId: "member_owner",
      collaboratorMemberIds: [],
      progressPercent: 0,
      progressNote: "",
      priority: "high",
      severity: "very_high",
      stage: "development",
      estimatePomodoros: 2,
      status: "committed",
      repeatRule: "none",
      subtasks: [],
      sortOrder: 20,
      actualPomodoros: 0,
      estimateHistory: [],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "task_report_model",
      title: "设计番茄报表指标",
      notes: "测试任务备注。",
      tags: ["报表", "复盘"],
      projectId: "project_starter",
      project: "TimeManage",
      creatorMemberId: "member_owner",
      primaryExecutorMemberId: "member_owner",
      collaboratorMemberIds: [],
      progressPercent: 0,
      progressNote: "",
      priority: "medium",
      severity: "medium",
      stage: "design",
      estimatePomodoros: 5,
      status: "pool",
      repeatRule: "none",
      subtasks: [],
      sortOrder: 30,
      actualPomodoros: 0,
      estimateHistory: [],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "task_split_large",
      title: "拆分移动端严格模式实现",
      notes: "测试任务备注。",
      tags: ["iOS", "技术"],
      projectId: "project_starter",
      project: "原生插件",
      creatorMemberId: "member_owner",
      collaboratorMemberIds: [],
      progressPercent: 0,
      progressNote: "",
      priority: "medium",
      severity: "high",
      stage: "development",
      estimatePomodoros: 8,
      status: "pool",
      repeatRule: "none",
      subtasks: [],
      sortOrder: 40,
      actualPomodoros: 0,
      estimateHistory: [],
      createdAt: now,
      updatedAt: now,
    },
  ];
  const dailyPlan: DailyPlan = {
    id: "plan_test_today",
    date: todayKey(),
    capacityPomodoros: 8,
    committedTaskIds: ["task_write_prd", "task_block_apps"],
    completedPomodoros: 0,
    suggestedTaskIds: ["task_report_model", "task_split_large"],
    reflection: "",
    review: {
      mood: "normal",
      wins: "",
      blockers: "",
      interruptionPattern: "",
      tomorrowFocus: "",
    },
    createdAt: now,
    updatedAt: now,
  };
  return { ...state, tasks, dailyPlans: [dailyPlan], updatedAt: now };
};

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
      { ...withSecondProject, currentMemberId: "member_owner", tasks: [task] },
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

describe("planning and rewards", () => {
  it("reduces suggested capacity after a high interruption day", () => {
    const state = createInitialState();
    const today = todayKey();
    const next: AppState = {
      ...state,
      dailyPlans: [
        ...state.dailyPlans,
        ...Array.from({ length: 7 }, (_, index) => ({
          ...state.dailyPlans[0],
          id: `history_${index}`,
          date: todayKey(new Date(Date.UTC(2026, 4, index + 1))),
          completedPomodoros: 6,
        })),
      ],
      interruptions: Array.from({ length: 4 }, (_, index) => ({
        id: `interrupt_${index}`,
        type: "internal" as const,
        action: "defer" as const,
        note: "想刷消息",
        createdAt: `${today}T10:0${index}:00.000Z`,
      })),
    };
    expect(suggestedCapacity(next, today)).toBeLessThanOrEqual(5);
  });

  it("earns focus, review and streak badges from state", () => {
    const state = createInitialState();
    const session: FocusSession = {
      id: "session_done",
      taskId: state.tasks[0].id,
      mode: "focus",
      duration: 1500,
      startedAt: `${todayKey()}T08:00:00.000Z`,
      endedAt: `${todayKey()}T08:25:00.000Z`,
      outcome: "completed",
      interruptionCounts: { internal: 0, external: 0 },
    };
    const next = {
      ...state,
      focusSessions: [session],
      dailyPlans: state.dailyPlans.map((plan) => ({ ...plan, completedPomodoros: state.rewardState.dailyGoal, reviewedAt: `${todayKey()}T21:00:00.000Z` })),
    };
    const reward = deriveRewardState(next);
    expect(reward.streak).toBeGreaterThanOrEqual(1);
    expect(reward.badges).toContain("首个番茄");
    expect(reward.badges).toContain("完成日终回顾");
  });

  it("generates the next recurring task into the pool", () => {
    const state = createInitialState();
    const source = { ...state.tasks[1], repeatRule: "daily" as const, completedAt: `${todayKey()}T09:00:00.000Z` };
    const next = generateRecurringTask(source, `${todayKey()}T09:05:00.000Z`);
    expect(next).toMatchObject({
      status: "pool",
      recurrenceParentId: source.id,
      actualPomodoros: 0,
    });
    expect(next?.id).not.toBe(source.id);
  });

  it("generates weekday and after-completion recurring tasks", () => {
    const state = createInitialState();
    const weekdaySource = {
      ...state.tasks[0],
      repeatRule: "weekdays" as const,
      repeatWeekdays: [1, 2, 3, 4, 5],
      dueAt: "2026-05-15T09:00:00.000Z",
    };
    const weekdayNext = generateRecurringTask(weekdaySource, "2026-05-15T10:00:00.000Z");
    expect(new Date(weekdayNext!.dueAt!).getDay()).toBe(1);

    const afterSource = {
      ...state.tasks[0],
      repeatRule: "after_completion" as const,
      repeatIntervalDays: 3,
      dueAt: "2026-05-01T09:00:00.000Z",
    };
    const afterNext = generateRecurringTask(afterSource, "2026-05-10T10:00:00.000Z");
    expect(afterNext?.dueAt?.slice(0, 10)).toBe("2026-05-13");
  });

  it("builds actionable insights", () => {
    const state = createInitialState();
    const insights = buildInsights(state);
    expect(insights.some((item) => item.kind === "capacity")).toBe(true);
    expect(insights.some((item) => item.kind === "commitment")).toBe(true);
  });

  it("calculates coach steps from current progress", () => {
    const state = createInitialState();
    const steps = coachSteps(state);
    expect(steps.find((step) => step.id === "create_task")?.completed).toBe(true);
    expect(steps.find((step) => step.id === "commit_task")?.completed).toBe(true);
    expect(steps.find((step) => step.id === "start_focus")?.completed).toBe(false);
  });

  it("scores plan pressure and task suggestions", () => {
    const state = createInitialState();
    const pressure = planPressure(state, state.dailyPlans[0]);
    expect(pressure.level).toBe("light");
    const suggestions = taskSuggestions(state);
    expect(suggestions.some((item) => item.action === "split")).toBe(true);
    expect(suggestions[0].score).toBeGreaterThanOrEqual(suggestions[suggestions.length - 1]?.score ?? 0);
  });

  it("formats estimate deltas for humans", () => {
    expect(estimateDeltaLabel(3, 5)).toBe("低估 2 个番茄");
    expect(estimateDeltaLabel(5, 3)).toBe("高估 2 个番茄");
    expect(estimateDeltaLabel(4, 4)).toBe("估算准确");
  });

  it("does not reset streak while today is still in progress", () => {
    const state = createInitialState();
    const yesterday = todayKey(new Date(Date.now() - 86_400_000));
    const next: AppState = {
      ...state,
      dailyPlans: [
        { ...state.dailyPlans[0], completedPomodoros: 1 },
        { ...state.dailyPlans[0], id: "yesterday", date: yesterday, completedPomodoros: state.rewardState.dailyGoal },
      ],
    };
    expect(computeStreak(next)).toBe(1);
  });

  it("summarizes focus quality, interruption hotspots, and next actions", () => {
    const state = createInitialState();
    const today = todayKey();
    const next: AppState = {
      ...state,
      interruptions: [
        { id: "i1", type: "internal", action: "defer", note: "想刷消息", createdAt: `${today}T10:05:00.000+08:00` },
        { id: "i2", type: "external", action: "inbox", note: "临时会议", createdAt: `${today}T10:25:00.000+08:00` },
      ],
    };
    expect(focusQuality(next, today).score).toBeLessThan(100);
    expect(interruptionHotspots(next)[0]).toMatchObject({ hour: 10, count: 2, internal: 1, external: 1 });
    expect(nextActions(next, today).some((item) => item.id === "clear_inbox")).toBe(true);
  });
});

describe("team progress risk detection", () => {
  it("derives expected start from project default and task override", () => {
    const state = createInitialState();
    const task = {
      ...state.tasks[0],
      expectedStartAt: undefined,
      createdAt: "2026-05-10T08:00:00.000Z",
    };
    const withProjectRule: AppState = {
      ...state,
      projects: state.projects.map((project) => ({ ...project, defaultExpectedStartHours: 4 })),
      tasks: [task],
    };
    expect(expectedStartForTask(withProjectRule, task)).toBe("2026-05-10T12:00:00.000Z");

    const overrideTask = { ...task, expectedStartAt: "2026-05-10T09:30:00.000Z" };
    expect(expectedStartForTask(withProjectRule, overrideTask)).toBe("2026-05-10T09:30:00.000Z");
  });

  it("surfaces assigned tasks that have not started after expected start", () => {
    const state = createInitialState();
    const task = {
      ...state.tasks[0],
      id: "risk_not_started",
      status: "pool" as const,
      createdAt: "2026-05-10T08:00:00.000Z",
      updatedAt: "2026-05-10T08:00:00.000Z",
      expectedStartAt: undefined,
    };
    const next: AppState = {
      ...state,
      projects: state.projects.map((project) => ({ ...project, defaultExpectedStartHours: 2 })),
      tasks: [task],
      workSessions: [],
      executionSignals: [],
    };
    const risks = stalledTaskRisks(next, new Date("2026-05-10T11:00:00.000Z"));
    expect(risks).toEqual([
      expect.objectContaining({
        taskId: "risk_not_started",
        kind: "not_started",
        expectedStartAt: "2026-05-10T10:00:00.000Z",
      }),
    ]);
  });

  it("surfaces in-progress tasks with stale execution signals separately", () => {
    const state = createInitialState();
    const task = {
      ...state.tasks[0],
      id: "risk_stale_started",
      status: "in_progress" as const,
      progressPercent: 40,
      progressNote: "完成了前置设计，等待联调。",
      createdAt: "2026-05-10T06:00:00.000Z",
      updatedAt: "2026-05-10T08:30:00.000Z",
      expectedStartAt: undefined,
      expectedFinishAt: "2026-05-12T18:00:00.000Z",
    };
    const next: AppState = {
      ...state,
      projects: state.projects.map((project) => ({ ...project, defaultExpectedStartHours: 1 })),
      tasks: [task],
      workSessions: [
        {
          id: "work_stale",
          taskId: task.id,
          executorMemberId: "member_owner",
          focusSessionId: "focus_stale",
          status: "ended",
          startedAt: "2026-05-10T08:00:00.000Z",
          endedAt: "2026-05-10T08:30:00.000Z",
          totalPausedSeconds: 0,
          createdAt: "2026-05-10T08:00:00.000Z",
          updatedAt: "2026-05-10T08:30:00.000Z",
        },
      ],
      executionSignals: [
        {
          id: "signal_stale",
          workSessionId: "work_stale",
          taskId: task.id,
          executorMemberId: "member_owner",
          type: "work_ended",
          createdAt: "2026-05-10T08:30:00.000Z",
        },
      ],
    };
    const risks = stalledTaskRisks(next, new Date("2026-05-11T10:00:00.000Z"));
    expect(risks).toEqual([
      expect.objectContaining({
        taskId: "risk_stale_started",
        kind: "started_stale",
        latestSignalAt: "2026-05-10T08:30:00.000Z",
      }),
    ]);
  });
});

describe("progress board", () => {
  it("calculates weighted project progress and active work sessions", () => {
    const state = createInitialState();
    const projectId = state.projects[0].id;
    const weightedTask = {
      ...state.tasks[0],
      id: "board_weighted",
      projectId,
      estimatePomodoros: 3,
      progressPercent: 50,
      status: "in_progress" as const,
      expectedFinishAt: "2026-05-12T18:00:00.000Z",
    };
    const smallTask = {
      ...state.tasks[1],
      id: "board_small",
      projectId,
      estimatePomodoros: 1,
      progressPercent: 100,
      status: "pending_review" as const,
    };
    const next: AppState = {
      ...state,
      tasks: [weightedTask, smallTask],
      workSessions: [
        {
          id: "board_work_active",
          taskId: weightedTask.id,
          executorMemberId: "member_owner",
          focusSessionId: "board_focus_active",
          status: "active",
          startedAt: "2026-05-10T08:00:00.000Z",
          totalPausedSeconds: 0,
          createdAt: "2026-05-10T08:00:00.000Z",
          updatedAt: "2026-05-10T08:00:00.000Z",
        },
      ],
    };
    const board = buildProgressBoard(next, projectId, new Date("2026-05-10T09:30:00.000Z"));
    expect(board.projectProgress).toBe(63);
    expect(board.activeSessions[0]).toMatchObject({
      workSessionId: "board_work_active",
      taskId: "board_weighted",
      executorName: "项目负责人",
      elapsedSeconds: 5400,
    });
  });

  it("orders risk-first sections before normal work", () => {
    const state = createInitialState();
    const projectId = state.projects[0].id;
    const base = state.tasks[0];
    const tasks = [
      { ...base, id: "risk_assigned", title: "已分配未开始", projectId, status: "pool" as const, progressPercent: 0, createdAt: "2026-05-10T08:00:00.000Z" },
      { ...base, id: "risk_stalled", title: "停滞任务", projectId, status: "in_progress" as const, progressPercent: 20, createdAt: "2026-05-10T08:00:00.000Z", updatedAt: "2026-05-10T09:00:00.000Z" },
      { ...base, id: "risk_blocked", title: "阻塞任务", projectId, status: "in_progress" as const, progressPercent: 30, progressNote: "被外部接口阻塞", createdAt: "2026-05-10T08:00:00.000Z", updatedAt: "2026-05-11T09:00:00.000Z" },
      { ...base, id: "risk_review", title: "待验收任务", projectId, status: "pending_review" as const, progressPercent: 100 },
      { ...base, id: "risk_near_finish", title: "临近完成任务", projectId, status: "in_progress" as const, progressPercent: 80, expectedFinishAt: "2026-05-11T12:00:00.000Z" },
      { ...base, id: "normal_work", title: "正常工作", projectId, status: "in_progress" as const, progressPercent: 20 },
    ];
    const next: AppState = {
      ...state,
      tasks,
      workSessions: [
        { id: "work_stalled", taskId: "risk_stalled", executorMemberId: "member_owner", focusSessionId: "focus_stalled", status: "ended", startedAt: "2026-05-10T08:00:00.000Z", endedAt: "2026-05-10T09:00:00.000Z", totalPausedSeconds: 0, createdAt: "2026-05-10T08:00:00.000Z", updatedAt: "2026-05-10T09:00:00.000Z" },
        { id: "work_blocked", taskId: "risk_blocked", executorMemberId: "member_owner", focusSessionId: "focus_blocked", status: "ended", startedAt: "2026-05-11T08:00:00.000Z", endedAt: "2026-05-11T09:00:00.000Z", totalPausedSeconds: 0, createdAt: "2026-05-11T08:00:00.000Z", updatedAt: "2026-05-11T09:00:00.000Z" },
        { id: "work_near", taskId: "risk_near_finish", executorMemberId: "member_owner", focusSessionId: "focus_near", status: "ended", startedAt: "2026-05-11T08:00:00.000Z", endedAt: "2026-05-11T09:00:00.000Z", totalPausedSeconds: 0, createdAt: "2026-05-11T08:00:00.000Z", updatedAt: "2026-05-11T09:00:00.000Z" },
        { id: "work_normal", taskId: "normal_work", executorMemberId: "member_owner", focusSessionId: "focus_normal", status: "ended", startedAt: "2026-05-11T08:00:00.000Z", endedAt: "2026-05-11T09:00:00.000Z", totalPausedSeconds: 0, createdAt: "2026-05-11T08:00:00.000Z", updatedAt: "2026-05-11T09:00:00.000Z" },
      ],
      executionSignals: [
        { id: "signal_stalled", workSessionId: "work_stalled", taskId: "risk_stalled", executorMemberId: "member_owner", type: "work_ended", createdAt: "2026-05-10T09:00:00.000Z" },
        { id: "signal_blocked", workSessionId: "work_blocked", taskId: "risk_blocked", executorMemberId: "member_owner", type: "work_ended", createdAt: "2026-05-11T09:00:00.000Z" },
        { id: "signal_near", workSessionId: "work_near", taskId: "risk_near_finish", executorMemberId: "member_owner", type: "work_ended", createdAt: "2026-05-11T09:00:00.000Z" },
        { id: "signal_normal", workSessionId: "work_normal", taskId: "normal_work", executorMemberId: "member_owner", type: "work_ended", createdAt: "2026-05-11T09:00:00.000Z" },
      ],
    };
    const board = buildProgressBoard(next, projectId, new Date("2026-05-11T10:00:00.000Z"));
    expect(board.sections.map((section) => section.kind)).toEqual([
      "assigned_not_started",
      "stalled",
      "blocked",
      "pending_review",
      "near_finish",
      "normal",
    ]);
    expect(board.sections.map((section) => section.tasks[0]?.taskId)).toEqual([
      "risk_assigned",
      "risk_stalled",
      "risk_blocked",
      "risk_review",
      "risk_near_finish",
      "normal_work",
    ]);
  });

  it("builds project overview cards with project-scoped counts and archived tasks", () => {
    const state = createInitialState();
    const firstProjectId = state.projects[0].id;
    const withSecondProject = createProjectInState(
      state,
      "第二项目",
      "用于验证卡片隔离",
      "2026-05-10T09:00:00.000Z",
      (prefix) => `${prefix}_second_card`,
    );
    const next: AppState = {
      ...withSecondProject,
      tasks: [
        { ...state.tasks[0], id: "card_first_archived", projectId: firstProjectId, status: "archived" },
        { ...state.tasks[1], id: "card_first_review", projectId: firstProjectId, status: "pending_review", progressPercent: 100 },
        { ...state.tasks[2], id: "card_second_progress", projectId: "project_second_card", status: "in_progress", progressPercent: 40 },
      ],
      projectMembers: [
        ...withSecondProject.projectMembers,
        {
          id: "member_disabled_card",
          projectId: firstProjectId,
          name: "停用成员",
          roles: ["executor"],
          status: "disabled",
          createdAt: "2026-05-10T09:00:00.000Z",
          updatedAt: "2026-05-10T09:00:00.000Z",
        },
      ],
    };

    const cards = buildProjectOverviewCards(next);
    const first = cards.find((card) => card.projectId === firstProjectId);
    const second = cards.find((card) => card.projectId === "project_second_card");

    expect(first).toMatchObject({
      taskCount: 2,
      memberCount: 1,
      pendingReviewCount: 1,
      statusCounts: expect.objectContaining({ archived: 1, pending_review: 1 }),
    });
    expect(second).toMatchObject({
      taskCount: 1,
      inProgressCount: 1,
      statusCounts: expect.objectContaining({ in_progress: 1, archived: 0 }),
    });
  });

  it("keeps project overview cards in persisted sort order", () => {
    const state = createInitialState();
    const withSecondProject = createProjectInState(
      state,
      "图像识别",
      "yolo识别",
      iso("2026-05-11T08:00:00Z"),
      (prefix) => `${prefix}_overview_order`,
      { accountId: "account_owner", name: "项目负责人", email: "owner@example.com" },
    );
    const reordered: AppState = {
      ...withSecondProject,
      projects: withSecondProject.projects.map((project) =>
        project.id === "project_overview_order"
          ? { ...project, sortOrder: 0, updatedAt: iso("2026-05-11T08:00:00Z") }
          : { ...project, sortOrder: 1000, updatedAt: iso("2026-05-12T08:00:00Z") },
      ),
    };

    expect(buildProjectOverviewCards(reordered).map((card) => card.projectId)).toEqual([
      "project_overview_order",
      state.projects[0].id,
    ]);
  });

  it("stores dragged project overview order on projects", () => {
    const state = createInitialState();
    const withSecondProject = createProjectInState(
      state,
      "图像识别",
      "yolo识别",
      iso("2026-05-11T08:00:00Z"),
      (prefix) => `${prefix}_drag_order`,
      { accountId: "account_owner", name: "项目负责人", email: "owner@example.com" },
    );
    const reordered = reorderProjectsInState(
      withSecondProject,
      ["project_drag_order", state.projects[0].id],
      iso("2026-05-12T08:00:00Z"),
    );

    expect(reordered.projects.find((project) => project.id === "project_drag_order")?.sortOrder).toBe(0);
    expect(reordered.projects.find((project) => project.id === state.projects[0].id)?.sortOrder).toBe(1000);
    expect(buildProjectOverviewCards(reordered).map((card) => card.projectId)).toEqual([
      "project_drag_order",
      state.projects[0].id,
    ]);
  });

  it("builds the project detail overview board from pooled work and member today work groups", () => {
    const state = createInitialState();
    const projectId = state.projects[0].id;
    const owner = state.projectMembers.find((member) => member.id === "member_owner");
    const reviewer = {
      ...owner!,
      id: "member_reviewer_overview",
      name: "协作者",
      roles: owner!.roles,
    };
    const baseTask = state.tasks[0];
    const tasks = [
      { ...baseTask, id: "overview_pool", projectId, status: "pool" as const, sortOrder: 1 },
      { ...baseTask, id: "overview_committed", projectId, status: "committed" as const, sortOrder: 2 },
      { ...baseTask, id: "overview_active", projectId, status: "in_progress" as const, primaryExecutorMemberId: owner?.id, sortOrder: 3 },
      { ...baseTask, id: "overview_other_running", projectId, status: "in_progress" as const, primaryExecutorMemberId: reviewer.id, sortOrder: 4 },
      { ...baseTask, id: "overview_unassigned", projectId, status: "in_progress" as const, primaryExecutorMemberId: undefined, sortOrder: 5 },
      { ...baseTask, id: "overview_review", projectId, status: "pending_review" as const, sortOrder: 6 },
      { ...baseTask, id: "overview_split", projectId, status: "split" as const, sortOrder: 7 },
      { ...baseTask, id: "overview_archived", projectId, status: "archived" as const, sortOrder: 8 },
    ];

    const idleMember: ProjectMember = {
      ...reviewer,
      id: "member_idle",
      name: "空闲成员",
      roles: ["executor"],
    };
    const board = buildProjectOverviewTaskBoard(
      tasks,
      [owner!, reviewer, idleMember],
      "overview_active",
      ["overview_active", "overview_committed", "overview_other_running", "overview_unassigned"],
    );

    expect(board.poolTasks.map((task) => task.id)).toEqual(["overview_pool", "overview_committed"]);
    expect(board.pendingReviewTasks.map((task) => task.id)).toEqual(["overview_review"]);
    expect(board.inProgressTasks.map((task) => task.id)).toEqual(["overview_active", "overview_other_running", "overview_unassigned"]);
    expect(board.todayWorkGroups.map((group) => ({
      memberName: group.memberName,
      taskIds: group.tasks.map((task) => task.id),
      hasActiveTask: group.hasActiveTask,
    }))).toEqual([
      { memberName: "项目负责人", taskIds: ["overview_active", "overview_committed"], hasActiveTask: true },
      { memberName: "协作者", taskIds: ["overview_other_running"], hasActiveTask: false },
      { memberName: "未分配", taskIds: ["overview_unassigned"], hasActiveTask: false },
      { memberName: "空闲成员", taskIds: [], hasActiveTask: false },
    ]);
  });

  it("shows active project work even when it is missing from the current user's daily plan", () => {
    const state = createInitialState();
    const projectId = state.projects[0].id;
    const owner = state.projectMembers.find((member) => member.id === "member_owner")!;
    const baseTask = state.tasks[0];
    const tasks = [
      { ...baseTask, id: "not_today_committed", projectId, status: "committed" as const, primaryExecutorMemberId: owner.id, sortOrder: 1 },
      { ...baseTask, id: "not_today_running", projectId, status: "in_progress" as const, primaryExecutorMemberId: owner.id, sortOrder: 2 },
    ];

    const board = buildProjectOverviewTaskBoard(tasks, [owner], "not_today_running", []);

    expect(board.poolTasks.map((task) => task.id)).toEqual(["not_today_committed"]);
    expect(board.inProgressTasks.map((task) => task.id)).toEqual(["not_today_running"]);
    expect(board.todayWorkGroups).toEqual([
      {
        memberId: owner.id,
        memberName: owner.name,
        tasks: [tasks[1]],
        hasActiveTask: true,
      },
    ]);
  });

  it("sorts accepted project detail tasks by newest review acceptance", () => {
    const state = createInitialState();
    const projectId = state.projects[0].id;
    const baseTask = state.tasks[0];
    const acceptedOld = {
      ...baseTask,
      id: "accepted_old",
      projectId,
      status: "completed" as const,
      reviewAcceptedAt: "2026-05-10T09:00:00.000Z",
      completedAt: "2026-05-10T09:00:00.000Z",
    };
    const acceptedNew = {
      ...baseTask,
      id: "accepted_new",
      projectId,
      status: "completed" as const,
      reviewAcceptedAt: "2026-05-10T11:00:00.000Z",
      completedAt: "2026-05-10T11:00:00.000Z",
    };
    const manuallyCompleted = {
      ...baseTask,
      id: "manual_done",
      projectId,
      status: "completed" as const,
      reviewAcceptedAt: undefined,
      completedAt: "2026-05-10T12:00:00.000Z",
    };
    const model = deriveProjectDetailModel(
      { ...state, tasks: [manuallyCompleted, acceptedOld, acceptedNew, ...state.tasks] },
      projectId,
      { query: "", status: "all", executor: "all", priority: "all", sort: "status" },
      todayKey(),
    );

    expect(model?.overviewTasks.map((task) => task.id)).not.toContain("accepted_new");
    expect(model?.overviewTasks.map((task) => task.id)).not.toContain("accepted_old");
    expect(model?.overviewTasks.map((task) => task.id)).not.toContain("manual_done");
    expect(model?.acceptedTasks.map((task) => task.id)).toEqual(["accepted_new", "accepted_old"]);
  });

  it("builds my project task cards from active participations only", () => {
    const state = createInitialState();
    const firstProjectId = state.projects[0].id;
    const withSecondProject = createProjectInState(
      state,
      "第二项目",
      "同一账号参与的另一个项目",
      "2026-05-10T09:00:00.000Z",
      (prefix) => `${prefix}_my_card`,
      { accountId: "account_owner", name: "项目负责人", email: "owner@example.com" },
    );
    const secondMember = withSecondProject.projectMembers.find((member) => member.projectId === "project_my_card");
    const currentMember = withSecondProject.projectMembers.find((member) => member.id === "member_owner");
    const next: AppState = {
      ...withSecondProject,
      currentMemberId: "member_owner",
      tasks: [
        { ...state.tasks[0], id: "my_first_committed", projectId: firstProjectId, status: "committed", primaryExecutorMemberId: "member_owner" },
        { ...state.tasks[1], id: "my_first_done", projectId: firstProjectId, status: "completed", primaryExecutorMemberId: "member_owner" },
        { ...state.tasks[2], id: "my_second_progress", projectId: "project_my_card", project: "第二项目", status: "in_progress", primaryExecutorMemberId: secondMember?.id },
        { ...state.tasks[3], id: "other_second_pool", projectId: "project_my_card", project: "第二项目", status: "pool", primaryExecutorMemberId: "member_other" },
      ],
      projectMembers: [
        ...withSecondProject.projectMembers,
        {
          id: "member_disabled_participation",
          projectId: "project_disabled",
          teamMemberId: "team_member_owner",
          accountId: "account_owner",
          name: "停用成员",
          roles: ["executor"],
          status: "disabled",
          createdAt: "2026-05-10T09:00:00.000Z",
          updatedAt: "2026-05-10T09:00:00.000Z",
        },
      ],
    };

    const cards = buildMyProjectTaskCards(next, currentMember);

    expect(cards.map((card) => card.projectId).sort()).toEqual([firstProjectId, "project_my_card"].sort());
    expect(cards.find((card) => card.projectId === firstProjectId)).toMatchObject({
      myTaskCount: 1,
      committedCount: 1,
    });
    expect(cards.find((card) => card.projectId === "project_my_card")).toMatchObject({
      myTaskCount: 1,
      inProgressCount: 1,
    });
    expect(cards.some((card) => card.projectId === "project_disabled")).toBe(false);
  });

  it("filters today committed tasks to the current member for the focus todo list", () => {
    const state = createInitialState();
    const owner = state.projectMembers.find((member) => member.id === "member_owner")!;
    const teammate: ProjectMember = {
      ...owner,
      id: "member_teammate",
      teamMemberId: "team_member_teammate",
      accountId: "account_teammate",
      name: "胡圣杰",
      email: "husj",
      roles: ["executor"],
    };
    const ownerTask = {
      ...state.tasks[0],
      id: "today_owner_task",
      primaryExecutorMemberId: owner.id,
      collaboratorMemberIds: [],
      status: "committed" as const,
    };
    const teammateTask = {
      ...state.tasks[1],
      id: "today_teammate_task",
      primaryExecutorMemberId: teammate.id,
      collaboratorMemberIds: [],
      status: "committed" as const,
    };
    const unassignedTask = {
      ...state.tasks[2],
      id: "today_unassigned_task",
      primaryExecutorMemberId: undefined,
      collaboratorMemberIds: [],
      status: "committed" as const,
    };
    const next: AppState = {
      ...state,
      currentMemberId: owner.id,
      projectMembers: [...state.projectMembers, teammate],
      tasks: [ownerTask, teammateTask, unassignedTask],
      dailyPlans: [
        {
          ...getTodayPlan(state),
          committedTaskIds: [ownerTask.id, teammateTask.id, unassignedTask.id],
        },
      ],
    };

    const committedTasks = next.dailyPlans[0].committedTaskIds
      .map((id) => next.tasks.find((task) => task.id === id))
      .filter((task): task is Task => Boolean(task));

    expect(filterTodayCommittedTasksForMember(next, committedTasks, owner).map((task) => task.id)).toEqual([ownerTask.id]);
  });

  it("keeps old unassigned committed tasks visible only for the member who has worked on them", () => {
    const state = createInitialState();
    const owner = state.projectMembers.find((member) => member.id === "member_owner")!;
    const teammate: ProjectMember = {
      ...owner,
      id: "member_teammate",
      teamMemberId: "team_member_teammate",
      accountId: "account_teammate",
      name: "王硕",
      email: "wangshuo@example.com",
      roles: ["executor"],
    };
    const unassignedTask = {
      ...state.tasks[0],
      id: "today_worked_unassigned_task",
      primaryExecutorMemberId: undefined,
      collaboratorMemberIds: [],
      status: "in_progress" as const,
    };
    const next: AppState = {
      ...state,
      projectMembers: [...state.projectMembers, teammate],
      tasks: [unassignedTask],
      workSessions: [
        {
          id: "work_session_owner_unassigned",
          taskId: unassignedTask.id,
          executorMemberId: owner.id,
          focusSessionId: "focus_owner_unassigned",
          status: "ended",
          startedAt: "2026-05-10T09:00:00.000Z",
          endedAt: "2026-05-10T09:25:00.000Z",
          totalPausedSeconds: 0,
          createdAt: "2026-05-10T09:00:00.000Z",
          updatedAt: "2026-05-10T09:25:00.000Z",
        },
      ],
      dailyPlans: [
        {
          ...getTodayPlan(state),
          committedTaskIds: [unassignedTask.id],
        },
      ],
    };
    const committedTasks = next.dailyPlans[0].committedTaskIds
      .map((id) => next.tasks.find((task) => task.id === id))
      .filter((task): task is Task => Boolean(task));

    expect(filterTodayCommittedTasksForMember(next, committedTasks, owner).map((task) => task.id)).toEqual([unassignedTask.id]);
    expect(filterTodayCommittedTasksForMember(next, committedTasks, teammate).map((task) => task.id)).toEqual([]);
  });

  it("keeps focus tasks visible after login binds same-email executor memberships", () => {
    const state = createInitialState();
    const firstProjectId = state.projects[0].id;
    const withSecondProject = createProjectInState(
      state,
      "图像识别",
      "第二项目",
      "2026-05-10T09:00:00.000Z",
      (prefix) => `${prefix}_login_bind`,
    );
    const secondMember = withSecondProject.projectMembers.find((member) => member.projectId === "project_login_bind")!;
    const todayPlan = getTodayPlan(withSecondProject);
    const firstTask = {
      ...state.tasks[0],
      id: "login_bind_first",
      projectId: firstProjectId,
      project: "TimeManage",
      primaryExecutorMemberId: undefined,
      collaboratorMemberIds: [],
      status: "committed" as const,
    };
    const secondTask = {
      ...state.tasks[1],
      id: "login_bind_second",
      projectId: "project_login_bind",
      project: "图像识别",
      primaryExecutorMemberId: secondMember.id,
      collaboratorMemberIds: [],
      status: "committed" as const,
    };
    const loggedIn = bindAccountToMembers(
      {
        ...withSecondProject,
        currentMemberId: "member_owner",
        projectMembers: withSecondProject.projectMembers.map((member) =>
          member.projectId === "project_login_bind"
            ? {
                ...member,
                accountId: undefined,
                teamMemberId: undefined,
                email: "owner@example.com",
                roles: ["executor"],
              }
            : member,
        ),
        tasks: [firstTask, secondTask],
        dailyPlans: [{ ...todayPlan, committedTaskIds: [firstTask.id, secondTask.id] }],
      },
      {
        status: "authenticated",
        token: "login_bind_token",
        bootstrapped: true,
        message: "已登录",
        account: {
          id: "account_owner",
          workspaceId: "workspace_test",
          name: "项目负责人",
          email: "owner@example.com",
          createdAt: "2026-05-10T09:00:00.000Z",
          updatedAt: "2026-05-10T09:00:00.000Z",
        },
      },
      "2026-05-10T09:10:00.000Z",
    );
    const currentMember = loggedIn.projectMembers.find((member) => member.id === loggedIn.currentMemberId);
    const committedTasks = loggedIn.dailyPlans[0].committedTaskIds
      .map((id) => loggedIn.tasks.find((task) => task.id === id))
      .filter((task): task is Task => Boolean(task));

    expect(loggedIn.projectMembers.find((member) => member.id === secondMember.id)).toMatchObject({
      accountId: "account_owner",
      teamMemberId: "team_member_owner",
    });
    expect(filterTodayCommittedTasksForMember(loggedIn, committedTasks, currentMember).map((task) => task.id)).toEqual([secondTask.id]);
  });

  it("does not bind a stale selected project member to a different authenticated account", () => {
    const state = createInitialState();
    const staleMember: ProjectMember = {
      ...state.projectMembers[0],
      id: "member_stale_selected",
      teamMemberId: undefined,
      accountId: undefined,
      name: "王硕",
      email: undefined,
      roles: ["project_owner", "executor"],
    };
    const loggedIn = bindAccountToMembers(
      {
        ...state,
        currentMemberId: staleMember.id,
        projectMembers: [staleMember, ...state.projectMembers],
      },
      {
        status: "authenticated",
        token: "stale_bind_token",
        bootstrapped: true,
        message: "已登录",
        account: {
          id: "account_hushengjie",
          workspaceId: "workspace_test",
          name: "胡圣杰",
          email: "hushengjie@example.com",
          createdAt: "2026-05-10T09:00:00.000Z",
          updatedAt: "2026-05-10T09:00:00.000Z",
        },
      },
      "2026-05-10T09:10:00.000Z",
    );

    expect(loggedIn.projectMembers.find((member) => member.id === staleMember.id)?.accountId).toBeUndefined();
    expect(loggedIn.currentMemberId).toBeUndefined();
  });

  it("does not create a team member just because an account logged in", () => {
    const state = createInitialState();
    const loggedIn = bindAccountToMembers(
      {
        ...state,
        currentMemberId: undefined,
        teamMembers: [],
        projectMembers: [],
      },
      {
        status: "authenticated",
        token: "no_member_token",
        bootstrapped: true,
        message: "已登录",
        account: {
          id: "account_no_member",
          workspaceId: "workspace_test",
          name: "仅登录账号",
          email: "account-only@example.com",
          createdAt: "2026-05-10T09:00:00.000Z",
          updatedAt: "2026-05-10T09:00:00.000Z",
        },
      },
      "2026-05-10T09:10:00.000Z",
    );

    expect(loggedIn.teamMembers).toEqual([]);
    expect(loggedIn.currentMemberId).toBeUndefined();
  });

  it("clears sync retry backoff when binding an authenticated account", () => {
    const state = createInitialState();
    const loggedIn = bindAccountToMembers(
      {
        ...state,
        sync: {
          ...state.sync,
          enabled: true,
          autoSync: false,
          status: "error",
          retryCount: 3,
          nextRetryAt: "2026-05-10T10:00:00.000Z",
        },
      },
      {
        status: "authenticated",
        token: "retry_clear_token",
        bootstrapped: true,
        message: "已登录",
        account: {
          id: "account_owner",
          workspaceId: "workspace_test",
          name: "项目负责人",
          email: "owner@example.com",
          createdAt: "2026-05-10T09:00:00.000Z",
          updatedAt: "2026-05-10T09:00:00.000Z",
        },
      },
      "2026-05-10T09:10:00.000Z",
    );

    expect(loggedIn.sync).toMatchObject({
      enabled: true,
      autoSync: true,
      status: "idle",
      retryCount: 0,
      nextRetryAt: undefined,
    });
  });

  it("filters my tasks by selected projects and derives single quick-add project", () => {
    const state = createInitialState();
    const firstProjectId = state.projects[0].id;
    const withSecondProject = createProjectInState(
      state,
      "第二项目",
      "用于验证项目多选过滤",
      "2026-05-10T09:00:00.000Z",
      (prefix) => `${prefix}_filter_card`,
      { accountId: "account_owner", name: "项目负责人", email: "owner@example.com" },
    );
    const secondMember = withSecondProject.projectMembers.find((member) => member.projectId === "project_filter_card");
    const currentMember = withSecondProject.projectMembers.find((member) => member.id === "member_owner");
    const next: AppState = {
      ...withSecondProject,
      currentMemberId: "member_owner",
      tasks: [
        { ...state.tasks[0], id: "selected_first", projectId: firstProjectId, status: "committed", primaryExecutorMemberId: "member_owner" },
        { ...state.tasks[1], id: "selected_second", projectId: "project_filter_card", project: "第二项目", status: "pool", primaryExecutorMemberId: secondMember?.id },
        { ...state.tasks[2], id: "selected_unassigned", projectId: "project_filter_card", project: "第二项目", status: "pool", primaryExecutorMemberId: undefined, collaboratorMemberIds: [] },
        { ...state.tasks[1], id: "selected_split_parent", projectId: "project_filter_card", project: "第二项目", status: "split", primaryExecutorMemberId: secondMember?.id },
        { ...state.tasks[2], id: "selected_archived", projectId: "project_filter_card", project: "第二项目", status: "archived", primaryExecutorMemberId: secondMember?.id },
        { ...state.tasks[3], id: "selected_other_member", projectId: "project_filter_card", project: "第二项目", status: "pool", primaryExecutorMemberId: "member_other" },
      ],
    };

    expect(filterMyTasksByProjectSelection(next, currentMember, [firstProjectId]).map((task) => task.id)).toEqual(["selected_first"]);
    expect(filterMyTasksByProjectSelection(next, currentMember, ["project_filter_card"]).map((task) => task.id)).toEqual(["selected_second"]);
    expect(filterMyTasksByProjectSelection(next, currentMember, []).map((task) => task.id)).toEqual(["selected_first", "selected_second"]);
    expect(quickAddProjectIdForSelection([firstProjectId])).toBe(firstProjectId);
    expect(quickAddProjectIdForSelection([firstProjectId, "project_filter_card"])).toBeUndefined();
  });

  it("keeps split parent tasks out of execution lists while preserving project traceability", () => {
    const state = createInitialState();
    const projectId = state.projects[0].id;
    const currentMember = state.projectMembers.find((member) => member.id === state.currentMemberId);
    const next: AppState = {
      ...state,
      tasks: [
        { ...state.tasks[0], id: "split_parent", projectId, status: "split", primaryExecutorMemberId: currentMember?.id },
        { ...state.tasks[1], id: "split_child", projectId, status: "pool", primaryExecutorMemberId: currentMember?.id },
      ],
    };

    expect(filterMyTasksByProjectSelection(next, currentMember, []).map((task) => task.id)).toEqual(["split_child"]);
    expect(buildProjectOverviewCards(next)[0].statusCounts.split).toBe(1);
    expect(buildProgressBoard(next, projectId).sections.flatMap((section) => section.tasks).some((task) => task.taskId === "split_parent")).toBe(false);
    expect(filterProjectTasks(next.tasks, {
      query: "",
      status: "all",
      executor: "all",
      priority: "all",
      sort: "status",
    }).map((task) => task.id)).toEqual(["split_child"]);
    expect(filterProjectTasks(next.tasks, {
      query: "",
      status: "split",
      executor: "all",
      priority: "all",
      sort: "status",
    }).map((task) => task.id)).toEqual(["split_parent"]);
  });
});

describe("data portability and long planning", () => {
  it("restores archived split parents as visible split tasks during normalization", () => {
    const state = createInitialState();
    const parent = {
      ...state.tasks[0],
      id: "legacy_split_parent",
      title: "旧拆分主任务",
      status: "archived" as const,
      projectId: state.projects[0].id,
    };
    const child = {
      ...state.tasks[1],
      id: "legacy_split_child",
      title: "旧拆分主任务 1",
      notes: "由「旧拆分主任务」拆分而来。",
      projectId: state.projects[0].id,
    };

    const normalized = normalizeAppStatePayload({ ...state, tasks: [parent, child] });

    expect(normalized.tasks.find((task) => task.id === "legacy_split_parent")?.status).toBe("split");
  });

  it("returns only one project's tasks and includes archived tasks by default", () => {
    const state = createInitialState();
    const firstProjectId = state.projects[0].id;
    const withSecondProject = createProjectInState(
      state,
      "第二项目",
      "",
      "2026-05-10T09:00:00.000Z",
      (prefix) => `${prefix}_second`,
    );
    const withFirstTask = createProjectTaskInState(
      withSecondProject,
      firstProjectId,
      { title: "当前项目归档任务" },
      "2026-05-10T10:00:00.000Z",
      (prefix) => `${prefix}_first`,
    );
    const withArchivedFirstTask = {
      ...withFirstTask,
      tasks: withFirstTask.tasks.map((task) =>
        task.id === "task_first" ? { ...task, status: "archived" as const } : task,
      ),
    };
    const withOtherTask = createProjectTaskInState(
      withArchivedFirstTask,
      "project_second",
      { title: "其他项目任务" },
      "2026-05-10T11:00:00.000Z",
      (prefix) => `${prefix}_other`,
    );

    const tasks = projectTasksForProject(withOtherTask, firstProjectId);

    expect(tasks.every((task) => task.projectId === firstProjectId)).toBe(true);
    expect(tasks.some((task) => task.title === "当前项目归档任务" && task.status === "archived")).toBe(true);
    expect(tasks.some((task) => task.title === "其他项目任务")).toBe(false);
  });

  it("creates project detail tasks in the current project", () => {
    const state = createInitialState();
    const project = state.projects[0];
    const next = createProjectTaskInState(
      state,
      project.id,
      { title: "项目详情页新任务", estimatePomodoros: 3 },
      "2026-05-10T10:00:00.000Z",
      (prefix) => `${prefix}_detail`,
    );

    expect(next.tasks[0]).toMatchObject({
      id: "task_detail",
      title: "项目详情页新任务",
      projectId: project.id,
      project: project.name,
      estimatePomodoros: 3,
      status: "pool",
    });
  });

  it("converts project detail estimate hours to pomodoros when creating tasks", () => {
    const baseState = createInitialState();
    const state = { ...baseState, settings: { ...baseState.settings, focusMinutes: 25 } };
    const project = state.projects[0];
    const next = createProjectTaskInState(
      state,
      project.id,
      { title: "小时估算任务", estimateHours: 1 },
      "2026-05-10T10:00:00.000Z",
      (prefix) => `${prefix}_hours`,
    );

    expect(next.tasks[0]).toMatchObject({
      id: "task_hours",
      title: "小时估算任务",
      estimatePomodoros: 3,
    });
  });

  it("creates project detail tasks with full planning and collaboration fields", () => {
    const state = createInitialState();
    const project = state.projects[0];
    const next = createProjectTaskInState(
      state,
      project.id,
      {
        title: "完整字段任务",
        notes: "补充说明",
        tags: ["需求", "前端"],
        priority: "high",
        severity: "very_high",
        stage: "development",
        estimatePomodoros: 5,
        primaryExecutorMemberId: "member_owner",
        collaboratorMemberIds: ["member_executor", "member_owner"],
        expectedStartAt: "2026-05-10T10:00:00.000Z",
        expectedFinishAt: "2026-05-11T10:00:00.000Z",
        dueAt: "2026-05-12T10:00:00.000Z",
        reminderAt: "2026-05-12T09:00:00.000Z",
        repeatRule: "interval",
        repeatIntervalDays: 3,
        subtasks: ["拆第一步", "拆第二步"],
      },
      "2026-05-10T09:00:00.000Z",
      (prefix) => `${prefix}_full`,
    );

    expect(next.tasks[0]).toMatchObject({
      id: "task_full",
      title: "完整字段任务",
      notes: "补充说明",
      tags: ["需求", "前端"],
      priority: "high",
      severity: "very_high",
      stage: "development",
      estimatePomodoros: 5,
      primaryExecutorMemberId: "member_owner",
      collaboratorMemberIds: ["member_executor"],
      expectedStartAt: "2026-05-10T10:00:00.000Z",
      expectedFinishAt: "2026-05-11T10:00:00.000Z",
      dueAt: "2026-05-12T10:00:00.000Z",
      reminderAt: "2026-05-12T09:00:00.000Z",
      repeatRule: "interval",
      repeatIntervalDays: 3,
    });
    expect(next.tasks[0].subtasks.map((subtask) => subtask.title)).toEqual(["拆第一步", "拆第二步"]);
  });

  it("allows every account to view and manage project workspaces", () => {
    const state = createInitialState();
    const projectId = state.projects[0].id;
    const ownerAccess = projectAccessForCurrentMember(state, projectId);
    const withMember = addProjectMemberToState(
      state,
      projectId,
      "普通成员",
      "member@example.com",
      ["executor"],
      "2026-05-10T10:00:00.000Z",
      (prefix) => `${prefix}_member`,
    );
    const memberAccess = projectAccessForCurrentMember({ ...withMember, currentMemberId: "member_member" }, projectId);
    const nonMemberAccess = projectAccessForCurrentMember({ ...withMember, currentMemberId: "missing_member" }, projectId);
    const withSecondProject = createProjectInState(
      state,
      "同账号项目",
      "",
      "2026-05-10T11:00:00.000Z",
      (prefix) => `${prefix}_account`,
    );
    const accountScopedState: AppState = {
      ...withSecondProject,
      auth: {
        ...withSecondProject.auth,
        account: {
          id: "account_owner",
          workspaceId: "workspace_test",
          name: "负责人",
          email: "owner@example.com",
          createdAt: "2026-05-10T10:00:00.000Z",
          updatedAt: "2026-05-10T10:00:00.000Z",
        },
      },
      projectMembers: withSecondProject.projectMembers.map((member) =>
        member.projectId === "project_account" ? { ...member, accountId: "account_owner" } : member,
      ),
    };
    const accountAccess = projectAccessForCurrentMember(accountScopedState, "project_account");
    const emailScopedState: AppState = {
      ...accountScopedState,
      projectMembers: accountScopedState.projectMembers.map((member) =>
        member.projectId === "project_account" ? { ...member, accountId: undefined, teamMemberId: undefined, email: "owner@example.com" } : member,
      ),
    };
    const emailAccess = projectAccessForCurrentMember(emailScopedState, "project_account");

    expect(ownerAccess).toMatchObject({ canView: true, canEditTasks: true, canReviewTasks: true });
    expect(memberAccess).toMatchObject({ canView: true, canEditTasks: true, canReviewTasks: true });
    expect(nonMemberAccess).toMatchObject({ canView: true, canEditTasks: true, canReviewTasks: true });
    expect(accountAccess).toMatchObject({ canView: true, canEditTasks: true, canReviewTasks: true });
    expect(emailAccess).toMatchObject({ canView: true, canEditTasks: true, canReviewTasks: true });
  });

  it("creates projects with a project owner who can also execute work", () => {
    const state = createInitialState();
    const next = createProjectInState(
      state,
      "客户交付项目",
      "跟进客户上线",
      "2026-05-10T10:00:00.000Z",
      (prefix) => `${prefix}_test`,
    );
    expect(next.projects[0]).toMatchObject({
      id: "project_test",
      name: "客户交付项目",
      defaultExpectedStartHours: 24,
    });
    expect(next.projectMembers[0]).toMatchObject({
      id: "member_test",
      projectId: "project_test",
      roles: ["project_owner", "executor"],
    });
  });

  it("adds and updates project members with project-scoped roles", () => {
    const state = createInitialState();
    const projectId = state.projects[0].id;
    const withMember = addProjectMemberToState(
      state,
      projectId,
      "张三",
      "zhangsan@example.com",
      ["executor", "project_owner", "executor"],
      "2026-05-10T10:00:00.000Z",
      (prefix) => `${prefix}_zhangsan`,
    );
    expect(withMember.projectMembers[0]).toMatchObject({
      id: "member_zhangsan",
      projectId,
      name: "张三",
      roles: ["executor", "project_owner"],
    });
    const updated = updateProjectMemberInState(
      withMember,
      { ...withMember.projectMembers[0], roles: [] },
      "2026-05-10T11:00:00.000Z",
    );
    expect(updated.projectMembers[0].roles).toEqual(["executor"]);
  });

  it("updates team member profile data across project bindings", () => {
    const state = createInitialState();
    const teamMember = state.teamMembers[0];
    const updated = updateTeamMemberInState(
      state,
      { ...teamMember, name: "负责人 A", email: "owner-a@example.com" },
      "2026-05-10T11:00:00.000Z",
    );

    expect(updated.teamMembers.find((member) => member.id === teamMember.id)).toMatchObject({
      name: "负责人 A",
      email: "owner-a@example.com",
      updatedAt: "2026-05-10T11:00:00.000Z",
    });
    expect(updated.projectMembers.filter((member) => member.teamMemberId === teamMember.id)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "负责人 A",
          email: "owner-a@example.com",
          updatedAt: "2026-05-10T11:00:00.000Z",
        }),
      ]),
    );
    expect(updated.updatedAt).toBe("2026-05-10T11:00:00.000Z");
  });

  it("deletes a team member and clears project task assignments", () => {
    const state = createInitialState();
    const deleted = deleteTeamMemberInState(state, "team_member_owner", "2026-05-10T11:00:00.000Z");

    expect(deleted.teamMembers.some((member) => member.id === "team_member_owner")).toBe(false);
    expect(deleted.projectMembers.some((member) => member.teamMemberId === "team_member_owner")).toBe(false);
    expect(deleted.tasks[0]).toMatchObject({
      creatorMemberId: undefined,
      primaryExecutorMemberId: undefined,
      collaboratorMemberIds: [],
      updatedAt: "2026-05-10T11:00:00.000Z",
    });
    expect(deleted.sync.tombstones).toEqual(
      expect.arrayContaining([
        { entity: "team_member", id: "team_member_owner", deletedAt: "2026-05-10T11:00:00.000Z" },
        { entity: "project_member", id: "member_owner", deletedAt: "2026-05-10T11:00:00.000Z" },
      ]),
    );
  });

  it("assigns a task to one primary executor and keeps collaborators separate", () => {
    const state = createInitialState();
    const projectId = state.projects[0].id;
    const withMembers = addProjectMemberToState(
      addProjectMemberToState(
        state,
        projectId,
        "张三",
        "",
        ["executor"],
        "2026-05-10T10:00:00.000Z",
        (prefix) => `${prefix}_zhangsan`,
      ),
      projectId,
      "李四",
      "",
      ["executor"],
      "2026-05-10T10:00:00.000Z",
      (prefix) => `${prefix}_lisi`,
    );
    const assigned = assignTaskInState(withMembers, withMembers.tasks[0].id, {
      primaryExecutorMemberId: "member_zhangsan",
      collaboratorMemberIds: ["member_zhangsan", "member_lisi"],
    }, "2026-05-10T11:00:00.000Z");
    expect(assigned.tasks[0].primaryExecutorMemberId).toBe("member_zhangsan");
    expect(assigned.tasks[0].collaboratorMemberIds).toEqual(["member_lisi"]);

    const reassigned = assignTaskInState(assigned, assigned.tasks[0].id, {
      primaryExecutorMemberId: "member_lisi",
      collaboratorMemberIds: ["member_zhangsan", "member_lisi"],
    }, "2026-05-10T12:00:00.000Z");
    expect(reassigned.tasks[0].primaryExecutorMemberId).toBe("member_lisi");
    expect(reassigned.tasks[0].collaboratorMemberIds).toEqual(["member_zhangsan"]);
  });

  it("leaves a task unassigned when the selected member is not an executor", () => {
    const state = createInitialState();
    const projectId = state.projects[0].id;
    const withOwnerOnly = addProjectMemberToState(
      state,
      projectId,
      "只负责验收的人",
      "",
      ["project_owner"],
      "2026-05-10T10:00:00.000Z",
      (prefix) => `${prefix}_owner_only`,
    );
    const assigned = assignTaskInState(withOwnerOnly, withOwnerOnly.tasks[0].id, {
      primaryExecutorMemberId: "member_owner_only",
      collaboratorMemberIds: ["member_owner_only"],
    });
    expect(assigned.tasks[0].primaryExecutorMemberId).toBeUndefined();
    expect(assigned.tasks[0].collaboratorMemberIds).toEqual(["member_owner_only"]);
  });

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

  it("creates and reviews tasks with the authenticated project member when currentMemberId is stale", () => {
    const state = createInitialState();
    const owner = state.projectMembers[0];
    const teammate: ProjectMember = {
      ...owner,
      id: "member_teammate",
      teamMemberId: "team_member_teammate",
      accountId: "account_teammate",
      name: "王硕",
      email: "wangshuo@example.com",
      roles: ["executor"],
    };
    const loggedInState: AppState = {
      ...state,
      currentMemberId: teammate.id,
      auth: {
        ...state.auth,
        status: "authenticated",
        account: {
          id: owner.accountId!,
          workspaceId: "workspace_test",
          name: owner.name,
          email: owner.email!,
          createdAt: "2026-05-10T09:00:00.000Z",
          updatedAt: "2026-05-10T09:00:00.000Z",
        },
      },
      projectMembers: [teammate, owner],
    };
    const actorMemberId = resolveMemberIdForProject(loggedInState, owner.projectId);
    const created = createProjectTaskInState(
      loggedInState,
      owner.projectId,
      { title: "登录人创建的任务" },
      "2026-05-10T10:00:00.000Z",
      (prefix) => `${prefix}_identity_create`,
    );
    const taskId = created.tasks[0].id;
    const committed = {
      ...created,
      tasks: created.tasks.map((task) => (task.id === taskId ? { ...task, status: "in_progress" as const } : task)),
    };
    const submitted = submitTaskForReviewInState(committed, taskId, actorMemberId, "2026-05-10T11:00:00.000Z");
    const accepted = acceptTaskInState(submitted, taskId, actorMemberId, "2026-05-10T12:00:00.000Z");

    expect(created.tasks[0].creatorMemberId).toBe(owner.id);
    expect(submitted.tasks[0].reviewSubmittedByMemberId).toBe(owner.id);
    expect(accepted.tasks[0].reviewAcceptedByMemberId).toBe(owner.id);
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
      undefined,
      "session_pending_review",
    );

    expect(started.activeTimer).toBeUndefined();
    expect(started.tasks[0].status).toBe("pending_review");
    expect(started.workSessions).toHaveLength(0);
  });

  it("claims unassigned tasks for the authenticated account instead of a stale current member", () => {
    const state = createInitialState();
    const owner = state.projectMembers[0];
    const teammate: ProjectMember = {
      ...owner,
      id: "member_teammate",
      teamMemberId: "team_member_teammate",
      accountId: "account_teammate",
      name: "王硕",
      email: "wangshuo@example.com",
      roles: ["executor"],
    };
    const taskId = state.tasks[0].id;
    const loggedInState: AppState = {
      ...state,
      currentMemberId: teammate.id,
      auth: {
        ...state.auth,
        status: "authenticated",
        account: {
          id: owner.accountId!,
          workspaceId: "workspace_test",
          name: owner.name,
          email: owner.email!,
          createdAt: "2026-05-10T09:00:00.000Z",
          updatedAt: "2026-05-10T09:00:00.000Z",
        },
      },
      projectMembers: [teammate, owner],
      tasks: state.tasks.map((task, index) =>
        index === 0
          ? { ...task, primaryExecutorMemberId: undefined, collaboratorMemberIds: [], status: "pool" as const }
          : task,
      ),
    };

    const started = startTimerInState(
      loggedInState,
      "focus",
      taskId,
      "2026-05-10T10:00:00.000Z",
      undefined,
      "session_identity_claim",
    );

    expect(started.tasks.find((task) => task.id === taskId)?.primaryExecutorMemberId).toBe(owner.id);
    expect(started.workSessions.find((session) => session.taskId === taskId)?.executorMemberId).toBe(owner.id);
  });

  it("ends active work when submitting an in-progress task for review", () => {
    const state = createInitialState();
    const taskId = state.tasks[0].id;
    const started = startTimerInState(
      state,
      "focus",
      taskId,
      "2026-05-10T10:00:00.000Z",
      undefined,
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

  it("migrates legacy personal task data into a starter project", () => {
    const legacy = {
      version: 1,
      tasks: [
        {
          id: "legacy_task",
          title: "旧任务",
          notes: "",
          tags: [],
          project: "旧项目标签",
          priority: "medium" as const,
          severity: "medium" as const,
          estimatePomodoros: 1,
          status: "pool" as const,
          subtasks: [],
          sortOrder: 10,
          actualPomodoros: 0,
          estimateHistory: [],
          createdAt: "2026-05-10T10:00:00.000Z",
          updatedAt: "2026-05-10T10:00:00.000Z",
        },
      ],
    };
    const migrated = normalizeAppStatePayload(legacy);
    expect(migrated.projects[0]).toMatchObject({ id: "project_starter" });
    expect(migrated.projectMembers[0].roles).toEqual(["project_owner", "executor"]);
    expect(migrated.currentMemberId).toBe(migrated.projectMembers[0].id);
    expect(migrated.tasks[0]).toMatchObject({
      id: "legacy_task",
      project: "旧项目标签",
      projectId: migrated.projects[0].id,
      collaboratorMemberIds: [],
      progressPercent: 0,
      progressNote: "",
    });
  });

  it("normalizes imported data into team progress state", () => {
    const state = createInitialState();
    const backup = createBackupSnapshot(state, "before_import", "2026-05-10T10:00:00.000Z");
    const imported = mergeImportedState(
      state,
      {
        version: 1,
        tasks: [
          {
            ...state.tasks[0],
            id: "imported_legacy_task",
            projectId: undefined,
            progressPercent: 150,
            progressNote: "导入前已经完成大部分。",
          },
        ],
      },
      backup,
    );
    expect(imported.projects.length).toBeGreaterThan(0);
    expect(imported.tasks[0].projectId).toBe(imported.projects[0].id);
    expect(imported.tasks[0].progressPercent).toBe(100);
    expect(imported.tasks[0].progressNote).toBe("导入前已经完成大部分。");
    expect(imported.backupSnapshots[0]).toMatchObject({ reason: "before_import" });
  });

  it("deduplicates team members by login identity during normalization", () => {
    const state = createInitialState();
    const normalized = normalizeAppStatePayload({
      ...state,
      teamMembers: [
        { ...state.teamMembers[0], id: "team_member_bound", email: "owner@example.com", updatedAt: "2026-05-10T10:00:00.000Z" },
        { ...state.teamMembers[0], id: "team_member_duplicate", email: "owner@example.com", updatedAt: "2026-05-10T11:00:00.000Z" },
      ],
      projectMembers: state.projectMembers.map((member) => ({ ...member, teamMemberId: "team_member_bound" })),
    });

    expect(normalized.teamMembers.filter((member) => member.email === "owner@example.com")).toHaveLength(1);
    expect(normalized.projectMembers[0].teamMemberId).toBe("team_member_bound");
  });

  it("reenables automatic sync when normalizing an authenticated team state", () => {
    const state = createInitialState();
    const normalized = normalizeAppStatePayload({
      ...state,
      auth: {
        status: "authenticated",
        token: "stored_auth_token",
        bootstrapped: true,
        message: "已登录",
        account: {
          id: "account_wangshuo",
          workspaceId: "workspace_test",
          name: "王硕",
          email: "wangshuo@example.com",
          createdAt: "2026-05-10T09:00:00.000Z",
          updatedAt: "2026-05-10T09:00:00.000Z",
        },
      },
      sync: {
        ...state.sync,
        enabled: false,
        autoSync: false,
        token: undefined,
      },
    });

    expect(normalized.sync.enabled).toBe(true);
    expect(normalized.sync.autoSync).toBe(true);
    expect(normalized.sync.token).toBe("stored_auth_token");
  });

  it("deduplicates project member bindings for the same project and login identity", () => {
    const state = createInitialState();
    const projectId = state.projects[0].id;
    const normalized = normalizeAppStatePayload({
      ...state,
      teamMembers: [
        {
          ...state.teamMembers[0],
          id: "team_member_wangshuo",
          accountId: "account_wangshuo",
          name: "王硕",
          email: "wangshuo",
          updatedAt: "2026-05-10T10:00:00.000Z",
        },
      ],
      projectMembers: [
        {
          ...state.projectMembers[0],
          id: "member_wangshuo_old",
          projectId,
          teamMemberId: "team_member_wangshuo",
          accountId: "account_wangshuo",
          name: "王硕",
          email: "wangshuo",
          roles: ["project_owner", "executor"],
          updatedAt: "2026-05-10T09:00:00.000Z",
        },
        {
          ...state.projectMembers[0],
          id: "member_wangshuo_latest",
          projectId,
          teamMemberId: "team_member_wangshuo",
          accountId: "account_wangshuo",
          name: "王硕",
          email: "wangshuo",
          roles: ["executor"],
          updatedAt: "2026-05-10T11:00:00.000Z",
        },
      ],
    });

    expect(normalized.projectMembers.filter((member) => member.teamMemberId === "team_member_wangshuo")).toHaveLength(1);
    expect(normalized.projectMembers[0]).toMatchObject({ id: "member_wangshuo_latest", roles: ["executor"] });
  });

  it("defaults legacy tasks without a stage to requirements", () => {
    const state = createInitialState();
    const legacyTask = { ...state.tasks[0] };
    delete (legacyTask as Partial<typeof legacyTask>).stage;
    const normalized = normalizeAppStatePayload({ ...state, tasks: [legacyTask] });

    expect(normalized.tasks[0].stage).toBe("requirements");
  });

  it("does not transfer project owner role when repairing duplicated login identities", () => {
    const state = createInitialState();
    const projectId = state.projects[0].id;
    const normalized = normalizeAppStatePayload({
      ...state,
      auth: {
        ...state.auth,
        account: {
          id: "account_wangshuo",
          workspaceId: "workspace_test",
          name: "王硕",
          email: "wangshuo",
          createdAt: "2026-05-10T10:00:00.000Z",
          updatedAt: "2026-05-10T10:00:00.000Z",
        },
      },
      teamMembers: [
        {
          id: "team_member_account_owner",
          accountId: "account_owner",
          name: "王硕",
          email: "wangshuo",
          status: "active",
          createdAt: "2026-05-10T09:00:00.000Z",
          updatedAt: "2026-05-10T09:00:00.000Z",
        },
        {
          id: "team_member_wangshuo",
          accountId: "account_wangshuo",
          name: "王硕",
          email: "wangshuo",
          status: "active",
          createdAt: "2026-05-10T10:00:00.000Z",
          updatedAt: "2026-05-10T10:00:00.000Z",
        },
      ],
      projectMembers: [
        {
          id: "member_stale_owner",
          projectId,
          teamMemberId: "team_member_account_owner",
          accountId: "account_owner",
          name: "王硕",
          email: "wangshuo",
          roles: ["project_owner", "executor"],
          status: "active",
          createdAt: "2026-05-10T09:00:00.000Z",
          updatedAt: "2026-05-10T09:00:00.000Z",
        },
      ],
    });

    expect(normalized.teamMembers.filter((member) => member.email === "wangshuo")).toHaveLength(1);
    expect(normalized.teamMembers[0]).toMatchObject({ id: "team_member_wangshuo", accountId: "account_wangshuo" });
    expect(normalized.projectMembers[0]).toMatchObject({
      teamMemberId: "team_member_wangshuo",
      accountId: "account_wangshuo",
      roles: ["executor"],
    });
  });

  it("summarizes imports, creates backups, and exports CSV", () => {
    const state = createInitialState();
    const summary = summarizeImportPayload(state);
    expect(summary.valid).toBe(true);
    expect(summary.taskCount).toBe(state.tasks.length);
    expect(buildCsvBundle(state)).toContain("# tasks.csv");
    const backup = createBackupSnapshot(state, "before_import", "2026-05-10T10:00:00.000Z");
    expect(backup.payload).toContain("project_starter");
    const imported = mergeImportedState(state, { ...state, tasks: [] }, backup);
    expect(imported.tasks).toHaveLength(0);
    expect(imported.backupSnapshots[0]).toMatchObject({ reason: "before_import" });
  });

  it("keeps newer local daily plan committed tasks when remote sync is older", () => {
    const state = createInitialState();
    const localPlan = {
      ...getTodayPlan(state),
      id: "plan_sync_today",
      date: "2026-05-10",
      committedTaskIds: [],
      updatedAt: "2026-05-10T12:00:00.000Z",
    };
    const remotePlan = {
      ...localPlan,
      committedTaskIds: ["task_write_prd"],
      updatedAt: "2026-05-10T09:00:00.000Z",
    };
    const row: SyncRow = {
      entity: "daily_plan",
      id: localPlan.id,
      device_id: "other_browser",
      updated_at: remotePlan.updatedAt,
      payload: remotePlan,
      revision: 12,
      version: 1,
    };

    const merged = mergeRowsIntoState({ ...state, dailyPlans: [localPlan] }, [row], 12);

    expect(merged.dailyPlans[0].committedTaskIds).toEqual([]);
  });

  it("builds calendar summaries and template tasks", () => {
    const state = createInitialState();
    const todayPlan = { ...getTodayPlan(state), committedTaskIds: ["task_calendar_test"] };
    const summaries = calendarSummaries({ ...state, dailyPlans: [todayPlan] }, todayPlan.date, 7);
    expect(summaries).toHaveLength(7);
    expect(summaries[0].committedTaskIds.length).toBeGreaterThan(0);
    expect(summaries[0].review).toBeTruthy();
    const template: TaskTemplate = {
      id: "template_test",
      name: "测试模板",
      description: "模板说明",
      project: "测试",
      tags: ["模板"],
      priority: "high",
      severity: "medium",
      estimatePomodoros: 2,
      subtasks: ["第一步", "第二步"],
    };
    const task = instantiateTemplate(template, "2026-05-10T10:00:00.000Z");
    expect(task.subtasks).toHaveLength(2);
    expect(task.project).toBe("测试");
  });

  it("parses natural language quick input and filters reports", () => {
    const parsed = parseQuickInput("明天10点 写周报 #工作 @运营 2p !!", new Date("2026-05-10T08:00:00+08:00"));
    expect(parsed.title).toBe("写周报");
    expect(parsed.tags).toEqual(["工作"]);
    expect(parsed.project).toBe("运营");
    expect(parsed.priority).toBe("high");
    expect(parsed.estimatePomodoros).toBe(2);
    expect(parsed.dueAt).toBeTruthy();

    const state = createInitialState();
    const filter = { range: "30d" as const, project: "TimeManage", tag: "all", taskId: "all" };
    expect(filteredStateForReport(state, filter).tasks.every((task) => task.project === "TimeManage")).toBe(true);
    expect(reviewSummary(state, filter).rangeLabel).toBe("近 30 天");
  });
});
