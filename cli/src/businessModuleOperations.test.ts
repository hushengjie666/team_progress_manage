import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { today } from "../../src/appModel.js";
import { currentAccountDailyPlanForWorkspaceDate } from "../../src/dailyPlanScope.js";
import { createInitialState } from "../../src/seed.js";
import type { AppState, Project, ProjectMember, Task, Workspace, WorkspaceMembership } from "../../src/types.js";
import {
  archiveProjectInTeamState,
  bindMemberToProjectInTeamState,
  createProjectInTeamState,
  createProjectMemberInTeamState,
  restoreProjectInTeamState,
  unbindProjectMemberInTeamState,
  updateProjectInTeamState,
  updateProjectMemberInTeamState,
} from "./businessProjectMemberOperations.js";
import {
  acceptTaskReviewInTeamState,
  deleteTaskTemplateInTeamState,
  instantiateTaskTemplateInTeamState,
  recordInterruptionInTeamState,
  returnTaskReviewInTeamState,
  saveTaskTemplateInTeamState,
  submitTaskReviewInTeamState,
  updateDailyReviewInTeamState,
  updateSettingsInTeamState,
} from "./businessReviewSettingsOperations.js";
import {
  addTaskToTodayInTeamState,
  assignTaskInTeamState,
  batchAddTasksToTodayInTeamState,
  createTaskInTeamState,
  finishWorkSessionInTeamState,
  moveTodayTaskInTeamState,
  pauseWorkSessionInTeamState,
  removeTaskFromTodayInTeamState,
  resumeWorkSessionInTeamState,
  scheduleTaskForDateInState,
  setTaskStatusInTeamState,
  splitTaskInTeamState,
  startTaskInTeamState,
  updateTaskInTeamState,
  updateTaskProgressInTeamState,
} from "./businessTaskOperations.js";

const timestamp = "2026-07-06T08:00:00.000Z";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(timestamp);
});

afterEach(() => {
  vi.useRealTimers();
});
const workspace = (id: string, name = id): Workspace => ({
  id,
  name,
  type: "shared",
  ownerAccountId: "account_owner",
  createdAt: timestamp,
  updatedAt: timestamp,
});
const membership = (workspaceId: string): WorkspaceMembership => ({
  id: `membership_${workspaceId}`,
  workspaceId,
  accountId: "account_owner",
  name: "王昱桥",
  email: "wyq@example.com",
  role: "owner",
  status: "active",
  createdAt: timestamp,
  updatedAt: timestamp,
});
const makeProject = (workspaceId = "workspace_main"): Project => ({
  id: "project_main",
  workspaceId,
  name: "测试项目",
  description: "",
  defaultExpectedStartHours: 24,
  taskStageMode: "software",
  sortOrder: 0,
  createdAt: timestamp,
  updatedAt: timestamp,
});
const makeOwner = (workspaceId = "workspace_main", projectId = "project_main"): ProjectMember => ({
  id: "member_owner",
  workspaceId,
  projectId,
  accountId: "account_owner",
  name: "王昱桥",
  email: "wyq@example.com",
  roles: ["project_owner", "executor"],
  status: "active",
  createdAt: timestamp,
  updatedAt: timestamp,
});

