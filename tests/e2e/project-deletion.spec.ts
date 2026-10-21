import { expect, test } from "@playwright/test";
import { authenticatedState } from "./support/authenticatedState";
import { clearStoredApp, openApp } from "./support/openApp";
import { MOCK_SERVER } from "./support/constants";
import { workspaceMemberState } from "./support/scenarioStates";

test.beforeEach(async ({ page }) => { await clearStoredApp(page); });

test("confirms project deletion from settings and persists cleanup", async ({ page }, testInfo) => {
  const state = authenticatedState();
  const project = state.projects[0];
  state.projects.push({ ...project, id: "project_keep", name: "保留项目" });
  await openApp(page, state);
  const card = page.locator(`[data-project-card-id="${project.id}"]`);
  let deletes = 0;
  page.on("request", (request) => { if (request.method() === "DELETE") deletes += 1; });
  await expect(card.getByRole("button", { name: "删除项目", exact: true })).toHaveCount(0);
  await card.screenshot({ path: testInfo.outputPath("project-card-without-delete.png") });
  await card.getByRole("button", { name: "进入项目", exact: true }).click();
  await page.getByRole("button", { name: "设置", exact: true }).click();
  await page.getByRole("button", { name: "删除项目", exact: true }).focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "删除项目", exact: true });
  await expect(dialog).toContainText(project.name);
  await expect(dialog).toContainText("1 个任务");
  await page.screenshot({ path: testInfo.outputPath("project-delete-confirmation.png") });
  await dialog.getByRole("button", { name: "取消", exact: true }).click();
  await expect(page.getByRole("button", { name: "删除项目", exact: true })).toBeVisible();
  expect(deletes).toBe(0);
  await page.getByRole("button", { name: "删除项目", exact: true }).click();
  await dialog.getByRole("button", { name: "删除项目及任务" }).click();
  await expect(card).toHaveCount(0);
  await expect(page.getByText("项目及关联任务已删除", { exact: true })).toBeVisible();
  await expect(page.locator('[data-project-card-id="project_keep"]')).toBeVisible();
  await page.reload();
  await expect(card).toHaveCount(0);
  await page.getByLabel("页面导航").getByRole("button", { name: "我的任务" }).click();
  await expect(page.locator("article").filter({ hasText: state.tasks[0].title })).toHaveCount(0);
});

test("keeps the project and confirmation open after a failed delete and supports retry", async ({ page }) => {
  const state = authenticatedState();
  await openApp(page, state);
  const card = page.locator(`[data-project-card-id="${state.projects[0].id}"]`);
  await card.getByRole("button", { name: "进入项目", exact: true }).click();
  await page.getByRole("button", { name: "设置", exact: true }).click();
  const endpoint = `${MOCK_SERVER}/projects/${state.projects[0].id}*`;
  await page.route(endpoint, async (route) => {
    if (route.request().method() === "DELETE") {
      await route.fulfill({ status: 403, contentType: "application/json", body: JSON.stringify({ error: "delete denied" }) });
    } else await route.fallback();
  });
  await page.getByRole("button", { name: "删除项目", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "删除项目", exact: true });
  await dialog.getByRole("button", { name: "删除项目及任务" }).click();
  await expect(dialog.getByRole("alert")).toContainText("删除失败");
  await expect(page.getByRole("button", { name: "删除项目", exact: true })).toBeVisible();
  await page.unroute(endpoint);
  await dialog.getByRole("button", { name: "删除项目及任务" }).click();
  await expect(card).toHaveCount(0);
});

