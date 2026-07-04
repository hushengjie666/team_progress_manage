import { expect, test } from "@playwright/test";
import type { BusinessRow } from "../../src/teamBusinessRows";
import { MOCK_SERVER } from "./support/constants";
import { clearStoredApp, openApp } from "./support/openApp";
import { projectInviteeScenario } from "./support/scenarioStates";

test.beforeEach(async ({ page }) => {
  await clearStoredApp(page);
});

test("shows inherited workspace members in project member management", async ({ page }) => {
  await openApp(page);

  await page.getByRole("button", { name: "进入项目" }).first().click();
  await page.getByRole("button", { name: "成员管理" }).click();

  const summary = page.locator(".project-member-summary-grid");
  await expect(summary.locator("article").filter({ hasText: "项目成员" })).toContainText("2");
  await expect(summary.locator("article").filter({ hasText: "执行者" })).toContainText("2");

  const memberList = page.locator(".project-binding-list");
  await expect(memberList.locator(".project-binding-row").filter({ has: page.locator("strong", { hasText: "项目负责人" }) })).toContainText("项目成员");
  const wangshuoRow = memberList.locator(".project-binding-row").filter({ has: page.locator("strong", { hasText: "王硕" }) });
  await expect(wangshuoRow).toContainText("工作区成员");
  await expect(wangshuoRow.getByLabel("执行者")).toBeChecked();
  await expect(wangshuoRow.getByLabel("项目负责人")).not.toBeChecked();

  const saveRequest = page.waitForRequest((request) =>
    request.url() === `${MOCK_SERVER}/team/data` && request.method() === "PUT",
  );
  await wangshuoRow.getByLabel("项目负责人").check();
  const requestBody = (await saveRequest).postDataJSON() as { rows: BusinessRow[] };
  expect(requestBody.rows).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        entity: "project_member",
        payload: expect.objectContaining({
          projectId: "project_starter",
          accountId: "account_wangshuo",
          roles: expect.arrayContaining(["executor", "project_owner"]),
          status: "active",
        }),
      }),
    ]),
  );
});

test("sends project member invitation from current project", async ({ page }) => {
  await openApp(page);

  await page.getByRole("button", { name: "进入项目" }).first().click();
  await page.getByRole("button", { name: "成员管理" }).click();
  await page.getByRole("button", { name: "添加成员" }).click();

  const dialog = page.getByRole("dialog", { name: "邀请项目成员" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("项目成员不会加入工作区成员列表")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "发送邀请" })).toBeDisabled();

  await dialog.getByLabel("成员登录账号").fill(" Invitee@Example.COM ");
  await dialog.getByLabel("项目负责人").check();
  const invitationRequest = page.waitForRequest((request) =>
    request.url() === `${MOCK_SERVER}/project-invitations` && request.method() === "POST",
  );
  await dialog.getByRole("button", { name: "发送邀请" }).click();

  const requestBody = (await invitationRequest).postDataJSON() as { workspace_id: string; project_id: string; email: string; roles: string[] };
  expect(requestBody).toEqual({
    workspace_id: "workspace_e2e",
    project_id: "project_starter",
    email: "invitee@example.com",
    roles: ["executor", "project_owner"],
  });
  await expect(page.getByText("已向 invitee@example.com 发送项目邀请")).toBeVisible();
  await expect(dialog.getByLabel("成员登录账号")).toHaveValue("");
});

test("accepts a project invitation without expanding access to every workspace project", async ({ page }) => {
  const { initialState, fullWorkspaceState, invitation } = projectInviteeScenario();
  expect(fullWorkspaceState.projects.map((project) => project.name)).toContain("E2E 工作区隐藏项目");

  await openApp(page, initialState, {
    projectInvitations: [invitation],
    acceptedProjectInvitationState: fullWorkspaceState,
  });

  const projectOverview = page.getByLabel("项目卡片总览");
  await expect(projectOverview).not.toContainText("TimeManage 团队进度");

  const pendingButton = page.getByRole("button", { name: /待处理/ });
  await expect(pendingButton).toContainText("1");
  await pendingButton.click();

  const dialog = page.getByRole("dialog", { name: "待处理" });
  await expect(dialog).toContainText("项目 · E2E 工作区");
  await expect(dialog).toContainText("TimeManage 团队进度");
  const acceptResponse = page.waitForResponse((response) =>
    response.url() === `${MOCK_SERVER}/project-invitations/project_invitation_invitee_starter/accept` &&
    response.request().method() === "POST" &&
    response.ok(),
  );
  await dialog.getByRole("button", { name: "同意加入" }).click();
  await acceptResponse;

  await expect(page.getByText("已加入项目 TimeManage 团队进度")).toBeVisible();
  await expect(projectOverview).toContainText("TimeManage 团队进度");
  await expect(projectOverview).not.toContainText("E2E 工作区隐藏项目");
  await expect(projectOverview).not.toContainText("E2E 隐藏项目任务");
  await expect(pendingButton).not.toContainText("1");

  await page.getByLabel("页面导航").getByRole("button", { name: "成员状况" }).click();
  const memberBoard = page.getByLabel("成员今日任务列");
  await expect(memberBoard).toContainText("整理时间管理系统 PRD");
  await expect(memberBoard).not.toContainText("E2E 工作区隐藏项目");
  await expect(memberBoard).not.toContainText("E2E 隐藏项目任务");

  await page.getByLabel("页面导航").getByRole("button", { name: "工作区" }).click();
  const sharedWorkspaceCard = page.locator("article").filter({ hasText: "E2E 工作区" });
  await expect(sharedWorkspaceCard.getByRole("button", { name: /项目/ })).toContainText("1");
  await expect(sharedWorkspaceCard.getByRole("button", { name: /成员/ })).toContainText("1");
  await sharedWorkspaceCard.getByRole("button", { name: /项目/ }).click();
  const workspaceProjectsDialog = page.getByRole("dialog", { name: "E2E 工作区 项目管理" });
  await expect(workspaceProjectsDialog).toContainText("TimeManage 团队进度");
  await expect(workspaceProjectsDialog).not.toContainText("E2E 工作区隐藏项目");
  await expect(workspaceProjectsDialog).not.toContainText("E2E 隐藏项目任务");
  await workspaceProjectsDialog.getByLabel("关闭").click();

  await page.getByLabel("页面导航").getByRole("button", { name: "项目总览" }).click();
  await projectOverview.getByRole("button", { name: "进入项目" }).click();
  await expect(page.getByText("协作工作区 · E2E 工作区")).toBeVisible();
  await expect(page.getByRole("heading", { name: "任务阶段总览" })).toBeVisible();
});
