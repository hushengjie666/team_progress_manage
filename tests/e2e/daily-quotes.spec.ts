import { expect, test, type Page } from "@playwright/test";
import { builtInQuotes } from "../../src/dailyQuotes/builtInQuotes";
import { defaultQuoteSettings, type DailyQuoteSettings } from "../../src/dailyQuotes/library";
import { authenticatedState } from "./support/authenticatedState";
import { MOCK_SERVER } from "./support/constants";
import { openApp } from "./support/openApp";
import { projectInviteeScenario } from "./support/scenarioStates";

const quoteBar = (page: Page) => page.getByRole("region", { name: "每日一句" });
const quoteText = (page: Page) => quoteBar(page).locator("strong");
const quotePanel = (page: Page) => page.getByRole("region", { name: "个人名言" });
const nav = (page: Page) => page.getByRole("navigation", { name: "页面导航" });
const mobileNav = (page: Page) => page.getByRole("navigation", { name: "手机页面导航" });
const startWork = (page: Page) => nav(page).getByRole("button", { name: "开始工作" })
  .or(mobileNav(page).getByRole("button", { name: "专注" })).click();
const openAdmin = async (page: Page) => {
  const desktopAdmin = nav(page).getByRole("button", { name: "管理中心" });
  const mobileMore = mobileNav(page).getByRole("button", { name: "更多" });
  const entry = desktopAdmin.or(mobileMore);
  await expect(entry).toBeVisible();
  await entry.click();
  if (await mobileMore.isVisible()) await page.getByRole("dialog", { name: "更多功能" }).getByRole("button", { name: "管理中心" }).click();
};
const openQuotes = (page: Page) => quoteBar(page).getByRole("button", { name: "管理名言" }).click();
const entries = (page: Page) => quotePanel(page).getByRole("list", { name: "名言列表" }).getByRole("listitem");

