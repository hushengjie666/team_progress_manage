import { expect, test } from "@playwright/test";
import { startTimerInState, toggleTimerInState } from "../../src/appModel";
import { DAY, emptyPet } from "../../src/focusPet/model";
import { PET_SETTING } from "../../src/accountSettingKeys";
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
      const launch = page.getByRole("button", { name: "宠物快捷互动" });
      const ring = page.getByRole("group", { name: "宠物快捷动作" });
      const openHouse = async () => {
        await launch.click();
        await ring.getByRole("button", { name: "宠物小屋" }).click();
      };
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
      await btn("修改昵称").click();
      await house.getByRole("textbox", { name: "新昵称" }).fill("柚子酱");
      await btn("保存昵称").click();
      await expect(house.getByRole("heading", { name: "柚子酱" })).toBeVisible();
      await btn("摸摸柚子酱").click();
      await expect(house.locator(".pet-stage .effect-pat")).toContainText("最喜欢你");
      await close();
      await launch.click();
      await expect(house).toHaveCount(0);
      await expect(ring.getByRole("progressbar")).toBeVisible();
      await ring.getByRole("button", { name: "摸摸" }).click();
      await expect(page.locator(".pet-widget .effect-pat")).toContainText("呼噜");
      await page.screenshot({ path: info.outputPath(device + "-ring.png") });
      await ring.getByRole("button", { name: "快捷喂食" }).click();
      await expect(btn("道具商店")).toHaveAttribute("aria-pressed", "true");
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
      await btn("道具商店").click();
      await expect(house.locator(".pet-item .pet-food-art")).toHaveCount(4);
      await row("浆果饼干").getByText("买下喂食").click();
      await expect(coins).toHaveText("477");
      await expect(house.locator(".effect-feed")).toContainText("+10 饱食度");
      await expect(house.getByText("吃得好开心")).toBeVisible();
      for (let i = 0; i < 2; i++) await row("浆果饼干").getByText("存入背包").click();
      await expect(coins).toHaveText("429");
      await btn("服饰").click();
      await row("晨光皇冠").getByRole("button", { name: "试穿" }).click();
      const stage = house.locator(".pet-stage");
      await expect(stage.locator('[data-outfit="crown"]')).toBeVisible();
      await expect(launch.locator("[data-outfit]")).toHaveCount(0);
      await btn("衣橱换装").click();
      await expect(stage.locator("[data-outfit]")).toHaveCount(0);
      await btn("道具商店").click();
      await btn("服饰").click();
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
      await expect(stage.locator(".effect-dress")).toContainText("闪亮登场");
      await close();
      await launch.click();
      await ring.getByRole("button", { name: "快捷喂食" }).click();
      await expect(page.locator(".pet-widget .effect-feed")).toContainText("+10 饱食度");
      await expect(page.locator(".pet-widget .pet-flying-food")).toBeAttached();
      await page.keyboard.press("Escape");
      await expect(launch).toBeFocused();
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
      await expect(house.getByText("柚子酱", { exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
      const bounds = (await house.boundingBox())!;
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(mobile ? 844 : 900);
      await btn("衣橱换装").click();
      await page.screenshot({ path: info.outputPath(device + "-outfits.png") });
      await page.clock.fastForward(DAY);
      await expect(house.locator(".pet-crisis")).toContainText("距饿死");
      await btn("背包喂食").click();
      await row("浆果饼干").getByText("喂食", { exact: true }).click();
      await expect(house.locator(".pet-crisis")).toHaveCount(0);
      await page.clock.fastForward(3 * DAY);
      await expect(house.locator(".pet-memorial")).toContainText("柚子酱 的纪念星");
      await close();
      await page.getByRole("button", { name: "打开宠物纪念" }).click();
      await expect(ring).toHaveCount(0);
      await expect(house.locator(".pet-memorial")).toContainText("衣橱将完整传承");
      await page.screenshot({ path: info.outputPath(device + "-memorial.png") });
      await house.getByRole("radio", { name: "小柴犬" }).check();
      await house.getByLabel("宠物昵称").fill("小满");
      await btn("重新申领新宠物").click();
      await expect(coins).toHaveText("0");
      await expect(house.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
      await btn("背包喂食").click();
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

    test("keeps the action ring and house clear of controls at the four saved corners", async ({ page }) => {
      const initial = authenticatedState();
      const now = Date.now();
      const saved = { ...emptyPet(), coins: 243, wardrobe: ["leaf"], wearing: { head: "leaf" },
        pet: { name: "团团", species: "shiba", born: now - DAY, hungryAt: now + DAY / 2 }, bag: { berry: 3 },
        position: { x: 0, y: 0 } };
      await page.emulateMedia({ reducedMotion: "reduce" });
      for (const x of [0, 5000]) for (const y of [0, 5000]) {
        const state = { ...initial, settings: { ...initial.settings, [PET_SETTING]: { ...saved, position: { x, y } } } };
        await openApp(page, state);
        await page.getByRole("navigation", { name: mobile ? "手机页面导航" : "页面导航", exact: true })
          .getByRole("button", { name: mobile ? "专注" : "开始工作", exact: true }).click();
        const launch = page.getByRole("button", { name: "宠物快捷互动" });
        await launch.click();
        const surface = page.locator(".pet-ring button, .pet-mini-hud, .pet-house");
        const geometry = () => surface.evaluateAll(nodes => {
          const controls = [...document.querySelectorAll(".topbar, .timer-controls button, .focus-layout button")].map(el => el.getBoundingClientRect());
          return nodes.every(el => {
            const r = el.getBoundingClientRect();
            return r.left >= 0 && r.right <= document.documentElement.clientWidth + 1 && r.top >= 0 && r.bottom <= innerHeight + 1 &&
              !controls.some(c => c.width && c.height && c.right > r.left && c.left < r.right && c.bottom > r.top && c.top < r.bottom);
          }) && document.documentElement.scrollWidth - document.documentElement.clientWidth <= 1;
        });
        await expect(surface).toHaveCount(4);
        expect(await geometry()).toBe(true);
        await page.getByRole("button", { name: "摸摸", exact: true }).click();
        await expect(page.locator(".pet-sparks")).toBeHidden();
        await expect(page.locator(".pet-speech")).toContainText("呼噜");
        expect(await launch.locator(".pet-figure").evaluate(el => getComputedStyle(el).animationName)).toBe("none");
        await page.getByRole("button", { name: "宠物小屋", exact: true }).click();
        await expect(surface).toHaveCount(1);
        expect(await geometry()).toBe(true);
        await page.keyboard.press("Escape");
        await expect(launch).toBeFocused();
        await launch.click();
        await page.mouse.click(1, 1);
        await expect(page.locator(".pet-ring")).toHaveCount(0);
      }
    });
  });
}

test("restores a shared account on a fresh device and isolates the next account in the same browser", async ({ page, browser, context }) => {
  const owner = authenticatedState();
  const now = Date.now();
  const legacy = { ...emptyPet(), revision: 8, coins: 412, earned: 35, bag: { berry: 3 },
    wardrobe: ["leaf", "bow"], wearing: { head: "leaf", charm: "bow" }, position: { x: 142, y: 610 }, compact: true,
    pet: { name: "小渔", species: "penguin", born: now - DAY, hungryAt: now + DAY / 2 } };
  const account = { ...owner, settings: { ...owner.settings, [PET_SETTING]: legacy } };
  const runtime = await openApp(page, account);
  const focus = (p: typeof page) => p.getByRole("navigation", { name: "页面导航", exact: true })
    .getByRole("button", { name: "开始工作" }).click();
  await focus(page);
  await expect(page.locator(".pet-widget")).toHaveClass(/compact/);
  await page.getByRole("button", { name: "展开宠物挂件" }).click();
  await expect(page.locator(".pet-launch")).toContainText("小渔");
  const position = await page.locator(".pet-launch").boundingBox();
  const device = await browser.newContext();
  try {
    const client = await device.newPage();
    await openApp(client, { ...account, settings: runtime.initialState.settings });
    await focus(client);
    await expect(client.locator(".pet-launch")).toContainText("小渔");
    await expect(client.locator(".pet-widget")).not.toHaveClass(/compact/);
    await expect(client.locator(".pet-launch [data-outfit]")).toHaveCount(2);
    expect((await client.locator(".pet-launch").boundingBox())!.x).toBeCloseTo(position!.x, 0);
    await client.getByRole("button", { name: "宠物快捷互动" }).click();
    await client.getByRole("button", { name: "宠物小屋", exact: true }).click();
    const house = client.getByRole("dialog", { name: "宠物小屋" });
    await expect(house.locator(".pet-wallet b").first()).toHaveText("412");
    await expect(house.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "50");
    await expect(house.locator(".pet-item")).toContainText("×3");
    await house.getByRole("button", { name: "衣橱换装" }).click();
    await expect(house.getByRole("button", { name: "卸下" })).toHaveCount(2);
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
