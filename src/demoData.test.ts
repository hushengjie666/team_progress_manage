import { describe, expect, it } from "vitest";
import { todayKey } from "./seed";
import { createInitialState } from "./test/fixtures";
import { createProjectInState } from "./teamProgress";
import { demoTaskIdForProject, mergeDemoDataIntoState } from "./demoData";
import type { ProjectMemberRole, TaskStage } from "./types";

describe("mergeDemoDataIntoState", () => {
  it("keeps TimeManage demo wording when the target project is TimeManage", () => {
    const timestamp = "2026-05-10T09:00:00.000Z";
    const initial = createInitialState();
    const merged = mergeDemoDataIntoState(initial, initial.projects[0].id, timestamp);
    const mappedTaskId = demoTaskIdForProject("demo_task_today_deep", initial.projects[0].id);

    expect(merged.tasks.find((task) => task.id === mappedTaskId)).toMatchObject({
      projectId: initial.projects[0].id,
      project: "TimeManage 团队进度",
      title: "完成工作台信息精简",
    });
  });

  it("adds demo tasks to the target project without replacing the signed-in workspace", () => {
    const timestamp = "2026-05-10T09:00:00.000Z";
    const initial = {
      ...createInitialState(),
      auth: {
        status: "authenticated" as const,
        bootstrapped: true,
        token: "token_avatar",
        account: {
          id: "account_avatar",
          workspaceId: "workspace_avatar",
          name: "头像识别负责人",
          email: "avatar@example.com",
          createdAt: timestamp,
          updatedAt: timestamp,
        },
        message: "已登录",
      },
    };
    const withAvatarProject = createProjectInState(
      initial,
      "头像识别系统",
      "识别头像并管理模型训练任务",
      timestamp,
      (prefix) => `${prefix}_avatar`,
      { accountId: "account_avatar", name: "头像识别负责人", email: "avatar@example.com" },
    );
    const targetProject = withAvatarProject.projects.find((project) => project.name === "头像识别系统")!;

    const merged = mergeDemoDataIntoState(withAvatarProject, targetProject.id, timestamp);
    const mappedTaskId = demoTaskIdForProject("demo_task_today_deep", targetProject.id);

    expect(merged.auth).toEqual(withAvatarProject.auth);
    expect(merged.projects.map((project) => project.name)).toContain("头像识别系统");
    expect(merged.tasks.find((task) => task.id === mappedTaskId)).toMatchObject({
      projectId: targetProject.id,
      project: "头像识别系统",
      title: "完成头像识别样例集核验",
    });
    expect(merged.tasks.some((task) => task.projectId === targetProject.id && task.title === "完成工作台信息精简")).toBe(false);
    expect(merged.tasks.some((task) => task.projectId === "project_starter" && task.id.startsWith("demo_task_"))).toBe(false);
    expect(merged.dailyPlans.some((plan) =>
      plan.date === todayKey() && plan.committedTaskIds.includes(mappedTaskId),
    )).toBe(true);
  });

  it("assigns active demo tasks to the current account member instead of the first executor", () => {
    const timestamp = "2026-05-10T09:00:00.000Z";
    const initial = {
      ...createInitialState(),
      auth: {
        status: "authenticated" as const,
        bootstrapped: true,
        token: "token_hu",
        account: {
          id: "account_hu",
          workspaceId: "workspace_team",
          name: "胡圣杰",
          email: "hu@example.com",
          createdAt: timestamp,
          updatedAt: timestamp,
        },
        message: "已登录",
      },
      projectMembers: [
        {
          id: "member_wang_time",
          projectId: "project_starter",
          accountId: "account_wang",
          name: "王硕",
          email: "wang@example.com",
          roles: ["executor"] as ProjectMemberRole[],
          status: "active" as const,
          createdAt: timestamp,
          updatedAt: timestamp,
        },
        {
          id: "member_hu_time",
          projectId: "project_starter",
          accountId: "account_hu",
          name: "胡圣杰",
          email: "hu@example.com",
          roles: ["project_owner", "executor"] as ProjectMemberRole[],
          status: "active" as const,
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      ],
    };

    const merged = mergeDemoDataIntoState(initial, "project_starter", timestamp);
    const activeDemoTask = merged.tasks.find((task) => task.id === demoTaskIdForProject("demo_task_today_deep", "project_starter"));

    expect(activeDemoTask?.primaryExecutorMemberId).toBe("member_hu_time");
  });

  it("normalizes demo task stages and core fields for a regular target project", () => {
    const timestamp = "2026-05-10T09:00:00.000Z";
    const workspace = {
      id: "workspace_ops",
      name: "运营工作区",
      type: "shared" as const,
      ownerAccountId: "account_ops",
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    const initial = {
      ...createInitialState(),
      auth: {
        status: "authenticated" as const,
        bootstrapped: true,
        token: "token_ops",
        account: {
          id: "account_ops",
          workspaceId: workspace.id,
          name: "运营负责人",
          email: "ops@example.com",
          createdAt: timestamp,
          updatedAt: timestamp,
        },
        workspace,
        workspaces: [workspace],
        message: "已登录",
      },
    };
    const withRegularProject = createProjectInState(
      initial,
      "门店巡检",
      "检查门店日常执行质量",
      timestamp,
      (prefix) => `${prefix}_ops`,
      {
        accountId: "account_ops",
        name: "运营负责人",
        email: "ops@example.com",
        workspaceId: workspace.id,
        taskStageMode: "regular",
      },
    );
    const targetProject = withRegularProject.projects.find((project) => project.name === "门店巡检")!;
    const regularStages = new Set<TaskStage>(["planning", "execution", "check"]);

    const merged = mergeDemoDataIntoState(withRegularProject, targetProject.id, timestamp);
    const generatedTasks = merged.tasks.filter((task) => task.projectId === targetProject.id && task.id.includes(targetProject.id));

    expect(generatedTasks.length).toBeGreaterThan(0);
    expect(generatedTasks.every((task) => regularStages.has(task.stage))).toBe(true);
    expect(generatedTasks.every((task) => task.workspaceId === workspace.id)).toBe(true);
    expect(generatedTasks.every((task) => task.creatorMemberId)).toBe(true);
    expect(generatedTasks.every((task) => task.primaryExecutorMemberId)).toBe(true);
    expect(generatedTasks.every((task) => task.notes.trim().length > 0)).toBe(true);
    expect(generatedTasks.every((task) => task.tags.length > 0)).toBe(true);
  });

});