test("lays out the daily quote above focus controls and opens its full source by keyboard", async ({ page, isMobile }, testInfo) => {
  if (!isMobile) await page.setViewportSize({ width: 1280, height: 820 });
  const state = authenticatedState();
  await openApp(page, state);
  await startWork(page);
  const bar = quoteBar(page);
  await expect(quoteText(page)).toHaveCount(1);
  await expect(bar.locator(".focus-quote-body span")).toHaveText(/.+ · .+/);
  if (!isMobile) {
    const [quote, task, orbit, controls, sidebar] = await Promise.all(
      [bar, page.locator(".focus-current-panel"), page.locator(".focus-orbit"), page.locator(".timer-controls"), page.locator(".focus-side")]
        .map((locator) => locator.boundingBox()),
    );
    expect(quote!.height).toBeGreaterThanOrEqual(72);
    expect(quote!.height).toBeLessThanOrEqual(96);
    expect(quote!.x).toBeGreaterThanOrEqual(sidebar!.x + sidebar!.width);
    expect(quote!.y + quote!.height).toBeLessThanOrEqual(Math.min(task!.y, orbit!.y) + 1);
    expect(quote!.x + quote!.width).toBeGreaterThanOrEqual(orbit!.x + orbit!.width);
    expect(orbit!.width).toBe(orbit!.height);
    expect(controls!.y + controls!.height).toBeLessThanOrEqual(820);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
  const fullQuote = bar.getByRole("button", { name: "查看每日名言全文" });
  await fullQuote.press("Enter");
  const dialog = page.getByRole("dialog", { name: "名言全文与出处" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("link", { name: "打开参考来源" })).toHaveAttribute("href", /^https:\/\//);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(fullQuote).toBeFocused();
  await page.screenshot({ path: testInfo.outputPath("daily-quote-focus.png"), fullPage: isMobile });
  const initial = await quoteText(page).innerText();
  await page.locator(".mode-switcher").getByRole("button", { name: "短休息" }).click();
  await expect(page.locator(".timer-face")).toContainText("短休息");
  await page.locator(".timer-controls").getByRole("button", { name: "暂停" }).click();
  await expect(page.locator(".timer-controls").getByRole("button", { name: "继续" })).toBeVisible();
  await expect(quoteText(page)).toHaveText(initial);
});

test("a regular member can find, edit, disable, restore and delete personal quotes", async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  await openApp(page, projectInviteeScenario().initialState);
  await startWork(page);
  await expect(quoteText(page)).toHaveCount(1);
  await openQuotes(page);
  const panel = quotePanel(page);
  await expect(panel.getByText("100 / 100")).toBeVisible();
  await expect(page.getByRole("button", { name: "成员管理", exact: true })).toHaveCount(0);
  await expect(entries(page)).toHaveCount(100);
  const search = panel.getByRole("searchbox");
  await search.fill("论语·学而");
  await expect(entries(page).first()).toContainText(builtInQuotes[0].text);
  await search.fill(builtInQuotes[0].text);
  await entries(page).getByRole("button", { name: "编辑", exact: true }).click();
  await panel.getByLabel("正文（1–80 字符）").fill("内置名言的个人改写");
  await panel.getByRole("button", { name: "保存名言" }).click();
  await expect(entries(page)).toHaveCount(0);
  await search.fill("个人改写");
  await expect(entries(page)).toContainText("个人修改，出处未重新核实");
  await entries(page).getByRole("button", { name: "停用", exact: true }).click();
  await panel.getByRole("combobox", { name: "状态", exact: true }).selectOption("off");
  await expect(entries(page)).toContainText("已停用");
  await entries(page).getByRole("button", { name: "恢复原始内容" }).click();
  const restore = page.getByRole("dialog", { name: "恢复内置名言" });
  await restore.getByRole("button", { name: "确认恢复" }).click();
  await search.fill(builtInQuotes[0].text);
  await expect(entries(page)).toContainText("原始内置 · 出处已核实 · 已停用");
  await entries(page).getByRole("button", { name: "启用", exact: true }).click();
  await expect(entries(page)).toHaveCount(0);

  await search.fill("");
  await panel.getByRole("combobox", { name: "状态", exact: true }).selectOption("all");
  await panel.getByRole("combobox", { name: "类型", exact: true }).selectOption("custom");
  await panel.getByRole("button", { name: "新增名言" }).click();
  await panel.getByLabel("作者或归属（1–40 字符）").fill("测试用户");
  const quoteInput = panel.getByLabel("正文（1–80 字符）");
  await quoteInput.fill(builtInQuotes[0].text);
  await panel.getByRole("button", { name: "保存名言" }).click();
  await expect(panel.getByRole("alert")).toContainText("已有相同正文");
  const specialText = "<b>先做一件事</b>";
  await quoteInput.fill(specialText);
  await panel.getByLabel("参考链接（选填）").fill("javascript:alert(1)");
  await panel.getByRole("button", { name: "保存名言" }).click();
  await expect(panel.getByRole("alert")).toContainText("http 或 https");
  await panel.getByLabel("参考链接（选填）").fill("");
  await panel.getByRole("button", { name: "保存名言" }).click();
  await expect(entries(page)).toContainText("用户自定义，出处未核实");
  await expect(entries(page).getByRole("button", { name: specialText })).toBeVisible();
  await expect(entries(page).locator("b")).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("daily-quote-management.png"), fullPage: true });
  await entries(page).getByRole("button", { name: "编辑", exact: true }).click();
  await quoteInput.fill("自定义更新后的正文");
  await panel.getByRole("button", { name: "保存名言" }).click();
  await expect(entries(page)).toContainText("自定义更新后的正文");
  await entries(page).getByRole("button", { name: "删除", exact: true }).click();
  const deletion = page.getByRole("dialog", { name: "删除自定义名言" });
  await deletion.getByRole("button", { name: "取消", exact: true }).click();
  await expect(entries(page)).toHaveCount(1);
  await entries(page).getByRole("button", { name: "删除", exact: true }).click();
  await deletion.getByRole("button", { name: "确认删除" }).click();
  await expect(entries(page)).toHaveCount(0);
  await expect(panel.getByText("100 / 100")).toBeVisible();
});

