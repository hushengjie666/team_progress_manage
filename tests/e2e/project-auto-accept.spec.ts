import { expect, test } from "@playwright/test";
import { authenticatedState } from "./support/authenticatedState";
import { clearStoredApp, openApp } from "./support/openApp";
import { MOCK_SERVER } from "./support/constants";
import { workspaceMemberState } from "./support/scenarioStates";

test.beforeEach(async ({ page }) => { await clearStoredApp(page); });

test("defaults automatic acceptance on and persists an opt-out in project settings", async ({ page }, testInfo) => {
  await openApp(page);
  await page.getByRole("button", { name: "进入项目", exact: true }).first().click();
  await page.getByRole("button", { name: "设置", exact: true }).click();
  const toggle = page.getByRole("checkbox", { name: /完成任务后自动验收/ });
  await expect(toggle).toBeChecked();
  await page.screenshot({ path: testInfo.outputPath("project-auto-accept-setting.png") });
  await toggle.uncheck();
  const saved = page.waitForResponse((response) => response.request().method() === "PATCH" && new URL(response.url()).pathname.startsWith("/projects/"));
  await page.getByRole("button", { name: "保存项目资料" }).click();
  expect((await saved).ok()).toBe(true);
  await page.reload();
  await page.getByRole("button", { name: "进入项目", exact: true }).first().click();
  await page.getByRole("button", { name: "设置", exact: true }).click();
  await expect(toggle).not.toBeChecked();
  await page.getByLabel("页面导航").getByRole("button", { name: "开始工作" }).click();
  await page.locator(".focus-current-panel").getByRole("button", { name: "提交验收", exact: true }).click();
  await expect(page.locator(".focus-todo-item")).toContainText("待验收");
  await expect(page.getByText("已提交验收，等待项目负责人确认", { exact: true })).toBeVisible();
});

test("completes a task with automatic acceptance and keeps it completed after reload", async ({ page }) => {
  const state = authenticatedState();
  await openApp(page, state);
  await page.getByLabel("页面导航").getByRole("button", { name: "开始工作" }).click();
  await page.locator(".focus-current-panel").getByRole("button", { name: "完成任务", exact: true }).click();
  await expect(page.locator(".focus-todo-item")).toContainText("已完成");
  await expect(page.locator(".focus-todo-item")).not.toContainText("待验收");
  await expect(page.getByText("任务已完成并自动验收通过", { exact: true })).toBeVisible();
  await page.reload();
  await page.getByLabel("页面导航").getByRole("button", { name: "开始工作" }).click();
  await expect(page.locator(".focus-todo-item")).toContainText("已完成");
});

test("prevents ordinary members from changing automatic acceptance", async ({ page }) => {
  await openApp(page, workspaceMemberState());
  await page.getByRole("button", { name: "进入项目", exact: true }).first().click();
  await page.getByRole("button", { name: "设置", exact: true }).click();
  await expect(page.getByRole("checkbox", { name: /完成任务后自动验收/ })).toBeDisabled();
});

test("keeps an uncompleted task when automatic completion fails", async ({ page }) => {
  await openApp(page);
  await page.route(`${MOCK_SERVER}/tasks/*/submit-review*`, (route) => route.fulfill({
    status: 403, contentType: "application/json", body: JSON.stringify({ error: "submission denied" }),
  }));
  await page.getByLabel("页面导航").getByRole("button", { name: "开始工作" }).click();
  const complete = page.locator(".focus-current-panel").getByRole("button", { name: "完成任务", exact: true });
  await complete.click();
  await expect(page.getByRole("alert")).toContainText("submission denied");
  await expect(complete).toBeVisible();
  await expect(page.locator(".focus-todo-item")).not.toContainText("已完成");
  await expect(page.getByText("任务已完成并自动验收通过", { exact: true })).toHaveCount(0);
});
