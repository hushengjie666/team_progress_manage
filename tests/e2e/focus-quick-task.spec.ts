import { expect, test } from "@playwright/test";
import { startTimerInState } from "../../src/appModel";
import { authenticatedState } from "./support/authenticatedState";
import { openApp } from "./support/openApp";
import { MOCK_SERVER } from "./support/constants";

test.use({ viewport: { width: 1280, height: 820 } });

test("creates a configured task in another project and joins today without changing the active timer", async ({ page }, testInfo) => {
  const initial = authenticatedState();
  const project = { ...initial.projects[0], id: "project_quick_regular", name: "快捷新增项目", taskStageMode: "regular" as const };
  initial.projects.push(project);
  initial.projectMembers.push({ ...initial.projectMembers[0], id: "member_quick_owner", projectId: project.id });
  const state = startTimerInState(initial, "focus", initial.tasks[0].id, new Date().toISOString(), "quick_task_timer", { workSessionId: "quick_task_work" });
  const creates: Record<string, unknown>[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST" && new URL(request.url()).pathname === "/tasks") creates.push(request.postDataJSON());
  });
  await openApp(page, state);
  await page.getByLabel("页面导航").getByRole("button", { name: "开始工作" }).click();
  await page.getByRole("button", { name: "快捷新增今日任务" }).click();
  const dialog = page.getByRole("dialog", { name: "新增今日任务" });
  await expect(dialog.getByRole("button", { name: "创建并加入今日" })).toBeDisabled();
  await dialog.getByLabel("所属项目").selectOption(project.id);
  await dialog.getByLabel("标题", { exact: true }).fill("快速记录一个今日任务");
  await dialog.getByLabel("主执行人").selectOption("member_quick_owner");
  await dialog.getByLabel("估算时长（小时）").fill("0.5");
  await dialog.getByLabel("备注").fill("从开始工作页面直接创建");
  await dialog.getByRole("button", { name: "展开更多字段" }).click();
  await dialog.getByLabel("优先级").selectOption("high");
  await dialog.getByLabel("标签", { exact: true }).fill("临时, 今日");
  const screenshot = testInfo.outputPath("focus-quick-task-dialog.png");
  await page.screenshot({ path: screenshot });
  await testInfo.attach("focus-quick-task-dialog", { path: screenshot, contentType: "image/png" });
  await dialog.getByRole("button", { name: "创建并加入今日" }).click();
  await expect(dialog).toHaveCount(0);
  const group = page.locator(".focus-project-group").filter({ hasText: project.name });
  await expect(group).toContainText("快速记录一个今日任务");
  await expect(group).toContainText("0/2 番茄");
  await expect(page.locator(".timer-controls").getByRole("button", { name: "暂停" })).toBeVisible();
  await expect(page.locator(".timer-face")).toContainText(initial.tasks[0].title);
  expect(creates).toHaveLength(1);
  expect(creates[0]).toMatchObject({ projectId: project.id, primaryExecutorMemberId: "member_quick_owner", stage: "planning", priority: "high", tags: ["临时", "今日"], estimatePomodoros: 2 });
  await page.reload();
  await page.getByLabel("页面导航").getByRole("button", { name: "开始工作" }).click();
  await expect(group).toContainText("快速记录一个今日任务");
});

test("keeps the draft when task creation fails and allows retry", async ({ page }) => {
  await openApp(page);
  await page.getByLabel("页面导航").getByRole("button", { name: "开始工作" }).click();
  await page.getByRole("button", { name: "快捷新增今日任务" }).click();
  const dialog = page.getByRole("dialog", { name: "新增今日任务" });
  await dialog.getByLabel("标题", { exact: true }).fill("保存失败后重试的任务");
  await page.route(`${MOCK_SERVER}/tasks?**`, (route) => route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ error: "测试保存失败" }) }));
  await dialog.getByRole("button", { name: "创建并加入今日" }).click();
  await expect(dialog.getByRole("alert")).toContainText("任务保存失败");
  await expect(dialog.getByLabel("标题", { exact: true })).toHaveValue("保存失败后重试的任务");
  await expect(page.locator(".focus-todo-item").filter({ hasText: "保存失败后重试的任务" })).toHaveCount(0);
  await page.unroute(`${MOCK_SERVER}/tasks?**`);
  await dialog.getByRole("button", { name: "创建并加入今日" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator(".focus-todo-item").filter({ hasText: "保存失败后重试的任务" })).toBeVisible();
});

test("retries a failed queue addition without creating the task twice", async ({ page }) => {
  let creates = 0;
  page.on("request", (request) => {
    if (request.method() === "POST" && new URL(request.url()).pathname === "/tasks") creates += 1;
  });
  await openApp(page);
  await page.getByLabel("页面导航").getByRole("button", { name: "开始工作" }).click();
  await page.getByRole("button", { name: "快捷新增今日任务" }).click();
  const dialog = page.getByRole("dialog", { name: "新增今日任务" });
  await dialog.getByLabel("标题", { exact: true }).fill("只创建一次的今日任务");
  await page.route(`${MOCK_SERVER}/daily-plans/**`, (route) => route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ error: "测试队列保存失败" }) }));
  await dialog.getByRole("button", { name: "创建并加入今日" }).click();
  await expect(dialog.getByRole("alert")).toContainText("任务已创建，但未加入今日队列");
  await expect(dialog.getByLabel("所属项目")).toBeDisabled();
  await expect(dialog.getByLabel("标题", { exact: true })).toBeDisabled();
  await page.unroute(`${MOCK_SERVER}/daily-plans/**`);
  await dialog.getByRole("button", { name: "重试加入今日" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator(".focus-todo-item").filter({ hasText: "只创建一次的今日任务" })).toHaveCount(1);
  expect(creates).toBe(1);
});
