import { expect, test } from "@playwright/test";
import { MOCK_SERVER } from "./support/constants";
import { authenticatedState } from "./support/authenticatedState";
import { clearStoredApp, openApp } from "./support/openApp";

test.beforeEach(async ({ page }) => { await clearStoredApp(page); });

const queueState = () => {
  const state = authenticatedState();
  state.tasks.push({ ...state.tasks[0], id: "task_queue_recovery", title: "队列故障恢复任务", status: "pool", sortOrder: 20 });
  return state;
};

test("keeps tasks visible after queue saving fails and recovers through refresh", async ({ page }, testInfo) => {
  await openApp(page, queueState());
  await page.getByLabel("页面导航").getByRole("button", { name: "我的任务" }).click();
  await page.route(`${MOCK_SERVER}/daily-plans/**`, (route) => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "暂时无法保存" }) }));
  const activity = page.locator("section.task-column").filter({ has: page.getByRole("heading", { name: "活动清单" }) });
  await activity.locator("article").filter({ hasText: "队列故障恢复任务" }).getByRole("button", { name: "加入队列" }).click();

  const alert = page.getByRole("alert");
  await expect(alert).toContainText("暂时无法保存");
  await expect(activity.locator("article").filter({ hasText: "队列故障恢复任务" })).toBeVisible();
  await expect(page.getByRole("button", { name: "退出登录：项目负责人" })).toBeVisible();
  const screenshot = testInfo.outputPath("queue-save-recovery.png");
  await page.screenshot({ path: screenshot });
  await testInfo.attach("queue-save-recovery", { path: screenshot, contentType: "image/png" });

  await alert.getByRole("button", { name: "刷新数据" }).click();
  await expect(alert).toHaveCount(0);
  await expect(activity.locator("article").filter({ hasText: "队列故障恢复任务" })).toBeVisible();
});

test("retries a transient queue failure with the same mutation key", async ({ page }) => {
  await openApp(page, queueState());
  await page.getByLabel("页面导航").getByRole("button", { name: "我的任务" }).click();
  const keys: string[] = [];
  await page.route(`${MOCK_SERVER}/daily-plans/**`, async (route) => {
    keys.push(route.request().headers()["idempotency-key"]);
    if (keys.length === 1) await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "暂时无法保存" }) });
    else await route.fallback();
  });
  const task = page.locator("article").filter({ hasText: "队列故障恢复任务" });
  await task.getByRole("button", { name: "加入队列" }).click();

  await expect(page.getByText("已加入工作队列")).toBeVisible();
  const queue = page.locator("section.task-column").filter({ has: page.getByRole("heading", { name: "工作队列" }) });
  await expect(queue.locator("article").filter({ hasText: "队列故障恢复任务" })).toBeVisible();
  expect(keys).toHaveLength(2);
  expect(keys[0]).toBe(keys[1]);
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("uses a new mutation key when a removed task is queued again", async ({ page }) => {
  await openApp(page, queueState());
  await page.getByLabel("页面导航").getByRole("button", { name: "我的任务" }).click();
  const addKeys: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/add-task") && request.method() === "POST") addKeys.push(request.headers()["idempotency-key"]);
  });
  const task = page.locator("article").filter({ hasText: "队列故障恢复任务" });
  await task.getByRole("button", { name: "加入队列" }).click();
  await expect(task.getByTitle("移回活动清单")).toBeVisible();
  await task.getByTitle("移回活动清单").click();
  await expect(task.getByRole("button", { name: "加入队列" })).toBeVisible();
  await task.getByRole("button", { name: "加入队列" }).click();
  await expect(task.getByTitle("移回活动清单")).toBeVisible();
  await expect.poll(() => addKeys.length).toBe(2);
  expect(addKeys[0]).not.toBe(addKeys[1]);
});
