import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { clearStoredApp, openApp } from "./support/openApp";

test.beforeEach(async ({ page }) => {
  await clearStoredApp(page);
});

const capture = async (page: Page, testInfo: TestInfo, name: string) => {
  const path = testInfo.outputPath(`${name}.png`);
  await page.screenshot({ path, fullPage: false });
  await testInfo.attach(name, { path, contentType: "image/png" });
  const storeDirectory = process.env.TM_APP_STORE_SCREENSHOTS_DIR;
  if (storeDirectory && new Set([
    "01-project-overview",
    "05-project-tasks",
    "08-my-tasks",
    "10-focus",
    "11-member-status",
  ]).has(name)) {
    const destination = resolve(storeDirectory);
    mkdirSync(destination, { recursive: true });
    await page.screenshot({ path: resolve(destination, `${name}.png`), fullPage: false });
  }
};

test("captures every mobile product surface", async ({ page }, testInfo) => {
  const storeCapture = Boolean(process.env.TM_APP_STORE_SCREENSHOTS_DIR);
  test.skip(
    storeCapture ? testInfo.project.name !== "mobile-max-webkit" : testInfo.project.name !== "mobile-pro-webkit",
    storeCapture ? "App Store screenshots use the Pro Max viewport." : "Screenshots use the standard Pro viewport.",
  );
  if (storeCapture) await page.setViewportSize({ width: 430, height: 932 });
  await openApp(page);
  const mobileNavigation = page.getByRole("navigation", { name: "手机页面导航" });

  await expect(page.getByLabel("项目卡片总览")).toBeVisible();
  await capture(page, testInfo, "01-project-overview");
  await page.getByRole("button", { name: /新增项目/ }).click();
  await expect(page.getByRole("dialog", { name: "新增项目" })).toBeVisible();
  await capture(page, testInfo, "02-create-project-sheet");
  await page.getByRole("dialog", { name: "新增项目" }).getByLabel("关闭").click();

  await page.getByRole("button", { name: "进入项目" }).first().click();
  const projectTabs = page.locator(".project-detail-tabs");
  for (const [tab, file] of [
    ["概览", "03-project-overview-tab"],
    ["排期日历", "04-project-schedule"],
    ["任务", "05-project-tasks"],
    ["成员管理", "06-project-members"],
    ["设置", "07-project-settings"],
  ] as const) {
    await projectTabs.getByRole("button", { name: tab, exact: true }).click();
    await capture(page, testInfo, file);
  }

  await mobileNavigation.getByRole("button", { name: "我的任务" }).click();
  await capture(page, testInfo, "08-my-tasks");
  await page.locator("article").filter({ hasText: "整理时间管理系统 PRD" }).getByTitle("任务详情").click();
  await expect(page.getByRole("dialog", { name: /任务详情：整理时间管理系统 PRD/ })).toBeVisible();
  await capture(page, testInfo, "09-task-detail-sheet");
  await page.getByRole("dialog", { name: /任务详情：整理时间管理系统 PRD/ }).getByRole("button", { name: "关闭" }).click();

  await mobileNavigation.getByRole("button", { name: "专注" }).click();
  await capture(page, testInfo, "10-focus");
  await mobileNavigation.getByRole("button", { name: "成员" }).click();
  await capture(page, testInfo, "11-member-status");
  await mobileNavigation.getByRole("button", { name: "更多" }).click();
  await capture(page, testInfo, "12-more-sheet");
  await page.getByRole("dialog", { name: "更多功能" }).getByRole("button", { name: "工作区" }).click();
  await capture(page, testInfo, "13-workspaces");

  await mobileNavigation.getByRole("button", { name: "更多" }).click();
  await page.getByRole("dialog", { name: "更多功能" }).getByRole("button", { name: "管理中心" }).click();
  await capture(page, testInfo, "14-settings-default");
  const settingsTabs = page.locator(".settings-section-tabs");
  for (const [tab, file] of [
    ["计时偏好", "15-settings-timer"],
    ["团队后台", "16-settings-backend"],
    ["演示数据", "17-settings-demo"],
  ] as const) {
    await settingsTabs.getByRole("button", { name: tab, exact: true }).click();
    await capture(page, testInfo, file);
  }
});
