import { afterEach, describe, expect, it, vi } from "vitest";
import { createInitialState } from "./seed";
import { loadTeamBusinessState } from "./teamApi";
import type { ActiveTimer, FocusSession, SyncState, Task, WorkSession } from "./types";

const iso = (value: string) => new Date(value).toISOString();

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("team backend active timer state loading", () => {
  it("preserves the local active timer when refreshing team state", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-30T06:12:00Z"));
    const base = createInitialState();
    const task: Task = {
      id: "task_active",
      title: "刷新后仍在执行",
      notes: "",
      tags: [],
      projectId: base.projects[0].id,
      project: base.projects[0].name,
      creatorMemberId: base.projectMembers[0].id,
      primaryExecutorMemberId: base.projectMembers[0].id,
      collaboratorMemberIds: [],
      progressPercent: 0,
      progressNote: "",
      priority: "high",
      severity: "medium",
      stage: "development",
      estimatePomodoros: 2,
      status: "committed",
      repeatRule: "none",
      subtasks: [],
      sortOrder: 1,
      actualPomodoros: 0,
      estimateHistory: [],
      createdAt: iso("2026-06-30T06:00:00Z"),
      updatedAt: iso("2026-06-30T06:00:00Z"),
    };
    const localStartedTask = {
      ...task,
      status: "in_progress" as const,
      updatedAt: iso("2026-06-30T06:10:00Z"),
    };
    const focusSession: FocusSession = {
      id: "session_active",
      taskId: task.id,
      mode: "focus",
      duration: 25 * 60,
      startedAt: iso("2026-06-30T06:10:00Z"),
      interruptionCounts: { internal: 0, external: 0 },
    };
    const workSession: WorkSession = {
      id: "work_session_active",
      taskId: task.id,
      executorMemberId: base.projectMembers[0].id,
      focusSessionId: focusSession.id,
      status: "active",
      startedAt: focusSession.startedAt,
      totalPausedSeconds: 0,
      createdAt: focusSession.startedAt,
      updatedAt: focusSession.startedAt,
    };
    const activeTimer: ActiveTimer = {
      sessionId: focusSession.id,
      taskId: task.id,
      workSessionId: workSession.id,
      mode: "focus",
      duration: focusSession.duration,
      remaining: focusSession.duration,
      isRunning: true,
      startedAt: focusSession.startedAt,
      plannedEndAt: iso("2026-06-30T06:35:00Z"),
      totalPausedSeconds: 0,
      cycleIndex: 1,
    };
    const local = {
      ...base,
      auth: {
        status: "authenticated" as const,
        token: "token",
        account: {
          id: "account_owner",
          workspaceId: "workspace_test",
          name: "负责人",
          email: "owner@example.com",
          createdAt: iso("2026-06-30T06:00:00Z"),
          updatedAt: iso("2026-06-30T06:00:00Z"),
        },
        workspace: {
          id: "workspace_test",
          name: "测试团队",
          createdAt: iso("2026-06-30T06:00:00Z"),
          updatedAt: iso("2026-06-30T06:00:00Z"),
        },
        bootstrapped: true,
        message: "已登录",
      },
      sync: {
        ...base.sync,
        serverUrl: "http://127.0.0.1:8787",
        token: "token",
      } satisfies SyncState,
      tasks: [localStartedTask],
      focusSessions: [focusSession],
      workSessions: [workSession],
      activeTimer,
      updatedAt: iso("2026-06-30T06:10:00Z"),
    };

    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      rows: [
        {
          workspace_id: "workspace_test",
          entity: "task",
          id: task.id,
          updated_at: task.updatedAt,
          payload: task,
        },
      ],
    }), { status: 200, headers: { "content-type": "application/json" } })));

    const loaded = await loadTeamBusinessState(local);

    expect(loaded.activeTimer?.sessionId).toBe(activeTimer.sessionId);
    expect(loaded.workSessions.find((session) => session.id === workSession.id)?.status).toBe("active");
    expect(loaded.focusSessions.some((session) => session.id === focusSession.id)).toBe(true);
    expect(loaded.tasks.find((item) => item.id === task.id)?.status).toBe("in_progress");
    expect(loaded.dailyPlans.some((plan) => plan.committedTaskIds.includes(task.id))).toBe(true);
  });
});
