import { createInitialState as createEmptyInitialState, todayKey } from "../seed";
import type { AppState, ExecutionSignal, Project, ProjectMember, Task, WorkSession } from "../types";

export const iso = (value: string) => new Date(value).toISOString();

export const createInitialState = (): AppState => {
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
      id: "task_sync_config",
      title: "配置团队同步设置",
      notes: "测试任务备注。",
      tags: ["同步", "团队"],
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
      title: "拆分团队后台验收任务",
      notes: "测试任务备注。",
      tags: ["后台", "验收"],
      projectId: "project_starter",
      project: "团队协作",
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
  return {
    ...state,
    tasks,
    dailyPlans: [{
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
    }],
    updatedAt: now,
  };
};

export const createTestState = (overrides: Partial<AppState> = {}): AppState => ({
  ...createInitialState(),
  ...overrides,
});

export const withProject = (state: AppState, overrides: Partial<Project> = {}): AppState => {
  const base = state.projects[0];
  return {
    ...state,
    projects: [...state.projects, {
      ...base,
      id: overrides.id ?? "project_fixture",
      name: overrides.name ?? "测试项目",
      description: overrides.description ?? "测试项目说明",
      sortOrder: overrides.sortOrder ?? 1000,
      createdAt: overrides.createdAt ?? state.updatedAt,
      updatedAt: overrides.updatedAt ?? state.updatedAt,
      ...overrides,
    }],
  };
};

export const withProjectMember = (state: AppState, overrides: Partial<ProjectMember> = {}): AppState => {
  const base = state.projectMembers[0];
  return {
    ...state,
    projectMembers: [...state.projectMembers, {
      ...base,
      id: overrides.id ?? "member_fixture",
      projectId: overrides.projectId ?? base.projectId,
      name: overrides.name ?? "测试成员",
      roles: overrides.roles ?? ["executor"],
      status: overrides.status ?? "active",
      createdAt: overrides.createdAt ?? state.updatedAt,
      updatedAt: overrides.updatedAt ?? state.updatedAt,
      ...overrides,
    }],
  };
};

export const withTask = (state: AppState, overrides: Partial<Task> = {}): AppState => {
  const base = state.tasks[0];
  return {
    ...state,
    tasks: [...state.tasks, {
      ...base,
      id: overrides.id ?? "task_fixture",
      title: overrides.title ?? "测试任务",
      projectId: overrides.projectId ?? base.projectId,
      project: overrides.project ?? base.project,
      sortOrder: overrides.sortOrder ?? state.tasks.length * 10 + 10,
      createdAt: overrides.createdAt ?? state.updatedAt,
      updatedAt: overrides.updatedAt ?? state.updatedAt,
      ...overrides,
    }],
  };
};

export const withWorkSession = (state: AppState, overrides: Partial<WorkSession> = {}): AppState => {
  const taskId = overrides.taskId ?? state.tasks[0]?.id ?? "task_fixture";
  const startedAt = overrides.startedAt ?? state.updatedAt;
  return {
    ...state,
    workSessions: [...state.workSessions, {
      id: overrides.id ?? "work_fixture",
      taskId,
      executorMemberId: overrides.executorMemberId ?? state.projectMembers[0]?.id ?? "member_owner",
      focusSessionId: overrides.focusSessionId ?? "focus_fixture",
      status: overrides.status ?? "ended",
      startedAt,
      endedAt: overrides.endedAt,
      pausedAt: overrides.pausedAt,
      totalPausedSeconds: overrides.totalPausedSeconds ?? 0,
      createdAt: overrides.createdAt ?? startedAt,
      updatedAt: overrides.updatedAt ?? overrides.endedAt ?? startedAt,
      ...overrides,
    }],
  };
};

export const withExecutionSignal = (state: AppState, overrides: Partial<ExecutionSignal> = {}): AppState => {
  const session = state.workSessions[state.workSessions.length - 1];
  return {
    ...state,
    executionSignals: [...state.executionSignals, {
      id: overrides.id ?? "signal_fixture",
      workSessionId: overrides.workSessionId ?? session?.id ?? "work_fixture",
      taskId: overrides.taskId ?? session?.taskId ?? state.tasks[0]?.id ?? "task_fixture",
      executorMemberId: overrides.executorMemberId ?? session?.executorMemberId ?? state.projectMembers[0]?.id ?? "member_owner",
      type: overrides.type ?? "work_ended",
      createdAt: overrides.createdAt ?? state.updatedAt,
      ...overrides,
    }],
  };
};
