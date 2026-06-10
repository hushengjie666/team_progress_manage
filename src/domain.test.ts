import { describe, expect, it } from "vitest";
import {
  buildInsights,
  coachSteps,
  deriveRewardState,
  estimateDeltaLabel,
  focusQuality,
  generateRecurringTask,
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
import { createInitialState, todayKey } from "./seed";
import { endSessionInState, startTimerInState, toggleTimerInState } from "./appModel";
import { buildCsvBundle, createBackupSnapshot, mergeImportedState, summarizeImportPayload } from "./dataPortability";
import { calendarSummaries, filteredStateForReport, instantiateTemplate, parseQuickInput, reviewSummary } from "./planning";
import { normalizeAppStatePayload } from "./storage";
import { addProjectMemberToState, assignTaskInState, createProjectInState, updateProjectMemberInState } from "./teamProgress";
import type { ActiveTimer, AppState, FocusSession, TaskTemplate } from "./types";

const iso = (value: string) => new Date(value).toISOString();

describe("timer domain", () => {
  it("restores an expired running timer into pending settlement", () => {
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
    expect(restoreTimer(timer, new Date("2026-05-10T08:30:00Z"))).toMatchObject({
      remaining: 0,
      isRunning: false,
      pendingSettlement: "pending",
    });
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

describe("data portability and long planning", () => {
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
          },
        ],
      },
      backup,
    );
    expect(imported.projects.length).toBeGreaterThan(0);
    expect(imported.tasks[0].projectId).toBe(imported.projects[0].id);
    expect(imported.tasks[0].progressPercent).toBe(100);
    expect(imported.backupSnapshots[0]).toMatchObject({ reason: "before_import" });
  });

  it("summarizes imports, creates backups, and exports CSV", () => {
    const state = createInitialState();
    const summary = summarizeImportPayload(state);
    expect(summary.valid).toBe(true);
    expect(summary.taskCount).toBe(state.tasks.length);
    expect(buildCsvBundle(state)).toContain("# tasks.csv");
    const backup = createBackupSnapshot(state, "before_import", "2026-05-10T10:00:00.000Z");
    expect(backup.payload).toContain("task_write_prd");
    const imported = mergeImportedState(state, { ...state, tasks: [] }, backup);
    expect(imported.tasks).toHaveLength(0);
    expect(imported.backupSnapshots[0]).toMatchObject({ reason: "before_import" });
  });

  it("builds calendar summaries and template tasks", () => {
    const state = createInitialState();
    const summaries = calendarSummaries(state, state.dailyPlans[0].date, 7);
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
