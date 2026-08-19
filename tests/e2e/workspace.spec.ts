import { expect, test, type Route } from "@playwright/test";
import { releaseContract } from "../../src/releaseContract";
import { MOCK_SERVER } from "./support/constants";
import { clearStoredApp, openApp } from "./support/openApp";
import { authenticatedState } from "./support/authenticatedState";
import { workspaceMemberState } from "./support/scenarioStates";

test.beforeEach(async ({ page }) => {
  await clearStoredApp(page);
});

test("shows matching client and server versions from the top bar", async ({ page }) => {
  await openApp(page);

  await page.getByRole("button", { name: `版本 v${releaseContract.releaseVersion}，版本匹配` }).click();
  const versionDialog = page.getByRole("dialog", { name: "版本信息" });
  await expect(versionDialog).toBeVisible();
  await expect(versionDialog.getByText("本机客户端").locator("..")).toContainText(`v${releaseContract.releaseVersion}`);
  await expect(versionDialog.getByText("服务器后台").locator("..")).toContainText(`v${releaseContract.releaseVersion}`);
  await expect(versionDialog.getByText("API 协议").locator("..")).toContainText(String(releaseContract.apiProtocolVersion));
  await expect(versionDialog.getByText("数据库结构").locator("..")).toContainText(`schema ${releaseContract.databaseSchemaVersion}`);
});

test("shows a queued task immediately and avoids a full reload after confirmation", async ({ page }) => {
  const state = authenticatedState();
  const title = "立即进入今日清单的任务";
  state.tasks.push({
    ...state.tasks[0],
    id: "task_queue_immediate",
    title,
    status: "pool",
    sortOrder: 20,
  });
  await openApp(page, state);
  await page.getByLabel("页面导航").getByRole("button", { name: "我的任务" }).click();

  let releaseWrite = () => undefined;
  let markWriteStarted = () => undefined;
  const writeGate = new Promise<void>((resolve) => { releaseWrite = resolve; });
  const writeStarted = new Promise<void>((resolve) => { markWriteStarted = resolve; });
  let bootstrapRequests = 0;
  page.on("request", (request) => {
    if (request.method() === "GET" && request.url() === `${MOCK_SERVER}/app/bootstrap`) bootstrapRequests += 1;
  });
  await page.route(`${MOCK_SERVER}/daily-plans/**`, async (route) => {
    markWriteStarted();
    await writeGate;
    await route.fallback();
  });

  const activityColumn = page.locator("section.task-column").filter({ has: page.getByRole("heading", { name: "活动清单" }) });
  const queueColumn = page.locator("section.task-column").filter({ has: page.getByRole("heading", { name: "工作队列" }) });
  await activityColumn.locator("article").filter({ hasText: title }).getByRole("button", { name: "加入队列" }).click();
  await writeStarted;

  await expect(queueColumn.locator("article").filter({ hasText: title })).toBeVisible();
  expect(bootstrapRequests).toBe(0);

  releaseWrite();
  await expect(page.getByText("已加入工作队列")).toBeVisible();
  await expect.poll(() => bootstrapRequests).toBe(0);
});

test("signs out without writing the session change as business data", async ({ page }) => {
  const businessWrites: string[] = [];
  page.on("request", (request) => {
    if (/\/(projects|tasks|daily-plans|work-sessions)\b/.test(request.url()) && request.method() !== "GET") {
      businessWrites.push(request.url());
    }
  });
  await openApp(page);

  await page.getByRole("button", { name: "退出登录：项目负责人" }).click();

  await expect(page.getByRole("heading", { name: "登录账号" })).toBeVisible();
  await expect(page.getByText("已退出登录")).toBeVisible();
  await expect(page.getByText(/缺少业务数据版本/)).toHaveCount(0);
  expect(businessWrites).toEqual([]);
});

