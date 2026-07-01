import { describe, expect, it } from "vitest";
import { today } from "../appModel";
import { createInitialState } from "../seed";
import type { DailyPlan, Project, ProjectMember, Task } from "../types";
import {
  buildMemberStatusColumns,
  buildMemberStatusPeople,
} from "./MemberStatusView";

const timestamp = "2026-06-30T08:00:00.000Z";

const project = (id: string, name: string): Project => ({
  id,
  name,
  description: "",
  defaultExpectedStartHours: 24,
  createdAt: timestamp,
  updatedAt: timestamp,
});

const member = (overrides: Partial<ProjectMember> & Pick<ProjectMember, "id" | "projectId">): ProjectMember => ({
  id: overrides.id,
  projectId: overrides.projectId,
  teamMemberId: overrides.teamMemberId,
  accountId: overrides.accountId ?? "account_hushengjie",
  name: overrides.name ?? "胡圣杰",
  email: overrides.email ?? "hushengjie@example.com",
  roles: overrides.roles ?? ["project_owner", "executor"],
  status: overrides.status ?? "active",
  createdAt: timestamp,
  updatedAt: timestamp,
});

const task = (overrides: Partial<Task> & Pick<Task, "id" | "projectId" | "project" | "primaryExecutorMemberId">): Task => ({
  id: overrides.id,
  title: overrides.title ?? "今日任务",
  notes: "",
  tags: [],
  projectId: overrides.projectId,
  project: overrides.project,
  primaryExecutorMemberId: overrides.primaryExecutorMemberId,
  collaboratorMemberIds: overrides.collaboratorMemberIds ?? [],
  progressPercent: overrides.progressPercent ?? 0,
  priority: overrides.priority ?? "medium",
  severity: overrides.severity ?? "medium",
  stage: overrides.stage ?? "requirements",
  estimatePomodoros: overrides.estimatePomodoros ?? 1,
  status: overrides.status ?? "committed",
  subtasks: [],
  sortOrder: overrides.sortOrder ?? 0,
  actualPomodoros: 0,
  estimateHistory: [],
  createdAt: timestamp,
  updatedAt: timestamp,
});

const dailyPlan = (committedTaskIds: string[]): DailyPlan => ({
  id: "plan_today",
  date: today(),
  capacityPomodoros: 8,
  committedTaskIds,
  completedPomodoros: 0,
  suggestedTaskIds: [],
  reflection: "",
  review: {
    mood: "normal",
    wins: "",
    blockers: "",
    interruptionPattern: "",
    tomorrowFocus: "",
  },
  createdAt: timestamp,
  updatedAt: timestamp,
});

