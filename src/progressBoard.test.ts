import { describe, expect, it } from "vitest";
import { expectedStartForTask, buildProgressBoard, stalledTaskRisks } from "./progressBoard";
import { createInitialState } from "./test/fixtures";
import type { AppState } from "./types";

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

  it("keeps split parent tasks out of progress board sections", () => {
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

    expect(buildProgressBoard(next, projectId).sections.flatMap((section) => section.tasks).some((task) => task.taskId === "split_parent")).toBe(false);
  });
});
