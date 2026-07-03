import { expect, test } from "@playwright/test";
import { MOCK_SERVER } from "./support/constants";
import { clearStoredApp, openApp } from "./support/openApp";
import { workspaceMemberState } from "./support/scenarioStates";

test.beforeEach(async ({ page }) => {
  await clearStoredApp(page);
});

test("opens workspace directory instead of switching a single active workspace", async ({ page }) => {
  await openApp(page);

  const nav = page.getByLabel("页面导航");
  await expect(nav.getByRole("button", { name: "成员状况" })).toBeVisible();
  await expect(page.locator(".topbar-actions").getByLabel("当前工作区")).toHaveCount(0);

  await nav.getByRole("button", { name: "工作区" }).click();
  await expect(page.getByRole("heading", { name: "我的工作区" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "E2E 工作区" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "项目负责人私人区" })).toBeVisible();
  await expect(page.locator("article").filter({ hasText: "E2E 工作区" }).getByRole("button", { name: /项目/ })).toContainText("1");
  await expect(page.locator("article").filter({ hasText: "E2E 工作区" }).getByRole("button", { name: /成员/ })).toContainText("2");
});

test("keeps private workspace member management locked to the owner", async ({ page }) => {
  await openApp(page);

  await page.getByLabel("页面导航").getByRole("button", { name: "工作区" }).click();
  await page.locator("article").filter({ hasText: "项目负责人私人区" }).getByRole("button", { name: /成员/ }).click();

  const dialog = page.getByRole("dialog", { name: "项目负责人私人区 成员管理" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("工作区属性")).toHaveValue("私人工作区");
  await expect(dialog.getByLabel("工作区属性")).toBeDisabled();
  await expect(dialog.getByLabel("工作区负责人")).toBeDisabled();
  await expect(dialog).toContainText("私人工作区只允许本人使用，不支持添加成员。");
  await expect(dialog.getByLabel("成员登录账号")).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: "发送邀请" })).toHaveCount(0);
});

test("edits shared workspace owner and sends workspace invitation", async ({ page }) => {
  await openApp(page);

  await page.getByLabel("页面导航").getByRole("button", { name: "工作区" }).click();
  await page.locator("article").filter({ hasText: "E2E 工作区" }).getByRole("button", { name: /成员/ }).click();

  const dialog = page.getByRole("dialog", { name: "E2E 工作区 成员管理" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("工作区属性")).toBeEnabled();
  await expect(dialog.getByLabel("工作区负责人")).toBeEnabled();
  const ownerRow = dialog.locator(".workspace-member-row").filter({ has: page.locator("strong", { hasText: "项目负责人" }) });
  const wangshuoRow = dialog.locator(".workspace-member-row").filter({ has: page.locator("strong", { hasText: "王硕" }) });
  await expect(ownerRow.getByLabel("负责人")).toBeChecked();
  await expect(ownerRow.getByLabel("执行者")).toBeChecked();
  await expect(wangshuoRow.getByLabel("负责人")).not.toBeChecked();
  await expect(wangshuoRow.getByLabel("执行者")).toBeChecked();
  await expect(wangshuoRow.getByLabel("执行者")).toBeDisabled();

  const updateRequest = page.waitForRequest((request) =>
    request.url() === `${MOCK_SERVER}/workspaces/workspace_e2e` && request.method() === "PATCH",
  );
  await wangshuoRow.getByLabel("负责人").check();
  expect((await updateRequest).postDataJSON()).toMatchObject({
    name: "E2E 工作区",
    type: "shared",
    owner_account_id: "account_wangshuo",
  });
  await expect(page.getByText("工作区已更新")).toBeVisible();

  await dialog.getByLabel("成员登录账号").fill(" NewMember@Example.COM ");
  const inviteRequest = page.waitForRequest((request) =>
    request.url() === `${MOCK_SERVER}/workspace-invitations` && request.method() === "POST",
  );
  await dialog.getByRole("button", { name: "发送邀请" }).click();
  expect((await inviteRequest).postDataJSON()).toEqual({
    workspace_id: "workspace_e2e",
    email: "newmember@example.com",
  });
  await expect(page.getByText("已向 newmember@example.com 发送工作区邀请")).toBeVisible();
});

test("unbinds a shared workspace member from workspace member list", async ({ page }) => {
  await openApp(page);

  await page.getByLabel("页面导航").getByRole("button", { name: "工作区" }).click();
  await page.locator("article").filter({ hasText: "E2E 工作区" }).getByRole("button", { name: /成员/ }).click();

  const dialog = page.getByRole("dialog", { name: "E2E 工作区 成员管理" });
  const ownerRow = dialog.locator(".workspace-member-row").filter({ has: page.locator("strong", { hasText: "项目负责人" }) });
  const wangshuoRow = dialog.locator(".workspace-member-row").filter({ has: page.locator("strong", { hasText: "王硕" }) });
  await expect(ownerRow.getByRole("button", { name: "解除绑定" })).toBeDisabled();
  await expect(wangshuoRow.getByRole("button", { name: "解除绑定" })).toBeEnabled();

  const unbindRequest = page.waitForRequest((request) =>
    request.url() === `${MOCK_SERVER}/workspaces/workspace_e2e/members/membership_workspace_e2e_account_wangshuo` &&
    request.method() === "PATCH",
  );
  await wangshuoRow.getByRole("button", { name: "解除绑定" }).click();
  expect((await unbindRequest).postDataJSON()).toEqual({ status: "disabled" });

  await expect(page.getByText("工作区成员已解除绑定")).toBeVisible();
  await expect(dialog.locator(".member-section-title").filter({ hasText: "成员列表" })).toContainText("1 人");
  await expect(dialog.locator(".workspace-member-row").filter({ hasText: "王硕" })).toHaveCount(0);
});

test("workspace member can see shared workspace projects and project tasks", async ({ page }) => {
  await openApp(page, workspaceMemberState());

  await expect(page.getByText("账号：王硕")).toBeVisible();
  const projectOverview = page.getByLabel("项目卡片总览");
  await expect(projectOverview).toContainText("TimeManage 团队进度");
  await expect(projectOverview.locator("article").filter({ hasText: "TimeManage 团队进度" })).toContainText("协作 · E2E 工作区");

  await projectOverview.getByRole("button", { name: "进入项目" }).click();
  await expect(page.getByText("协作工作区 · E2E 工作区")).toBeVisible();
  await expect(page.locator(".project-overview-task-board")).toContainText("整理时间管理系统 PRD");

  await page.getByRole("button", { name: "任务", exact: true }).click();
  await expect(page.locator(".project-task-table")).toContainText("整理时间管理系统 PRD");

  await page.getByLabel("页面导航").getByRole("button", { name: "成员状况" }).click();
  const memberBoard = page.getByLabel("成员今日任务列");
  await expect(memberBoard).toContainText("项目负责人");
  await expect(memberBoard).toContainText("王硕");
  await expect(memberBoard).toContainText("整理时间管理系统 PRD");
});