const makeState = (): AppState => {
  const mainWorkspace = workspace("workspace_main", "协作工作区");
  return {
    ...createInitialState(),
    auth: {
      status: "authenticated",
      token: "token",
      account: {
        id: "account_owner",
        workspaceId: mainWorkspace.id,
        name: "王昱桥",
        email: "wyq@example.com",
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      workspace: mainWorkspace,
      membership: membership(mainWorkspace.id),
      workspaces: [mainWorkspace],
      workspaceMemberships: [membership(mainWorkspace.id)],
      bootstrapped: true,
      message: "ok",
    },
    projects: [makeProject(mainWorkspace.id)],
    projectMembers: [makeOwner(mainWorkspace.id)],
    tasks: [],
    dailyPlans: [],
    focusSessions: [],
    workSessions: [],
    executionSignals: [],
    interruptions: [],
    templateInstances: [],
  };
};

const latestTask = (state: AppState): Task => {
  const task = state.tasks[0];
  if (!task) throw new Error("No task in test state.");
  return task;
};

const createTask = (state: AppState, title = "测试任务") => {
  const next = createTaskInTeamState(state, { projectId: "project_main", title }, timestamp);
  return { state: next, task: latestTask(next) };
};

describe("CLI project and member business operations", () => {
  it("covers project create/update/archive/restore and member bind/update/unbind", () => {
    let state = makeState();

    state = createProjectInTeamState(state, { name: "新增项目", workspaceId: "workspace_main", taskStageMode: "regular" }, timestamp);
    const createdProject = state.projects.find((project) => project.name === "新增项目");
    expect(createdProject).toMatchObject({ workspaceId: "workspace_main", taskStageMode: "regular" });

    state = updateProjectInTeamState(state, createdProject!.id, { name: "改名项目", defaultExpectedStartHours: 12 }, timestamp);
    expect(state.projects.find((project) => project.id === createdProject!.id)).toMatchObject({
      name: "改名项目",
      defaultExpectedStartHours: 12,
    });

    state = archiveProjectInTeamState(state, createdProject!.id, timestamp);
    expect(state.projects.find((project) => project.id === createdProject!.id)?.archivedAt).toBe(timestamp);
    state = restoreProjectInTeamState(state, createdProject!.id, timestamp);
    expect(state.projects.find((project) => project.id === createdProject!.id)?.archivedAt).toBeUndefined();

    state = createProjectMemberInTeamState(state, {
      projectId: createdProject!.id,
      name: "执行者",
      email: "executor@example.com",
      roles: ["executor"],
    }, timestamp);
    const executor = state.projectMembers.find((member) => member.email === "executor@example.com");
    expect(executor).toMatchObject({ projectId: createdProject!.id, workspaceId: "workspace_main", roles: ["executor"] });

    state = updateProjectMemberInTeamState(state, executor!.id, { name: "执行者改名", roles: ["project_owner", "executor"] }, timestamp);
    expect(state.projectMembers.find((member) => member.id === executor!.id)).toMatchObject({
      name: "执行者改名",
      roles: ["project_owner", "executor"],
    });

    state = bindMemberToProjectInTeamState(state, "project_main", executor!.id, ["executor"], timestamp);
    expect(state.projectMembers.some((member) => member.projectId === "project_main" && member.email === "executor@example.com")).toBe(true);

    state = unbindProjectMemberInTeamState(state, executor!.id, timestamp);
    expect(state.projectMembers.find((member) => member.id === executor!.id)?.status).toBe("disabled");
  });
});

describe("CLI task, today plan, and work-session business operations", () => {
  it("covers task create/update/assign/progress/status/split", () => {
    let state = makeState();
    const created = createTask(state);
    state = created.state;
    const taskId = created.task.id;

    state = updateTaskInTeamState(state, taskId, { title: "更新任务", estimateHours: 1, subtasks: ["检查", "提交"] }, timestamp);
    expect(state.tasks.find((task) => task.id === taskId)).toMatchObject({
      title: "更新任务",
      estimatePomodoros: 3,
    });
    expect(state.tasks.find((task) => task.id === taskId)?.subtasks.map((subtask) => subtask.title)).toEqual(["检查", "提交"]);

    state = assignTaskInTeamState(state, taskId, { primaryExecutorMemberId: "member_owner" }, timestamp);
    expect(state.tasks.find((task) => task.id === taskId)?.primaryExecutorMemberId).toBe("member_owner");

    state = updateTaskProgressInTeamState(state, taskId, 45, "推进中", timestamp);
    expect(state.tasks.find((task) => task.id === taskId)).toMatchObject({ progressPercent: 45, progressNote: "推进中" });

    state = setTaskStatusInTeamState(state, taskId, "in_progress", timestamp);
    expect(state.tasks.find((task) => task.id === taskId)?.status).toBe("in_progress");

    const splitSource = createTask(state, "待拆任务");
    state = splitTaskInTeamState(splitSource.state, splitSource.task.id, ["子任务一", "子任务二"], timestamp);
    expect(state.tasks.find((task) => task.id === splitSource.task.id)?.status).toBe("split");
    expect(state.tasks.filter((task) => task.notes.includes("待拆任务"))).toHaveLength(2);
  });

  it("covers today queue, future scheduling, ordering, and work-session flow", () => {
    let state = makeState();
    const first = createTask(state, "任务一");
    state = createTask(first.state, "任务二").state;
    const firstTaskId = first.task.id;
    const secondTaskId = latestTask(state).id;

    state = addTaskToTodayInTeamState(state, firstTaskId, timestamp);
    expect(currentAccountDailyPlanForWorkspaceDate(state, "workspace_main", today())?.committedTaskIds).toContain(firstTaskId);

    state = batchAddTasksToTodayInTeamState(state, [secondTaskId], timestamp);
    expect(currentAccountDailyPlanForWorkspaceDate(state, "workspace_main", today())?.committedTaskIds).toEqual([firstTaskId, secondTaskId]);

    state = moveTodayTaskInTeamState(state, secondTaskId, -1, timestamp);
    expect(currentAccountDailyPlanForWorkspaceDate(state, "workspace_main", today())?.committedTaskIds).toEqual([secondTaskId, firstTaskId]);

    state = removeTaskFromTodayInTeamState(state, secondTaskId, timestamp);
    expect(currentAccountDailyPlanForWorkspaceDate(state, "workspace_main", today())?.committedTaskIds).toEqual([firstTaskId]);

    state = scheduleTaskForDateInState(state, secondTaskId, "2026-07-10", timestamp);
    expect(currentAccountDailyPlanForWorkspaceDate(state, "workspace_main", "2026-07-10")?.committedTaskIds).toEqual([secondTaskId]);

    state = startTaskInTeamState(state, firstTaskId, timestamp);
    const sessionId = state.workSessions[0]?.id;
    expect(state.workSessions[0]).toMatchObject({ taskId: firstTaskId, status: "active" });
    expect(state.tasks.find((task) => task.id === firstTaskId)?.status).toBe("in_progress");

    state = pauseWorkSessionInTeamState(state, { workSessionId: sessionId }, "2026-07-06T08:10:00.000Z");
    expect(state.workSessions.find((session) => session.id === sessionId)?.status).toBe("paused");
    state = resumeWorkSessionInTeamState(state, { workSessionId: sessionId }, "2026-07-06T08:15:00.000Z");
    expect(state.workSessions.find((session) => session.id === sessionId)?.status).toBe("active");
    state = finishWorkSessionInTeamState(state, { workSessionId: sessionId, outcome: "completed" }, "2026-07-06T08:40:00.000Z");
    expect(state.workSessions.find((session) => session.id === sessionId)?.status).toBe("ended");
    expect(state.tasks.find((task) => task.id === firstTaskId)?.actualPomodoros).toBe(1);
  });
});

describe("CLI review, interruption, settings, and template business operations", () => {
  it("covers review flow, interruptions, daily review, settings, and templates", () => {
    let state = makeState();
    const created = createTask(state, "验收任务");
    state = addTaskToTodayInTeamState(created.state, created.task.id, timestamp);

    state = submitTaskReviewInTeamState(state, created.task.id, timestamp);
    expect(state.tasks.find((task) => task.id === created.task.id)?.status).toBe("pending_review");
    state = returnTaskReviewInTeamState(state, created.task.id, "需要补充", timestamp);
    expect(state.tasks.find((task) => task.id === created.task.id)).toMatchObject({
      status: "in_progress",
      reviewReturnReason: "需要补充",
    });
    state = submitTaskReviewInTeamState(state, created.task.id, timestamp);
    state = acceptTaskReviewInTeamState(state, created.task.id, timestamp);
    expect(state.tasks.find((task) => task.id === created.task.id)?.status).toBe("completed");

    state = recordInterruptionInTeamState(state, { taskId: created.task.id, type: "external", note: "电话", action: "defer" }, timestamp);
    expect(state.interruptions[0]).toMatchObject({ taskId: created.task.id, type: "external", note: "电话" });

    state = updateDailyReviewInTeamState(state, {
      date: "2026-07-06",
      workspaceId: "workspace_main",
      capacityPomodoros: 6,
      mood: "good",
      wins: "完成验收",
    }, timestamp);
    const reviewPlan = currentAccountDailyPlanForWorkspaceDate(state, "workspace_main", "2026-07-06");
    expect(reviewPlan).toMatchObject({ capacityPomodoros: 6, review: { mood: "good", wins: "完成验收" } });

    state = updateSettingsInTeamState(state, { focusMinutes: 30, whiteNoiseVolume: 150 }, timestamp);
    expect(state.settings).toMatchObject({ focusMinutes: 30, whiteNoiseVolume: 100 });

    state = saveTaskTemplateInTeamState(state, {
      name: "模板任务",
      description: "模板说明",
      project: "测试项目",
      tags: ["模板"],
      priority: "medium",
      severity: "medium",
      estimatePomodoros: 2,
      subtasks: ["一", "二"],
    }, timestamp);
    const template = state.taskTemplates.find((item) => item.name === "模板任务");
    expect(template).toBeDefined();

    state = instantiateTaskTemplateInTeamState(state, template!.id, "project_main", timestamp);
    expect(state.templateInstances[0]).toMatchObject({ templateId: template!.id });
    expect(state.tasks.find((task) => task.id === state.templateInstances[0].taskId)).toMatchObject({ title: "模板任务" });

    state = deleteTaskTemplateInTeamState(state, template!.id, timestamp);
    expect(state.taskTemplates.some((item) => item.id === template!.id)).toBe(false);
    expect(state.templateInstances.some((item) => item.templateId === template!.id)).toBe(false);
  });
});
