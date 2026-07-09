import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ensureTodayPlan,
  getTodayPlan,
  startTimerInState,
} from "./appModel";
import { todayKey } from "./seed";
import { createInitialState } from "./test/fixtures";
import type { AppState } from "./types";

describe("timer today queue repair", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("repairs active work sessions that are missing from today's queue", () => {
    const state = createInitialState();
    const taskId = state.tasks[0].id;
    const started = startTimerInState(
      state,
      "focus",
      taskId,
      `${todayKey()}T08:00:00.000Z`,
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

  it("claims existing unassigned tasks in the current account today queue", () => {
    const state = createInitialState();
    const workspace = {
      id: "workspace_repair_claim",
      name: "协作工作区",
      type: "shared" as const,
      ownerAccountId: "account_owner",
      createdAt: `${todayKey()}T08:00:00.000Z`,
      updatedAt: `${todayKey()}T08:00:00.000Z`,
    };
    const task = {
      ...state.tasks[3],
      id: "repair_today_unassigned_claim",
      workspaceId: workspace.id,
      projectId: state.projects[0].id,
      primaryExecutorMemberId: undefined,
      collaboratorMemberIds: [],
      status: "committed" as const,
    };
    const todayPlan = getTodayPlan({
      ...state,
      auth: {
        ...state.auth,
        account: {
          id: "account_wangyuqiao",
          workspaceId: workspace.id,
          name: "王昱桥",
          email: "wangyuqiao",
          createdAt: `${todayKey()}T08:00:00.000Z`,
          updatedAt: `${todayKey()}T08:00:00.000Z`,
        },
      },
    });
    const repaired = ensureTodayPlan({
      ...state,
      auth: {
        ...state.auth,
        status: "authenticated",
        account: {
          id: "account_wangyuqiao",
          workspaceId: workspace.id,
          name: "王昱桥",
          email: "wangyuqiao",
          createdAt: `${todayKey()}T08:00:00.000Z`,
          updatedAt: `${todayKey()}T08:00:00.000Z`,
        },
        workspace,
        workspaces: [workspace],
        workspaceMemberships: [{
          id: "membership_workspace_repair_claim_wangyuqiao",
          workspaceId: workspace.id,
          accountId: "account_wangyuqiao",
          name: "王昱桥",
          email: "wangyuqiao",
          role: "member",
          status: "active",
          createdAt: `${todayKey()}T08:00:00.000Z`,
          updatedAt: `${todayKey()}T08:00:00.000Z`,
        }],
      },
      projects: state.projects.map((project) => ({ ...project, workspaceId: workspace.id })),
      projectMembers: [],
      tasks: [task],
      dailyPlans: [{ ...todayPlan, workspaceId: workspace.id, committedTaskIds: [task.id] }],
    });
    const createdMember = repaired.projectMembers.find((member) => member.accountId === "account_wangyuqiao");

    expect(createdMember).toMatchObject({
      projectId: state.projects[0].id,
      roles: ["executor"],
    });
    expect(repaired.tasks.find((item) => item.id === task.id)?.primaryExecutorMemberId).toBe(createdMember?.id);
  });

  it("repairs a focus active timer that is missing its work session", () => {
    const state = createInitialState();
    const taskId = state.tasks[0].id;
    const started = startTimerInState(
      state,
      "focus",
      taskId,
      `${todayKey()}T08:00:00.000Z`,
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
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 8, 9, 0, 0));
    const state = createInitialState();
    const taskId = state.tasks[0].id;
    const yesterdayStartedAt = new Date(2026, 6, 7, 23, 40, 0).toISOString();
    const yesterdayPlannedEndAt = new Date(2026, 6, 7, 23, 55, 0).toISOString();
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
        startedAt: yesterdayStartedAt,
        plannedEndAt: yesterdayPlannedEndAt,
        totalPausedSeconds: 0,
        cycleIndex: 1,
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

  it("keeps active work sessions started today in local time after midnight", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-07T16:30:00.000Z"));
    const todayDate = todayKey();
    const state = createInitialState();
    const taskId = state.tasks[0].id;
    const started = startTimerInState(
      state,
      "focus",
      taskId,
      "2026-07-07T16:30:00.000Z",
      "session_after_local_midnight",
    );

    const repaired = ensureTodayPlan(started);

    expect(getTodayPlan(repaired).date).toBe(todayDate);
    expect(repaired.activeTimer).toMatchObject({
      sessionId: "session_after_local_midnight",
      taskId,
      isRunning: true,
    });
    expect(repaired.workSessions.find((session) => session.focusSessionId === "session_after_local_midnight")).toMatchObject({
      status: "active",
    });
    expect(repaired.executionSignals.some((signal) => signal.payload?.reason === "stale_active_session")).toBe(false);
  });
});
