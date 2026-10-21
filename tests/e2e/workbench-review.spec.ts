import { expect, test } from "@playwright/test";
import { authenticatedState } from "./support/authenticatedState";
import { MOCK_SERVER } from "./support/constants";
import { clearStoredApp, openApp } from "./support/openApp";

test.beforeEach(async ({ page }) => {
  await clearStoredApp(page);
});

test("quickly accepts a pending task from the activity list and persists completion", async ({ page }) => {
  const state = authenticatedState();
  const task = { ...state.tasks[0], status: "pending_review" as const, progressPercent: 100 };
  state.tasks = [task, { ...task, id: "task_pool", title: "尚未提交验收", status: "pool", progressPercent: 0 }];
  state.dailyPlans = [];
  await openApp(page, state);
  await page.getByLabel("页面导航").getByRole("button", { name: "我的任务" }).click();
  const activity = page.locator("section.task-column").filter({ has: page.getByRole("heading", { name: "活动清单" }) });
  const card = activity.locator("article").filter({ hasText: task.title });
  const quickAccept = card.getByRole("button", { name: "快速验收通过" });
  await expect(quickAccept).toBeVisible();
  await expect(activity.locator("article").filter({ hasText: "尚未提交验收" }).getByRole("button", { name: "快速验收通过" })).toHaveCount(0);
  await page.screenshot({ path: "test-results/workbench-quick-review.png", fullPage: true });
  const request = page.waitForRequest((item) => item.method() === "POST" && item.url().includes(`/tasks/${task.id}/accept-review`));
  await quickAccept.click();
  expect((await request).headers()["idempotency-key"]).toBe(`accept-review:${task.id}`);
  await expect(page.getByText("验收通过，任务已完成", { exact: true })).toBeVisible();
  await expect(card).toHaveCount(0);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.reload();
  await page.getByLabel("页面导航").getByRole("button", { name: "我的任务" }).click();
  await expect(card).toHaveCount(0);
  await expect(page.locator("article").filter({ hasText: task.title }).getByLabel("今日已完成的任务")).toBeVisible();
});

test("keeps a task pending when quick acceptance fails", async ({ page }) => {
  const state = authenticatedState();
  state.tasks[0] = { ...state.tasks[0], status: "pending_review", progressPercent: 100 };
  state.dailyPlans = [];
  await openApp(page, state);
  await page.route(`${MOCK_SERVER}/tasks/*/accept-review*`, (route) => route.fulfill({
    status: 403, contentType: "application/json", body: JSON.stringify({ error: "task review denied" }),
  }));
  await page.getByLabel("页面导航").getByRole("button", { name: "我的任务" }).click();
  await page.getByRole("button", { name: "快速验收通过" }).click();
  await expect(page.getByText(/task review denied/).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "快速验收通过" })).toBeVisible();
  await expect(page.getByText("验收通过，任务已完成", { exact: true })).toHaveCount(0);
});

test("hides quick acceptance from an executor without review permission", async ({ page }) => {
  const state = authenticatedState();
  state.tasks[0] = { ...state.tasks[0], status: "pending_review", progressPercent: 100 };
  state.dailyPlans = [];
  state.auth.workspace = { ...state.auth.workspace!, ownerAccountId: "account_other" };
  state.auth.workspaces = state.auth.workspaces?.map((workspace) => workspace.id === state.auth.workspace!.id ? state.auth.workspace! : workspace);
  state.auth.membership = { ...state.auth.membership!, role: "member" };
  state.auth.workspaceMemberships = state.auth.workspaceMemberships?.map((membership) =>
    membership.accountId === state.auth.account!.id && membership.workspaceId === state.auth.workspace!.id
      ? { ...membership, role: "member" } : membership);
  state.projectMembers = state.projectMembers.map((member) => ({ ...member, roles: ["executor"] }));
  await openApp(page, state);
  await page.getByLabel("页面导航").getByRole("button", { name: "我的任务" }).click();
  await expect(page.locator("article").filter({ hasText: state.tasks[0].title })).toBeVisible();
  await expect(page.getByRole("button", { name: "快速验收通过" })).toHaveCount(0);
});
