import { expect, test, type Locator, type Page } from "@playwright/test";
import { startTimerInState } from "../../src/appModel";
import { openApp } from "./support/openApp";
import { completionSample } from "./support/completionSample";

async function buttonCenter(button: Locator) {
  await button.scrollIntoViewIfNeeded();
  return button.evaluate((node) => {
    const box = node.getBoundingClientRect();
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  });
}

async function expectOrigin(page: Page, point: { x: number; y: number }) {
  const burst = page.locator(".completion-burst").last();
  await expect(burst.locator(".completion-paper").first()).toBeAttached();
  const box = await burst.boundingBox();
  expect(Math.abs(box!.x - point.x)).toBeLessThan(2);
  expect(Math.abs(box!.y - point.y)).toBeLessThan(2);
}

for (const mobile of [false, true]) {
  test.describe(mobile ? "mobile celebration" : "desktop celebration", () => {
    test.use({ viewport: mobile ? { width: 390, height: 844 } : { width: 1365, height: 900 }, isMobile: mobile, hasTouch: mobile });

    test("celebrates confirmed actions from all three buttons through the last planned task", async ({ page }, info) => {
      const state = completionSample();
      await openApp(page, state);
      const nav = page.getByRole("navigation", { name: mobile ? "手机页面导航" : "页面导航", exact: true });
      const focus = () => nav.getByRole("button", { name: mobile ? "专注" : "开始工作", exact: true }).click();
      await focus();
      // Navigation primes the timer's audio context. Monitor completion itself, including reuse of that context.
      await page.evaluate(() => {
        const sound = () => { document.documentElement.dataset.playedSound = "true"; };
        window.AudioContext = new Proxy(window.AudioContext, {
          construct(target, args) { sound(); return Reflect.construct(target, args); },
        });
        OscillatorNode.prototype.start = sound;
        AudioBufferSourceNode.prototype.start = sound;
        HTMLMediaElement.prototype.play = async () => { sound(); };
      });
      const card = page.locator(".focus-todo-item").filter({ hasText: state.tasks[1].title });
      const left = card.getByRole("button", { name: "完成", exact: true });
      const banner = page.locator(".completion-banner");
      const geometry = () => page.locator(".focus-orbit, .timer-face").evaluateAll((nodes) =>
        nodes.map((node) => [node.clientWidth, node.clientHeight]));
      const before = await geometry();
      await left.scrollIntoViewIfNeeded();
      // Click off-center to distinguish pointer coordinates from the keyboard fallback.
      const bounds = await left.boundingBox();
      await left.click({ position: { x: 6, y: 7 } });
      await expect(banner).toContainText("今日第 1 项");
      await expectOrigin(page, { x: bounds!.x + 7, y: bounds!.y + 8 });
      await expect(page.locator(".completion-ring")).toHaveCount(1);
      await expect(page.locator(".completion-overlay")).toHaveCSS("pointer-events", "none");
      expect(await geometry()).toEqual(before);
      await expect(banner).toHaveCSS("opacity", "1");
      await page.screenshot({ path: info.outputPath("task-completed.png") });

      const current = page.locator(".focus-current-panel").getByRole("button", { name: "完成任务" });
      const center = await buttonCenter(current);
      await current.press("Enter");
      await expect(banner).toContainText("今日第 2 项");
      await expectOrigin(page, center);
      await expect(page.locator(".focus-current-panel")).toContainText(state.tasks[2].title);

      await nav.getByRole("button", { name: "我的任务", exact: true }).click();
      const last = page.locator(".task-item").filter({ hasText: state.tasks[2].title }).getByTitle("完成任务");
      await last.click();
      await expect(banner).toContainText("今日任务全部达成！");
      await expect(banner).toContainText("共 3 项");
      await expect(page.locator(".completion-salute")).toHaveCount(2);
      await expect(page.locator(".completion-burst .completion-ring")).toHaveCount(1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
      await expect(banner).toHaveCSS("opacity", "1");
      await page.screenshot({ path: info.outputPath("all-clear.png") });
      await expect(page.locator(".completion-overlay")).toHaveCount(0);
      await focus();
      await expect(page.locator(".completed-pill")).toHaveCount(3);
      await expect(banner).toHaveCount(0);
      await expect(page.locator("html")).not.toHaveAttribute("data-played-sound", "true");
      await page.reload();
      await focus();
      await expect(page.locator(".completed-pill")).toHaveCount(3);
      await expect(banner).toHaveCount(0);
    });
  });
}

test("completes an active task outside today's cleared plan without a second milestone", async ({ page }) => {
  const state = completionSample();
  const unplanned = state.tasks[1];
  state.tasks[0].status = "completed";
  const running = startTimerInState(state, "focus", unplanned.id, new Date().toISOString(), "outside_focus",
    { workSessionId: "outside_work" });
  running.dailyPlans[0].committedTaskIds = [state.tasks[0].id];
  await openApp(page, running);
  await page.getByLabel("页面导航", { exact: true }).getByRole("button", { name: "开始工作" }).click();
  const panel = page.locator(".focus-current-panel");
  await expect(panel).toContainText("未列入今日任务");
  await panel.getByRole("button", { name: "完成任务" }).click();
  await expect(page.locator(".completion-banner")).toHaveAttribute("data-milestone", "false");
  await expect(page.locator(".completion-ring")).toHaveCount(1);
  await expect(page.locator(".completion-salute")).toHaveCount(0);
});

test("keeps both bursts while two confirmed clicks overlap", async ({ page }) => {
  const state = completionSample();
  state.dailyPlans[0].committedTaskIds.pop();
  await openApp(page, state);
  await page.getByLabel("页面导航", { exact: true }).getByRole("button", { name: "开始工作" }).click();
  const button = (title: string) => page.locator(".focus-todo-item").filter({ hasText: title })
    .getByRole("button", { name: "完成", exact: true });
  await button(state.tasks[0].title).click();
  await expect(page.locator(".completion-banner")).toContainText("今日第 1 项");
  await button(state.tasks[1].title).click();
  await expect(page.locator(".completion-banner")).toContainText("今日任务全部达成！");
  await expect(page.locator(".completion-burst")).toHaveCount(2);
  await expect(page.locator(".completion-salute")).toHaveCount(2);
  await expect(page.locator(".completion-overlay")).toHaveCount(0);
});
