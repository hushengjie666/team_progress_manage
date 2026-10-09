import { expect, test } from "@playwright/test";
import { MOCK_SERVER } from "./support/constants";
import { clearStoredApp, openApp } from "./support/openApp";
import { authenticatedState } from "./support/authenticatedState";
import { taskStageOptions } from "../../src/appTaskMetadata";
import type { TaskStageMode } from "../../src/types";

test.beforeEach(async ({ page }) => {
  await clearStoredApp(page);
});

for (const mode of ["regular", "software"] as TaskStageMode[]) {
  test(`shows all task stages in overview and schedule for a ${mode} project`, async ({ page }) => {
    const state = authenticatedState();
    const now = new Date().toISOString();
    state.projects = state.projects.map((project) => ({ ...project, taskStageMode: mode }));
    state.tasks = taskStageOptions.map(({ value, label }, index) => ({
      ...state.tasks[0],
      id: `task_stage_${value}`,
      title: `E2E ${label}阶段任务`,
      stage: value,
      status: "pool",
      expectedStartAt: now,
      expectedFinishAt: now,
      sortOrder: index,
    }));
    await openApp(page, state);
    await page.getByRole("button", { name: "进入项目" }).first().click();
    const overview = page.locator(".project-stage-overview");
    await expect(overview.getByRole("button")).toHaveCount(state.tasks.length);
    for (const { label } of taskStageOptions) {
      const row = overview.locator(".project-stage-row").filter({ has: page.locator(".project-stage-label strong", { hasText: label }) });
      await expect(row.locator(".project-stage-label span")).toHaveText("1");
      await expect(row.getByRole("button", { name: `E2E ${label}阶段任务` })).toBeVisible();
    }
    await page.getByRole("button", { name: "任务", exact: true }).click();
    await expect(page.locator(".project-task-row")).toHaveCount(state.tasks.length);
    await page.getByRole("button", { name: "排期日历" }).click();
    const timeline = page.getByRole("region", { name: "项目排期时间轴" });
    await expect(timeline.getByRole("button")).toHaveCount(state.tasks.length);
    for (const { label } of taskStageOptions) {
      await expect(timeline.getByRole("button", { name: `E2E ${label}阶段任务` })).toBeVisible();
    }
  });
}

test("opens a project and creates a task with the unified task form", async ({ page }) => {
  await openApp(page);

  await page.getByRole("button", { name: "进入项目" }).first().click();
  await expect(page.getByRole("heading", { name: "任务阶段总览" })).toBeVisible();

  await page.getByRole("button", { name: "添加任务" }).click();
  const dialog = page.getByRole("dialog", { name: "添加项目任务" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("标题")).toBeVisible();
  await expect(dialog.getByLabel("主执行人")).toBeVisible();
  await expect(dialog.getByLabel("估算时长（小时）")).toBeVisible();
  await expect(dialog.getByRole("radiogroup", { name: "任务阶段" })).toBeVisible();
  await expect(dialog.getByLabel("任务类型")).toHaveCount(0);

  await dialog.getByLabel("标题").fill("E2E 项目弹窗任务");
  await dialog.getByRole("radio", { name: "开发" }).click();
  await dialog.getByLabel("估算时长（小时）").fill("2");
  const saveRequest = page.waitForRequest((request) =>
    request.url().startsWith(`${MOCK_SERVER}/tasks`) && request.method() === "POST",
  );
  await dialog.getByRole("button", { name: "创建任务" }).click();

  await expect(dialog).toHaveCount(0);
  await expect(page.getByText("E2E 项目弹窗任务").first()).toBeVisible();
  const requestBody = (await saveRequest).postDataJSON();
  expect(requestBody).toEqual(expect.objectContaining({
    title: "E2E 项目弹窗任务",
    stage: "development",
    estimatePomodoros: 5,
  }));
});

test("edits task detail and persists progress fields", async ({ page }) => {
  await openApp(page);

  await page.getByRole("button", { name: "我的任务" }).click();
  await page.locator("article").filter({ hasText: "整理时间管理系统 PRD" }).getByTitle("任务详情").click();

  const dialog = page.getByRole("dialog", { name: /任务详情：整理时间管理系统 PRD/ });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("spinbutton", { name: "进度百分比" }).fill("45");
  const progressRequest = page.waitForRequest((request) => {
    if (!request.url().startsWith(`${MOCK_SERVER}/tasks/task_e2e_prd`) || request.method() !== "PATCH") return false;
    return request.postDataJSON().progressNote === "E2E 进度已持久化。";
  });
  await dialog.getByLabel("进展说明").fill("E2E 进度已持久化。");
  const requestBody = (await progressRequest).postDataJSON();
  expect(requestBody).toEqual(expect.objectContaining({ progressNote: "E2E 进度已持久化。" }));
  expect(requestBody).not.toHaveProperty("status");
  expect(requestBody).not.toHaveProperty("reviewSubmittedAt");

  await expect(dialog.getByRole("spinbutton", { name: "进度百分比" })).toHaveValue("45");
  await expect(dialog.getByLabel("进展说明")).toHaveValue("E2E 进度已持久化。");
});
