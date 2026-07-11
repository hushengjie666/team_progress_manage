import { expect, test, type Page } from "@playwright/test";
import { clearStoredApp, openApp } from "./support/openApp";

test.beforeEach(async ({ page }) => {
  await clearStoredApp(page);
});

const expectNoPageOverflow = async (page: Page) => {
  const size = await page.evaluate(() => ({ clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
  expect(size.scrollWidth).toBeLessThanOrEqual(size.clientWidth);
};

const expectTouchTargets = async (page: Page, selector: string) => {
  const undersized = await page.locator(selector).evaluateAll((elements) => elements
    .filter((element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return style.display !== "none" && style.visibility !== "hidden" && (rect.width < 44 || rect.height < 44);
    })
    .map((element) => ({
      text: element.getAttribute("aria-label") || element.textContent?.trim().slice(0, 40),
      rect: element.getBoundingClientRect().toJSON(),
    })));
  expect(undersized).toEqual([]);
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
  await expectTouchTargets(page, ".mobile-bottom-nav button");

  await page.getByRole("button", { name: "进入项目" }).click();
  const projectTabs = page.locator(".project-detail-tabs");
  await expect(projectTabs.getByRole("button", { name: "概览" })).toBeVisible();
  await expect(projectTabs.getByRole("button", { name: "设置" })).toBeVisible();
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  await expectNoPageOverflow(page);
  await expectTouchTargets(page, ".project-detail-tabs button");
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
      expect(summaryColumns).toBe((page.viewportSize()?.width ?? 0) <= 390 ? 1 : 2);
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
  const settingsTabs = page.locator(".settings-section-tabs");
  for (const tabName of ["计时偏好", "团队后台", "演示数据"]) {
    await settingsTabs.getByRole("button", { name: tabName }).click();
    await expectNoPageOverflow(page);
  }
  await expectTouchTargets(page, ".settings-section-tabs button");
});

test("keeps the app usable in iPhone landscape", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-pro-webkit", "Landscape is verified on the standard Pro viewport.");
  await page.setViewportSize({ width: 844, height: 390 });
  await openApp(page);
  await expect(page.getByRole("navigation", { name: "手机页面导航" })).toBeVisible();
  await expectNoPageOverflow(page);
});

test("keeps mobile sheets and form controls reachable", async ({ page }) => {
  await openApp(page);
  await page.getByRole("button", { name: /新增项目/ }).click();
  const createProjectDialog = page.getByRole("dialog", { name: "新增项目" });
  await expect(createProjectDialog).toBeVisible();
  await createProjectDialog.getByLabel("项目名称").fill("移动端键盘检查");
  await expect(createProjectDialog.getByRole("button", { name: "添加项目" })).toBeVisible();
  await expectTouchTargets(page, ".quick-project-create-modal button, .quick-project-create-modal input, .quick-project-create-modal select, .quick-project-create-modal textarea");
  await createProjectDialog.getByLabel("关闭").click();

  const mobileNavigation = page.getByRole("navigation", { name: "手机页面导航" });
  await mobileNavigation.getByRole("button", { name: "我的任务" }).click();
  const taskCard = page.locator("article").filter({ hasText: "整理时间管理系统 PRD" });
  await taskCard.getByTitle("任务详情").click();
  const taskDialog = page.getByRole("dialog", { name: /任务详情：整理时间管理系统 PRD/ });
  await expect(taskDialog).toBeVisible();
  await expectNoPageOverflow(page);
  await expect(taskDialog.getByLabel("进展说明")).toBeVisible();
  await taskDialog.getByRole("button", { name: "关闭" }).click();
});

test("keeps the main workflow readable at 200 percent text size", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-pro-webkit", "Text scaling is verified on the standard Pro viewport.");
  await openApp(page);
  await page.evaluate(() => document.documentElement.style.fontSize = "200%");
  await expect(page.getByRole("navigation", { name: "手机页面导航" })).toBeVisible();
  await expectNoPageOverflow(page);
  await page.getByRole("button", { name: "进入项目" }).first().click();
  await expect(page.getByRole("heading", { name: "任务阶段总览" })).toBeVisible();
  await expectNoPageOverflow(page);
});