test("persists only confirmed settings and rotates through offline, refresh and account changes", async ({ page, browser, context }) => {
  test.setTimeout(65_000);
  const anchor = new Date("2026-01-01T07:59:40Z");
  const account = authenticatedState();
  const ownerToken = account.auth.token;
  let stored: DailyQuoteSettings = { ...defaultQuoteSettings("UTC"), time: "08:00" };
  let failWrites = false;
  const touchedSettings: string[][] = [];
  const settingsUrl = `${MOCK_SERVER}/settings`;
  const mockSettings = (target: Page) => target.route(settingsUrl, async (route) => {
    const request = route.request();
    if (request.headers().authorization !== `Bearer ${ownerToken}`) {
      await route.fulfill({ json: { settings: { dailyQuotes: defaultQuoteSettings("Asia/Shanghai") } } });
    } else if (request.method() === "GET") {
      await route.fulfill({ json: { settings: { dailyQuotes: stored }, focusMinutes: 25 } });
    } else if (failWrites) {
      await route.fulfill({ status: 500, json: { error: "测试写入失败" } });
    } else {
      const patch = request.postDataJSON();
      touchedSettings.push(Object.keys(patch));
      stored = patch.dailyQuotes;
      await route.fulfill({ json: { delta: true, rows: [], deleted: [], settings: patch } });
    }
  });
  await page.clock.install({ time: anchor });
  await openApp(page, account);
  await mockSettings(page);
  await page.reload();
  await startWork(page);
  await openQuotes(page);
  const panel = quotePanel(page);
  await expect(panel.getByText("当前每天 08:00 · UTC")).toBeVisible();
  await panel.getByLabel("固定 IANA 时区").fill("Asia/Shanghai");
  failWrites = true;
  await panel.getByRole("button", { name: "保存轮换设置" }).click();
  await expect(panel.getByRole("alert")).toContainText("轮换设置未保存");
  await expect(panel.getByLabel("固定 IANA 时区")).toHaveValue("Asia/Shanghai");
  await expect(panel.getByText("当前每天 08:00 · UTC")).toBeVisible();

  await panel.getByRole("button", { name: "新增名言" }).click();
  await panel.getByLabel("正文（1–80 字符）").fill("多端共用一份个人名言");
  await panel.getByLabel("作者或归属（1–40 字符）").fill("测试用户");
  await panel.getByRole("button", { name: "保存名言" }).click();
  await expect(panel.getByText("名言未保存，草稿已保留。", { exact: false })).toBeVisible();
  await expect(panel.getByLabel("正文（1–80 字符）")).toHaveValue("多端共用一份个人名言");
  await expect(panel.getByText("100 / 100")).toBeVisible();
  failWrites = false;
  await panel.getByRole("button", { name: "保存名言" }).click();
  await expect(panel.getByText("101 / 101")).toBeVisible();
  await panel.getByRole("button", { name: "保存轮换设置" }).click();
  await expect(panel.getByText("当前每天 08:00 · Asia/Shanghai")).toBeVisible();
  expect(touchedSettings).toEqual([["dailyQuotes"], ["dailyQuotes"]]);

  const secondClient = await browser.newContext({ timezoneId: "America/New_York" });
  try {
    const secondPage = await secondClient.newPage();
    await openApp(secondPage, account);
    await mockSettings(secondPage);
    await secondPage.reload();
    await openAdmin(secondPage);
    await secondPage.getByRole("button", { name: "名言警句", exact: true }).click();
    const other = quotePanel(secondPage);
    await expect(other.getByText("101 / 101")).toBeVisible();
    await expect(other.getByText("当前每天 08:00 · Asia/Shanghai")).toBeVisible();
  } finally {
    await secondClient.close();
  }

  await panel.getByLabel("固定 IANA 时区").fill("UTC");
  await panel.getByRole("button", { name: "保存轮换设置" }).click();
  await expect(panel.getByText("当前每天 08:00 · UTC")).toBeVisible();
  await page.clock.setSystemTime(anchor);
  await startWork(page);
  await expect(quoteText(page)).toHaveText("多端共用一份个人名言");
  await context.setOffline(true);
  await page.clock.fastForward(40_000);
  await expect(quoteText(page)).toHaveText(builtInQuotes[0].text);
  await page.clock.setSystemTime(new Date("2026-01-06T08:00:00Z"));
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(quoteText(page)).toHaveText(builtInQuotes[5].text);
  await context.setOffline(false);
  await page.reload();
  await startWork(page);
  await expect(quoteText(page)).toHaveText(builtInQuotes[5].text);

  stored = { ...stored, disabled: [...builtInQuotes.map(({ id }) => id), stored.custom[0].id] };
  await openQuotes(page);
  await panel.getByRole("button", { name: "刷新名言配置" }).click();
  await expect(panel.getByText("0 / 101")).toBeVisible();
  await startWork(page);
  await expect(quoteBar(page)).toContainText("暂无启用名言");
  await openQuotes(page);
  await panel.getByRole("searchbox").fill(builtInQuotes[0].text);
  await entries(page).getByRole("button", { name: "启用", exact: true }).click();
  await expect(panel.getByText("1 / 101")).toBeVisible();
  await startWork(page);
  await page.clock.fastForward(2 * 86_400_000);
  await expect(quoteText(page)).toHaveText(builtInQuotes[0].text);

  const otherAccount = projectInviteeScenario().initialState;
  otherAccount.auth.token = "quote-test-other-account";
  const nextAccountPage = await context.newPage();
  await openApp(nextAccountPage, otherAccount);
  await mockSettings(nextAccountPage);
  await nextAccountPage.reload();
  await startWork(nextAccountPage);
  await openQuotes(nextAccountPage);
  await expect(quotePanel(nextAccountPage).getByText("100 / 100")).toBeVisible();
  await expect(quotePanel(nextAccountPage).getByText("多端共用一份个人名言")).toHaveCount(0);
});
