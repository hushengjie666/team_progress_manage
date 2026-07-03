import { expect, test } from "@playwright/test";
import { clearStoredApp, openApp } from "./support/openApp";

test.beforeEach(async ({ page }) => {
  await clearStoredApp(page);
});

test("opens current navigation and primary work surfaces", async ({ page }) => {
  await openApp(page);

  const nav = page.getByLabel("页面导航");
  await expect(nav.getByRole("button", { name: "项目总览" })).toBeVisible();
  await expect(nav.getByRole("button", { name: "我的任务" })).toBeVisible();
  await expect(nav.getByRole("button", { name: "管理中心" })).toBeVisible();
  await expect(page.getByLabel("项目卡片总览")).toContainText("TimeManage 团队进度");

  await nav.getByRole("button", { name: "我的任务" }).click();
  await expect(page.getByRole("heading", { name: "活动清单" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "工作队列" })).toBeVisible();

  await nav.getByRole("button", { name: "管理中心" }).click();
  await expect(page.getByRole("heading", { name: "成员库、偏好与系统能力" })).toBeVisible();

  await nav.getByRole("button", { name: "开始工作" }).click();
  await expect(page.getByRole("heading", { name: "当下清单" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "今日任务" })).toBeVisible();
});

test("keeps retired review/report surfaces out of navigation and opens command palette", async ({ page }) => {
  await openApp(page);

  const nav = page.getByLabel("页面导航");
  await expect(nav.getByRole("button", { name: "历史日报" })).toHaveCount(0);
  await expect(nav.getByRole("button", { name: "每日总结" })).toHaveCount(0);
  await expect(nav.getByRole("button", { name: "复盘洞察" })).toHaveCount(0);

  await page.keyboard.press("/");
  await expect(page.getByRole("dialog", { name: "命令面板" })).toBeVisible();
});
