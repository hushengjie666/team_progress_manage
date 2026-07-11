import { expect, test, type Page } from "@playwright/test";
import { clearStoredApp, openApp } from "./support/openApp";

test.beforeEach(async ({ page }) => {
  await clearStoredApp(page);
});

const expectNoPageOverflow = async (page: Page) => {
  const size = await page.evaluate(() => ({ clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
  expect(size.scrollWidth).toBeLessThanOrEqual(size.clientWidth);
};

test("offers every primary mobile destination and mobile-safe project detail", async ({ page }) => {
  await openApp(page);

  const mobileNavigation = page.getByRole("navigation", { name: "手机页面导航" });
  await expect(mobileNavigation).toBeVisible();
  for (const label of ["总览", "我的任务", "专注", "成员", "更多"]) {
    await expect(mobileNavigation.getByRole("button", { name: label })).toBeVisible();
  }
  await expect(page.getByRole("navigation", { name: "页面导航", exact: true })).toBeHidden();
  await expectNoPageOverflow(page);

  await page.getByRole("button", { name: "进入项目" }).click();
  const projectTabs = page.locator(".project-detail-tabs");
  await expect(projectTabs.getByRole("button", { name: "概览" })).toBeVisible();
  await expect(projectTabs.getByRole("button", { name: "设置" })).toBeVisible();
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  await expectNoPageOverflow(page);
  for (const tabName of ["排期日历", "任务", "成员管理", "设置", "概览"]) {
    await projectTabs.getByRole("button", { name: tabName }).click();
    await expectNoPageOverflow(page);
    if (tabName === "排期日历") {
      const titleWidth = await page.getByRole("heading", { name: /排期$/ }).evaluate((element) => element.getBoundingClientRect().width);
      expect(titleWidth).toBeGreaterThan(200);
    }
    if (tabName === "任务") {
      const taskRow = page.locator(".project-task-row").first();
      expect(await taskRow.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    }
    if (tabName === "成员管理") {
      const summaryColumns = await page.locator(".project-member-summary-grid").evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(" ").length);
      expect(summaryColumns).toBe(2);
    }
  }

  await mobileNavigation.getByRole("button", { name: "我的任务" }).click();
  await expect(page.getByRole("heading", { name: "工作队列" })).toBeVisible();
  await expect(page.getByRole("button", { name: "上移任务" })).toBeVisible();
  await expect(page.getByRole("button", { name: "下移任务" })).toBeVisible();

  await mobileNavigation.getByRole("button", { name: "专注" }).click();
  await expect(page.getByRole("button", { name: "开始工作" })).toBeVisible();
  await expectNoPageOverflow(page);

  await mobileNavigation.getByRole("button", { name: "成员" }).click();
  await expect(page.locator("p.eyebrow").filter({ hasText: "成员状况" })).toBeVisible();
  await expectNoPageOverflow(page);

  await mobileNavigation.getByRole("button", { name: "更多" }).click();
  const more = page.getByRole("dialog", { name: "更多功能" });
  await expect(more.getByRole("button", { name: "工作区" })).toBeVisible();
  await expect(more.getByRole("button", { name: "管理中心" })).toBeVisible();
  await expect(more.getByRole("button", { name: /退出登录/ })).toBeVisible();
  await more.getByRole("button", { name: "工作区" }).click();
  await expect(page.getByRole("heading", { name: "我的工作区" })).toBeVisible();
  await expectNoPageOverflow(page);

  await mobileNavigation.getByRole("button", { name: "更多" }).click();
  await page.getByRole("dialog", { name: "更多功能" }).getByRole("button", { name: "管理中心" }).click();
  await expect(page.getByRole("heading", { name: "成员库、偏好与系统能力" })).toBeVisible();
  await expectNoPageOverflow(page);
});

test("keeps the app usable in iPhone landscape", async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await openApp(page);
  await expect(page.getByRole("navigation", { name: "手机页面导航" })).toBeVisible();
  await expectNoPageOverflow(page);
});
