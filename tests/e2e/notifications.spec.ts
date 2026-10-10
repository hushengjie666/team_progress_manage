import { expect, test } from "@playwright/test";
import { authenticatedState } from "./support/authenticatedState";
import { openApp } from "./support/openApp";

test.use({ viewport: { width: 1280, height: 820 } });

test("keeps deletion and undo notifications at the top right and restores the task", async ({ page }, testInfo) => {
  const state = authenticatedState();
  const task = state.tasks[0];
  task.status = "pool";
  state.tasks.push({ ...task, id: "task_notification_queue", title: "另一个待安排任务", sortOrder: 20 });
  state.dailyPlans[0].committedTaskIds = [];
  await openApp(page, state);
  await page.getByLabel("页面导航").getByRole("button", { name: "我的任务" }).click();
  const taskCard = page.locator("article").filter({ hasText: task.title });
  await taskCard.getByTitle("删除任务").click();
  await page.getByRole("dialog").getByRole("button", { name: "删除", exact: true }).click();

  const notification = page.locator(".notification-stack .undo-banner");
  await expect(notification).toContainText(task.title);
  await expect(notification).toContainText("8 秒内可撤销");
  await expect(page.locator(".global-toast")).toHaveCount(1);
  await expect(taskCard).toHaveCount(0);
  const bounds = await notification.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.y).toBeLessThan(150);
  expect(bounds!.x + bounds!.width).toBeGreaterThan(1200);
  await page.locator("article").filter({ hasText: "另一个待安排任务" }).getByRole("button", { name: "加入队列" }).click();
  const queueNotice = page.locator(".notification-stack .global-toast").filter({ hasText: "已加入工作队列" });
  await expect(queueNotice).toBeVisible();
  await expect(page.locator(".global-toast")).toHaveCount(2);
  const noticeBounds = await queueNotice.boundingBox();
  const undoBounds = await notification.boundingBox();
  expect(noticeBounds!.y + noticeBounds!.height).toBeLessThan(undoBounds!.y);
  const screenshotPath = testInfo.outputPath("delete-notification.png");
  await page.screenshot({ path: screenshotPath });
  await testInfo.attach("delete-notification", { path: screenshotPath, contentType: "image/png" });

  await notification.getByRole("button", { name: "撤销" }).click();
  await expect(notification).toHaveCount(0);
  await expect(taskCard).toBeVisible();
  await expect(page.locator(".notification-stack .global-toast")).toHaveText("已撤销删除");
});
