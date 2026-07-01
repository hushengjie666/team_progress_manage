import { describe, expect, it } from "vitest";
import { createInitialState, todayKey } from "./seed";
import { createProjectInState } from "./teamProgress";
import { demoTaskIdForProject, mergeDemoDataIntoState } from "./demoData";
import type { ProjectMemberRole } from "./types";

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
    expect(merged.dailyPlans.find((plan) => plan.date === todayKey())?.committedTaskIds).toContain(mappedTaskId);
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
      currentMemberId: "member_hu_time",
      projectMembers: [
        {
          id: "member_wang_time",
          projectId: "project_starter",
          teamMemberId: "team_wang",
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
          teamMemberId: "team_hu",
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

});
