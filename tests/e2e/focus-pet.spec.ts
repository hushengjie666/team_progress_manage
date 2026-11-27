import { expect, test } from "@playwright/test";
import { startTimerInState, toggleTimerInState } from "../../src/appModel";
import { DAY } from "../../src/focusPet/model";
import { authenticatedState } from "./support/authenticatedState";
import { MOCK_SERVER } from "./support/constants";
import { rowsFromState } from "./support/mockTeamBackendState";
import { openApp } from "./support/openApp";

for (const mobile of [false, true]) {
  const device = mobile ? "mobile" : "desktop";
  test.describe(device, () => {
    test.use({ viewport: mobile ? { width: 390, height: 844 } : { width: 1365, height: 900 }, isMobile: mobile, hasTouch: mobile });
    test("adopts, earns, feeds, dresses and inherits the wardrobe", async ({ page }, info) => {
      const initial = authenticatedState();
      initial.settings.focusMinutes = 540;
      await page.clock.install();
      const runtime = await openApp(page, initial);
      const nav = page.getByRole("navigation", { name: mobile ? "手机页面导航" : "页面导航", exact: true });
      const work = () => nav.getByRole("button", { name: mobile ? "专注" : "开始工作", exact: true }).click();
      const house = page.getByRole("dialog", { name: "宠物小屋" });
      const btn = (name: string) => house.getByRole("button", { name, exact: true });
      const launch = page.getByRole("button", { name: "打开宠物小屋" });
      const openHouse = () => launch.click();
      const close = () => btn("关闭宠物小屋").click();
      const coins = house.locator(".pet-wallet b").first();
      const row = (name: string) => house.locator(".pet-item").filter({ hasText: name });
      let running = initial;
      await page.route(MOCK_SERVER + "/tasks/*/start*", async route => {
        const ids = route.request().postDataJSON();
        const now = await page.evaluate(() => new Date().toISOString());
        running = startTimerInState(initial, "focus", initial.tasks[0].id, now, ids.focus_session_id, { workSessionId: ids.work_session_id });
        runtime.workspaceStates[runtime.activeWorkspaceId] = running;
        await route.fulfill({ json: { delta: true, rows: rowsFromState(running), deleted: [], settings: {}, server_time: now } });
      });
      await page.route(MOCK_SERVER + "/work-sessions/*/pause*", async route => {
        const now = await page.evaluate(() => new Date().toISOString());
        running = toggleTimerInState(running, now);
        runtime.workspaceStates[runtime.activeWorkspaceId] = running;
        await route.fulfill({ json: { delta: true, rows: rowsFromState(running), deleted: [], settings: {}, server_time: now } });
      });
      await work();
      await page.getByRole("button", { name: "申领宠物" }).click();
      await expect(house.getByRole("radio")).toHaveCount(3);
      await house.getByRole("radio", { name: "小橘猫" }).check();
      await house.getByLabel("宠物昵称").fill("柚子");
      await btn("领养伙伴").click();
      await expect(house.getByRole("heading", { name: "柚子" })).toBeVisible();
      await close();
      await page.locator(".timer-controls").getByRole("button", { name: "开始工作" }).click();
      await expect(page.locator(".pet-launch .mood-focus")).toBeVisible();
      await page.clock.fastForward(60_100);
      await openHouse();
      await expect(coins).toHaveText("1");
      await expect(house.locator(".pet-wallet b").last()).toHaveText("1");
      await page.clock.fastForward(500 * 60_000);
      await expect(coins).toHaveText("501");
      await close();
      await page.locator(".timer-controls").getByRole("button", { name: "暂停" }).click();
      await expect(page.locator(".timer-controls").getByRole("button", { name: "继续" })).toBeVisible();
      await page.clock.fastForward(65_000);
      await openHouse();
      await expect(coins).toHaveText("501");
      await close();
      await page.getByRole("button", { name: "短休息", exact: true }).click();
      await page.clock.fastForward(65_000);
      await openHouse();
      await expect(coins).toHaveText("501");
      await btn("食物商店").click();
      await row("浆果饼干").getByText("买下喂食").click();
      await expect(coins).toHaveText("477");
      await expect(house.getByText("吃得好开心")).toBeVisible();
      for (let i = 0; i < 2; i++) await row("浆果饼干").getByText("存入背包").click();
      await expect(coins).toHaveText("429");
      await btn("衣服商店").click();
      for (const [name, balance] of [["新芽发夹", "309"], ["湖绿马甲", "129"]] as const) {
        await row(name).getByText("购买", { exact: true }).click();
        await expect(coins).toHaveText(balance);
        await expect(row(name).getByText("已购买")).toBeDisabled();
      }
      await expect(row("晨光皇冠").getByText("还差 831 金币")).toBeVisible();
      await row("珊瑚领结").getByText("购买", { exact: true }).click();
      await expect(coins).toHaveText("9");
      await btn("衣橱换装").click();
      for (const name of ["新芽发夹", "湖绿马甲", "珊瑚领结"]) await row(name).getByText("穿戴").click();
      await expect(launch.locator("[data-outfit]")).toHaveCount(3);
      await close();
      if (!mobile) {
        const box = (await launch.boundingBox())!;
        await page.mouse.move(box.x + 18, box.y + 32);
        await page.mouse.down();
        // An open spot below the task list stays free across both timer layouts.
        await page.mouse.move(128, 740, { steps: 8 });
        await page.mouse.up();
        await expect.poll(async () => (await launch.boundingBox())!.x).toBeCloseTo(110, 0);
      }
      await page.getByRole("button", { name: "收起宠物挂件" }).click();
      await expect(page.locator(".pet-widget")).toHaveClass(/compact/);
      await page.getByRole("button", { name: "展开宠物挂件" }).click();
      await expect(page.locator(".pet-widget")).not.toHaveClass(/compact/);
      const position = await launch.boundingBox();
      await page.reload();
      await work();
      await expect(launch.locator("[data-outfit]")).toHaveCount(3);
      await expect.poll(async () => (await launch.boundingBox())!.x).toBeCloseTo(position!.x, 0);
      const overlapsControl = await launch.evaluate(widget => {
        const pet = widget.getBoundingClientRect();
        return [...document.querySelectorAll(".timer-controls button, .focus-todo-panel button, .focus-orbit")].some(el => {
          const area = el.getBoundingClientRect();
          return area.width && area.left < pet.right && area.right > pet.left && area.top < pet.bottom && area.bottom > pet.top;
        });
      });
      expect(overlapsControl).toBe(false);
      await openHouse();
      await expect(coins).toHaveText("9");
      await expect(house.getByText("柚子", { exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
      const bounds = (await house.boundingBox())!;
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(mobile ? 844 : 900);
      await page.screenshot({ path: info.outputPath(device + "-outfits.png") });
      await page.clock.fastForward(DAY);
      await expect(house.locator(".pet-crisis")).toContainText("距饿死");
      await btn("喂食背包").click();
      await row("浆果饼干").getByText("喂食", { exact: true }).click();
      await expect(house.locator(".pet-crisis")).toHaveCount(0);
      await page.clock.fastForward(3 * DAY);
      await expect(house.getByText(/柚子 已饿死/)).toBeVisible();
      await house.getByRole("radio", { name: "小柴犬" }).check();
      await house.getByLabel("宠物昵称").fill("小满");
      await btn("重新申领新宠物").click();
      await expect(coins).toHaveText("0");
      await expect(house.locator("progress")).toHaveAttribute("value", /^99\.9|100/);
      await btn("喂食背包").click();
      await expect(house.getByText(/背包里还没有食物/)).toBeVisible();
      await btn("衣橱换装").click();
      await expect(house.getByRole("button", { name: "穿戴" })).toHaveCount(3);
      await row("新芽发夹").getByText("穿戴").click();
      await expect(launch.locator('[data-outfit="leaf"]')).toHaveCount(1);
      await page.screenshot({ path: info.outputPath(device + "-readopted.png") });
      await close();
      await nav.getByRole("button", { name: "我的任务", exact: true }).click();
      await expect(page.locator(".pet-widget")).toHaveCount(0);
    });
  });
}

test("restores a shared account on a fresh device and isolates the next account in the same browser", async ({ page, browser, context }) => {
  const account = authenticatedState();
  const runtime = await openApp(page, account);
  const focus = (p: typeof page) => p.getByRole("navigation", { name: "页面导航", exact: true })
    .getByRole("button", { name: "开始工作" }).click();
  await focus(page);
  await page.getByRole("button", { name: "申领宠物" }).click();
  await page.getByLabel("宠物昵称").fill("小渔");
  await page.getByRole("button", { name: "领养伙伴" }).click();
  await expect(page.locator(".pet-launch")).toContainText("小渔");
  const device = await browser.newContext();
  try {
    const client = await device.newPage();
    await openApp(client, { ...account, settings: runtime.initialState.settings });
    await focus(client);
    await expect(client.locator(".pet-launch")).toContainText("小渔");
  } finally {
    await device.close();
  }
  const other = authenticatedState();
  other.auth.account = { ...other.auth.account!, id: "account_pet_other" };
  other.auth.token = "isolated-second-account";
  const nextPage = await context.newPage();
  await openApp(nextPage, other);
  await focus(nextPage);
  await expect(nextPage.locator(".pet-launch")).toHaveAccessibleName("申领宠物");
  await expect(nextPage.locator(".pet-launch")).not.toContainText("小渔");
});
