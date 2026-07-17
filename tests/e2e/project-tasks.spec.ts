import { expect, test } from "@playwright/test";
import { MOCK_SERVER } from "./support/constants";
import { clearStoredApp, openApp } from "./support/openApp";

test.beforeEach(async ({ page }) => {
  await clearStoredApp(page);
});

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

  await expect(dialog.getByRole("spinbutton", { name: "进度百分比" })).toHaveValue("45");
  await expect(dialog.getByLabel("进展说明")).toHaveValue("E2E 进度已持久化。");
});
