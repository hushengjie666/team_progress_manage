import { expect, test } from "@playwright/test";
import { authenticatedState } from "./support/authenticatedState";
import { focusPanelSample } from "./support/focusPanelSample";
import { openApp } from "./support/openApp";

for (const [width, height] of [[1280, 820], [1365, 900], [1440, 900], [1920, 1080], [1180, 820], [390, 844]]) {
  test.describe(`focus panel at ${width}×${height}`, () => {
    const mobile = width === 390;
    test.use({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile });
    test("keeps the grouped task list readable beside or below the timer", async ({ page }, testInfo) => {
      const state = focusPanelSample();
      await openApp(page, state);
      await page.getByRole("navigation", { name: mobile ? "手机页面导航" : "页面导航", exact: true })
        .getByRole("button", { name: mobile ? "专注" : "开始工作", exact: true }).click();

      const panel = page.locator(".focus-todo-panel");
      const groups = panel.locator(".focus-project-group");
      const list = panel.locator(".focus-todo-list");
      await expect(panel.locator(".focus-todo-summary")).toHaveText("共 13 项 · 已完成 9 项");
      await expect(groups.first().locator(".running-pill")).toHaveText("执行中");
      await expect(groups.first().locator(".review-pill")).toHaveText("待验收");
      await expect(groups.first().locator(".completed-pill")).toHaveCount(1);
      await expect(groups.last().locator(".completed-pill")).toHaveCount(8);
      const todo = groups.first().getByRole("article").filter({ hasText: "核对本周交付清单" });
      const done = groups.first().getByRole("article").filter({ hasText: "整理访谈记录" });
      expect((await done.boundingBox())!.height).toBeLessThan((await todo.boundingBox())!.height - 10);
      const start = todo.getByRole("button", { name: "开始" });
      const complete = todo.getByRole("button", { name: "完成" });
      expect((await start.boundingBox())!.y).toBe((await complete.boundingBox())!.y);

      const overflow = await page.locator("html, .focus-todo-panel, .focus-todo-list, .focus-todo-item, .focus-todo-item strong, .focus-project-heading")
        .evaluateAll((nodes) => nodes.filter((node) => node.scrollWidth - node.clientWidth > 1).map((node) => node.className));
      expect(overflow).toEqual([]);
      const box = (await panel.boundingBox())!;
      const stage = (await page.locator(".focus-stage").boundingBox())!;
      if (width > 1180) {
        expect(box.width).toBeGreaterThanOrEqual(380);
        expect(box.width).toBeLessThanOrEqual(440);
        expect(box.x + box.width).toBeLessThan(stage.x);
        const timer = (await page.locator(".focus-timer-panel").boundingBox())!;
        const orbit = (await page.locator(".focus-orbit").boundingBox())!;
        const face = (await page.locator(".timer-face").boundingBox())!;
        expect(orbit.width).toBe(orbit.height);
        expect(face.width).toBe(face.height);
        expect(orbit.x + orbit.width / 2).toBeCloseTo(timer.x + timer.width / 2, 1);
        expect(face.x + face.width / 2).toBeCloseTo(orbit.x + orbit.width / 2, 1);
        expect(face.y + face.height / 2).toBeCloseTo(orbit.y + orbit.height / 2, 1);
        expect(orbit.x + orbit.width).toBeLessThanOrEqual(stage.x + stage.width);
        expect(orbit.y + orbit.height).toBeLessThanOrEqual(stage.y + stage.height);
        const countdown = page.locator(".timer-countdown");
        await expect(countdown).not.toHaveText(await countdown.innerText());
        expect(await page.locator(".timer-face").boundingBox()).toEqual(face);
        expect(await page.locator(".focus-orbit").boundingBox()).toEqual(orbit);
        const scroll = await list.evaluate((node) => {
          const card = node.querySelector("article")!.getBoundingClientRect();
          node.scrollTop = node.scrollHeight;
          const distance = node.scrollTop;
          node.scrollTop = 0;
          return { distance, inset: node.clientWidth + node.getBoundingClientRect().left - card.right };
        });
        expect(scroll.distance).toBeGreaterThan(0);
        expect(scroll.inset).toBeGreaterThanOrEqual(8);
      } else {
        expect(box.y).toBeGreaterThanOrEqual(stage.y + stage.height);
      }

      await start.focus();
      await page.keyboard.press("Tab");
      await expect(complete).toBeFocused();
      await expect(complete).toHaveCSS("outline-style", "solid");
      if (mobile) await panel.evaluate((node) => {
        const topbar = document.querySelector(".topbar")!.getBoundingClientRect();
        window.scrollBy(0, node.getBoundingClientRect().top - topbar.bottom - 8);
      });
      await page.screenshot({ path: testInfo.outputPath(`focus-panel-${width}.png`) });
    });
  });
}

test("shows an empty plan with the quick-add action and no progress count", async ({ page }) => {
  const state = authenticatedState();
  state.tasks = [];
  state.dailyPlans[0].committedTaskIds = [];
  await openApp(page, state);
  await page.getByLabel("页面导航", { exact: true }).getByRole("button", { name: "开始工作" }).click();
  const panel = page.locator(".focus-todo-panel");
  await expect(panel).toContainText("今日任务为空");
  await expect(panel.locator(".focus-todo-summary")).toHaveCount(0);
  await expect(panel.getByRole("button", { name: "快捷新增今日任务" })).toBeEnabled();
});