describe("member status view model", () => {
  it("merges the same account across projects even when team member ids differ", () => {
    const timeManageMember = member({
      id: "member_time_manage_owner",
      projectId: "project_time_manage",
      teamMemberId: "team_member_time_manage",
    });
    const imageMember = member({
      id: "member_image_owner",
      projectId: "project_image",
      teamMemberId: "team_member_image",
    });

    const people = buildMemberStatusPeople([timeManageMember, imageMember]);

    expect(people).toHaveLength(1);
    expect(people[0].memberIds).toEqual(["member_time_manage_owner", "member_image_owner"]);
    expect(people[0].projectIds).toEqual(["project_time_manage", "project_image"]);
  });

  it("shows all project groups for a merged member's today tasks", () => {
    const state = createInitialState();
    const timeManage = project("project_time_manage", "TimeManage");
    const imageRecognition = project("project_image", "图像识别");
    const timeManageMember = member({
      id: "member_time_manage_owner",
      projectId: timeManage.id,
      teamMemberId: "team_member_time_manage",
    });
    const imageMember = member({
      id: "member_image_owner",
      projectId: imageRecognition.id,
      teamMemberId: "team_member_image",
    });
    const timeManageTask = task({
      id: "task_time_manage",
      title: "完成工作台信息精简",
      projectId: timeManage.id,
      project: timeManage.name,
      primaryExecutorMemberId: timeManageMember.id,
      sortOrder: 1,
    });
    const imageTask = task({
      id: "task_image",
      title: "验证本地团队后台",
      projectId: imageRecognition.id,
      project: imageRecognition.name,
      primaryExecutorMemberId: imageMember.id,
      sortOrder: 2,
    });

    const columns = buildMemberStatusColumns({
      ...state,
      projects: [timeManage, imageRecognition],
      projectMembers: [timeManageMember, imageMember],
      tasks: [timeManageTask, imageTask],
      dailyPlans: [dailyPlan([timeManageTask.id, imageTask.id])],
    });

    expect(columns).toHaveLength(1);
    expect(columns[0].displayedTasks.map((item) => item.id)).toEqual(["task_time_manage", "task_image"]);
    expect(columns[0].projectTaskGroups.map((group) => group.projectName)).toEqual(["TimeManage", "图像识别"]);
    expect(columns[0].projectTaskGroups.map((group) => group.roleLabel)).toEqual(["项目负责人", "项目负责人"]);
  });

  it("keeps roles on each project group instead of the member header", () => {
    const state = createInitialState();
    const timeManage = project("project_time_manage", "TimeManage");
    const imageRecognition = project("project_image", "图像识别");
    const timeManageMember = member({
      id: "member_time_manage_executor",
      projectId: timeManage.id,
      teamMemberId: "team_member_time_manage",
      roles: ["executor"],
    });
    const imageMember = member({
      id: "member_image_owner",
      projectId: imageRecognition.id,
      teamMemberId: "team_member_image",
      roles: ["project_owner", "executor"],
    });
    const timeManageTask = task({
      id: "task_time_manage",
      title: "完成工作台信息精简",
      projectId: timeManage.id,
      project: timeManage.name,
      primaryExecutorMemberId: timeManageMember.id,
      sortOrder: 1,
    });
    const imageTask = task({
      id: "task_image",
      title: "验证图像识别团队数据流转",
      projectId: imageRecognition.id,
      project: imageRecognition.name,
      primaryExecutorMemberId: imageMember.id,
      sortOrder: 2,
    });

    const columns = buildMemberStatusColumns({
      ...state,
      projects: [timeManage, imageRecognition],
      projectMembers: [timeManageMember, imageMember],
      tasks: [timeManageTask, imageTask],
      dailyPlans: [dailyPlan([timeManageTask.id, imageTask.id])],
    });

    expect(columns[0].projectTaskGroups.map((group) => [group.projectName, group.roleLabel])).toEqual([
      ["TimeManage", "执行者"],
      ["图像识别", "项目负责人"],
    ]);
  });

  it("shows completed tasks in the member today task list", () => {
    const state = createInitialState();
    const imageRecognition = project("project_image", "图像识别");
    const imageMember = member({
      id: "member_image_owner",
      projectId: imageRecognition.id,
      teamMemberId: "team_member_image",
    });
    const runningTask = task({
      id: "task_running",
      title: "验证图像识别团队数据流转",
      projectId: imageRecognition.id,
      project: imageRecognition.name,
      primaryExecutorMemberId: imageMember.id,
      status: "in_progress",
      sortOrder: 1,
    });
    const completedTask = task({
      id: "task_completed",
      title: "完成工作台信息精简",
      projectId: imageRecognition.id,
      project: imageRecognition.name,
      primaryExecutorMemberId: imageMember.id,
      status: "completed",
      sortOrder: 2,
    });

    const columns = buildMemberStatusColumns({
      ...state,
      projects: [imageRecognition],
      projectMembers: [imageMember],
      tasks: [runningTask, completedTask],
      dailyPlans: [dailyPlan([runningTask.id, completedTask.id])],
    });

    expect(columns).toHaveLength(1);
    expect(columns[0].displayedTasks.map((item) => item.id)).toEqual(["task_running", "task_completed"]);
    expect(columns[0].projectTaskGroups[0].tasks.map((item) => item.id)).toEqual(["task_running", "task_completed"]);
  });
});