test("hides business data during a temporary backend outage", async ({ page }) => {
  await openApp(page);
  const abortTeamData = (route: Route) => route.abort("failed");
  await page.route(`${MOCK_SERVER}/app/bootstrap`, abortTeamData);
  const failedRefresh = page.waitForRequest((request) =>
    request.url() === `${MOCK_SERVER}/app/bootstrap` && request.method() === "GET",
  );

  await failedRefresh;
  await expect(page.getByLabel("项目卡片总览")).toHaveCount(0);
  await expect(page.getByText(/团队业务数据加载失败/).first()).toBeVisible();

  await page.unroute(`${MOCK_SERVER}/app/bootstrap`, abortTeamData);
  await page.waitForResponse((response) =>
    response.url() === `${MOCK_SERVER}/app/bootstrap` && response.request().method() === "GET" && response.ok(),
  );
  await expect(page.getByRole("button", { name: "退出登录：项目负责人" })).toBeVisible();
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

test("filters business pages with the global workspace selector", async ({ page }) => {
  const state = authenticatedState();
  const sharedProject = state.projects[0];
  const sharedTask = state.tasks[0];
  const privateProject = {
    ...sharedProject,
    id: "project_private_e2e",
    workspaceId: "workspace_private_account_owner",
    name: "E2E 私人项目",
    sortOrder: 1000,
  };
  const privateTask = {
    ...sharedTask,
    id: "task_private_e2e",
    workspaceId: "workspace_private_account_owner",
    projectId: privateProject.id,
    project: privateProject.name,
    creatorMemberId: "member_private_e2e",
    primaryExecutorMemberId: "member_private_e2e",
    title: "整理私人工作清单",
    sortOrder: 20,
  };
  const privateMember = {
    ...state.projectMembers[0],
    id: "member_private_e2e",
    workspaceId: "workspace_private_account_owner",
    projectId: privateProject.id,
  };
  const scopedState = {
    ...state,
    projects: [...state.projects, privateProject],
    projectMembers: [...state.projectMembers, privateMember],
    tasks: [...state.tasks, privateTask],
    dailyPlans: state.dailyPlans.map((plan) => ({
      ...plan,
      committedTaskIds: [...plan.committedTaskIds, privateTask.id],
    })),
  };
  await openApp(page, scopedState);

  const selector = page.getByRole("group", { name: "工作区筛选" });
  const privateOption = selector.getByRole("button", { name: "私人", exact: true });
  const sharedOption = selector.getByRole("button", { name: "E2E 工作区", exact: true });
  await expect(selector.getByRole("button")).toHaveCount(2);
  await expect(privateOption).toHaveText("私人");
  await expect(sharedOption).toHaveText("E2E 工作区");
  await expect(privateOption).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByLabel("项目卡片总览")).toContainText("TimeManage 团队进度");
  await expect(page.getByLabel("项目卡片总览")).toContainText(privateProject.name);

  await privateOption.click();
  await expect(privateOption).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel("项目卡片总览")).toContainText(privateProject.name);
  await expect(page.getByLabel("项目卡片总览")).not.toContainText("TimeManage 团队进度");

  await page.getByRole("button", { name: "新增项目" }).click();
  const createDialog = page.getByRole("dialog", { name: "新增项目" });
  await expect(createDialog.getByLabel("所属工作区")).toHaveValue("workspace_private_account_owner");
  await createDialog.getByRole("button", { name: "关闭" }).click();

  await page.getByTitle("命令面板").click();
  const commandDialog = page.getByRole("dialog", { name: "命令面板" });
  await commandDialog.getByPlaceholder(/搜索命令/).fill(sharedTask.title);
  await expect(commandDialog.locator(".command-section")).toHaveCount(0);
  await commandDialog.getByTitle("关闭").click();

  const nav = page.getByLabel("页面导航");
  await nav.getByRole("button", { name: "工作区" }).click();
  await expect(page.getByRole("heading", { name: "项目负责人私人区" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "E2E 工作区" })).toHaveCount(0);

  await nav.getByRole("button", { name: "成员状况" }).click();
  await expect(page.getByLabel("成员今日任务列")).toContainText(privateTask.title);
  await expect(page.getByLabel("成员今日任务列")).not.toContainText(sharedTask.title);

  await nav.getByRole("button", { name: "我的任务" }).click();
  await expect(page.locator(".my-project-task-panel")).toContainText(privateProject.name);
  await expect(page.locator(".my-project-task-panel")).not.toContainText(sharedProject.name);

  await nav.getByRole("button", { name: "开始工作" }).click();
  await expect(page.locator(".focus-todo-panel")).toContainText(privateTask.title);
  await expect(page.locator(".focus-todo-panel")).not.toContainText(sharedTask.title);

  await nav.getByRole("button", { name: "项目总览" }).click();
  await privateOption.click();
  await page.getByLabel("项目卡片总览").locator("article").filter({ hasText: sharedProject.name }).getByRole("button", { name: "进入项目" }).click();
  await selector.getByRole("button", { name: "私人", exact: true }).click();
  await expect(page.getByLabel("项目卡片总览")).toContainText(privateProject.name);
  await expect(page.getByText("协作工作区 · E2E 工作区")).toHaveCount(0);

  await nav.getByRole("button", { name: "管理中心" }).click();
  await expect(page.getByRole("group", { name: "工作区筛选" })).toHaveCount(0);
});

test("keeps private workspace member management locked to the owner", async ({ page }) => {
  await openApp(page);

  await page.getByLabel("页面导航").getByRole("button", { name: "工作区" }).click();
  await page.locator("article").filter({ hasText: "项目负责人私人区" }).getByRole("button", { name: /成员/ }).click();

  const dialog = page.getByRole("dialog", { name: "项目负责人私人区 成员管理" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("私人工作区");
  await expect(dialog).toContainText("私人工作区只允许本人使用，不支持添加成员。");
  await expect(dialog.getByLabel("成员登录账号")).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: "发送邀请" })).toHaveCount(0);
});

test("sends workspace invitation from shared workspace", async ({ page }) => {
  await openApp(page);

  await page.getByLabel("页面导航").getByRole("button", { name: "工作区" }).click();
  await page.locator("article").filter({ hasText: "E2E 工作区" }).getByRole("button", { name: /成员/ }).click();

  const dialog = page.getByRole("dialog", { name: "E2E 工作区 成员管理" });
  await expect(dialog).toBeVisible();
  const ownerRow = dialog.locator(".workspace-member-row").filter({ has: page.locator("strong", { hasText: "项目负责人" }) });
  const wangshuoRow = dialog.locator(".workspace-member-row").filter({ has: page.locator("strong", { hasText: "王硕" }) });
  await expect(ownerRow.getByLabel("负责人")).toBeChecked();
  await expect(ownerRow.getByLabel("执行者")).toBeChecked();
  await expect(wangshuoRow.getByLabel("负责人")).not.toBeChecked();
  await expect(wangshuoRow.getByLabel("执行者")).toBeChecked();
  await expect(wangshuoRow.getByLabel("执行者")).toBeDisabled();

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

  await expect(page.getByRole("button", { name: "退出登录：王硕" })).toBeVisible();
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