test("blocks repeated confirmation while project deletion is being saved", async ({ page }) => {
  const state = authenticatedState();
  await openApp(page, state);
  let release = () => {};
  let started = () => {};
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const writeStarted = new Promise<void>((resolve) => { started = resolve; });
  let requests = 0;
  await page.route(`${MOCK_SERVER}/projects/${state.projects[0].id}*`, async (route) => {
    if (route.request().method() !== "DELETE") return route.fallback();
    requests += 1;
    started();
    await gate;
    await route.fallback();
  });
  const card = page.locator(`[data-project-card-id="${state.projects[0].id}"]`);
  await card.getByRole("button", { name: "进入项目", exact: true }).click();
  await page.getByRole("button", { name: "设置", exact: true }).click();
  await page.getByRole("button", { name: "删除项目", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "删除项目", exact: true });
  await dialog.getByRole("button", { name: "删除项目及任务" }).click();
  await writeStarted;
  try {
    await expect(dialog.getByRole("button", { name: "正在删除…", exact: true })).toBeDisabled();
    await expect(dialog.getByRole("button", { name: "取消", exact: true })).toBeDisabled();
    await expect(page.getByRole("button", { name: "删除项目", exact: true })).toBeVisible();
    expect(requests).toBe(1);
  } finally {
    release();
  }
  await expect(card).toHaveCount(0);
});

test("deletes a project from settings and returns to the project overview", async ({ page }) => {
  await openApp(page);
  await page.getByRole("button", { name: "进入项目", exact: true }).first().click();
  await page.getByRole("button", { name: "设置", exact: true }).click();
  await page.getByRole("button", { name: "删除项目", exact: true }).click();
  await page.getByRole("dialog", { name: "删除项目", exact: true }).getByRole("button", { name: "删除项目及任务" }).click();
  await expect(page.getByLabel("项目卡片总览")).toBeVisible();
  await expect(page.getByRole("heading", { name: "项目不存在或已被删除。" })).toHaveCount(0);
});

test("hides project deletion from a workspace member without management permission", async ({ page }) => {
  await openApp(page, workspaceMemberState());
  await expect(page.getByRole("button", { name: "进入项目", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "删除项目", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "进入项目", exact: true }).click();
  await page.getByRole("button", { name: "设置", exact: true }).click();
  await expect(page.getByRole("button", { name: "删除项目", exact: true })).toHaveCount(0);
});

for (const status of ["pool", "pending_review", "completed", "archived"] as const) {
  test(`deletes a ${status} task from the project task list with confirmation`, async ({ page }) => {
    const state = authenticatedState();
    state.tasks[0].status = status;
    await openApp(page, state);
    await page.getByRole("button", { name: "进入项目", exact: true }).first().click();
    await page.getByRole("button", { name: "任务", exact: true }).click();
    const row = page.locator(".project-task-row").filter({ hasText: state.tasks[0].title });
    await row.getByRole("button", { name: "删除任务", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "删除任务", exact: true });
    await expect(dialog).toContainText(state.tasks[0].title);
    await dialog.getByRole("button", { name: "取消", exact: true }).click();
    await expect(row).toBeVisible();
    await row.getByRole("button", { name: "删除任务", exact: true }).click();
    await dialog.getByRole("button", { name: "删除", exact: true }).click();
    await expect(row).toHaveCount(0);
    await page.reload();
    await page.getByRole("button", { name: "进入项目", exact: true }).first().click();
    await page.getByRole("button", { name: "任务", exact: true }).click();
    await expect(row).toHaveCount(0);
  });
}

test("allows deleting a queued task from its detail dialog", async ({ page }) => {
  await openApp(page);
  await page.getByLabel("页面导航").getByRole("button", { name: "我的任务" }).click();
  const queue = page.locator("section.task-column").filter({ has: page.getByRole("heading", { name: "工作队列" }) });
  await expect(queue.getByRole("button", { name: "删除任务", exact: true })).toBeVisible();
  await queue.getByRole("button", { name: "任务详情", exact: true }).click();
  const detail = page.getByRole("dialog", { name: /任务详情：/ });
  await detail.getByRole("button", { name: "删除任务", exact: true }).click();
  await page.getByRole("dialog", { name: "删除任务", exact: true }).getByRole("button", { name: "删除", exact: true }).click();
  await expect(detail).toHaveCount(0);
  await expect(queue.locator("article")).toHaveCount(0);
});
