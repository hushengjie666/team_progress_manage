import { expect, test } from "@playwright/test";
import { authenticatedState } from "./support/authenticatedState";
import { openApp } from "./support/openApp";

for (const mobile of [false, true]) {
  test.describe(mobile ? "mobile daily task" : "desktop daily task", () => {
    test.use({ viewport: mobile ? { width: 390, height: 844 } : { width: 1365, height: 900 },
      isMobile: mobile, hasTouch: mobile, timezoneId: "Asia/Shanghai", reducedMotion: "reduce" });

    test("checks in once per local day, restores tomorrow and respects removal, disabling and deletion", async ({ page }, info) => {
      const state = authenticatedState();
      state.projects[0].autoAcceptCompletedTasks = false;
      const title = "每日核对今日计划";
      await page.clock.install({ time: new Date("2026-11-27T23:58:00+08:00") });
      const runtime = await openApp(page, state);
      const nav = page.getByRole("navigation", { name: mobile ? "手机页面导航" : "页面导航", exact: true });
      const focus = () => nav.getByRole("button", { name: mobile ? "专注" : "开始工作", exact: true }).click();
      const workbench = () => nav.getByRole("button", { name: "我的任务", exact: true }).click();
      const card = page.locator(".focus-todo-item").filter({ hasText: title });
      const queue = page.locator(".task-column").filter({ has: page.getByRole("heading", { name: "工作队列" }) });
      const queued = queue.getByRole("article").filter({ hasText: title });
      const pool = page.locator(".task-column").filter({ has: page.getByRole("heading", { name: "活动清单" }) });
      const records = () => Object.values(runtime.workspaceStates).flatMap((workspace) => workspace.tasks).filter((task) => task.title === title);
      if (mobile) await workbench();
      else await focus();
      await page.getByRole("button", { name: "快捷新增今日任务" }).click();
      const dialog = page.getByRole("dialog", { name: "新增今日任务" });
      await dialog.getByLabel("标题", { exact: true }).fill(title);
      await dialog.getByRole("button", { name: "展开更多字段" }).click();
      await dialog.getByLabel("日常任务", { exact: true }).check();
      await expect(dialog.getByRole("combobox", { name: "重复", exact: true })).toBeDisabled();
      await dialog.getByRole("button", { name: "创建并加入今日" }).click();
      if (mobile) await focus();
      await expect(card).toContainText("日常");
      await workbench();
      await expect(queued).toContainText("日常");
      await queued.getByTitle("完成任务").click();
      await expect(queued).toContainText("已完成");
      await page.reload();
      await focus();
      await expect(card).toContainText("已完成");
      await expect(card.getByRole("button", { name: "完成", exact: true })).toHaveCount(0);
      await card.scrollIntoViewIfNeeded();
      await page.screenshot({ path: info.outputPath("completed.png") });
      await page.clock.fastForward("00:03:00");
      await expect(card.getByRole("button", { name: "开始", exact: true })).toBeVisible();
      await card.getByRole("button", { name: "完成", exact: true }).click();
      await expect(card).toContainText("已完成");
      expect(records()).toHaveLength(1);
      expect(records()[0].dailyCompletedDates).toEqual(["2026-11-27", "2026-11-28"]);
      await page.clock.fastForward("24:00:00");
      await workbench();
      await queued.getByTitle("移回活动清单").click();
      await expect(pool.getByText(title, { exact: true })).toBeVisible();
      await page.reload();
      await workbench();
      await expect(queued).toHaveCount(0);
      await page.clock.fastForward("24:00:00");
      await expect(queued).toBeVisible();
      await queued.scrollIntoViewIfNeeded();
      await page.screenshot({ path: info.outputPath("restored.png") });
      const toggle = page.getByRole("checkbox", { name: "日常任务", exact: true });
      await queued.getByTitle("任务详情").click();
      await toggle.uncheck();
      await page.getByTitle("关闭详情").click();
      await page.clock.fastForward("24:00:00");
      await expect(queued).toHaveCount(0);
      await pool.getByRole("article").filter({ hasText: title }).getByTitle("任务详情").click();
      await toggle.check();
      await page.getByTitle("关闭详情").click();
      await expect(queued).toBeVisible();
      await queued.getByTitle("删除任务").click();
      await page.getByRole("button", { name: "删除", exact: true }).click();
      await expect(queued).toHaveCount(0);
      await page.clock.fastForward("24:00:00");
      await focus();
      await expect(card).toHaveCount(0);
      expect(records()).toHaveLength(0);
    });
  });
}

test("creates an unassigned daily task in project detail and shows it in the creator's queue", async ({ page }) => {
  const title = "检查每日项目进度";
  await openApp(page);
  await page.getByRole("button", { name: "进入项目" }).first().click();
  await page.getByRole("button", { name: "添加任务" }).click();
  const dialog = page.getByRole("dialog", { name: "添加项目任务" });
  await dialog.getByLabel("标题").fill(title);
  await dialog.getByRole("button", { name: "展开更多字段" }).click();
  await dialog.getByRole("checkbox", { name: "日常任务" }).check();
  await dialog.getByRole("button", { name: "创建任务" }).click();
  await expect(page.locator(".project-stage-task-main").filter({ hasText: title })).toContainText("日常");
  await page.getByRole("navigation", { name: "页面导航", exact: true }).getByRole("button", { name: "我的任务", exact: true }).click();
  const queue = page.locator(".task-column").filter({ has: page.getByRole("heading", { name: "工作队列" }) });
  await expect(queue.getByRole("article").filter({ hasText: title })).toContainText("日常");
});
