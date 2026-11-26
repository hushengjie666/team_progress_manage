import { expect, test, type Page } from "@playwright/test";
import { startTimerInState, toggleTimerInState } from "../../src/appModel";
import { builtInQuotes } from "../../src/dailyQuotes/builtInQuotes";
import { defaultQuoteSettings, type DailyQuoteSettings } from "../../src/dailyQuotes/library";
import { authenticatedState } from "./support/authenticatedState";
import { MOCK_SERVER } from "./support/constants";
import { rowsFromState } from "./support/mockTeamBackendState";
import { openApp } from "./support/openApp";
import { projectInviteeScenario } from "./support/scenarioStates";

const quoteBar = (page: Page) => page.getByRole("region", { name: "每日一句" });
const quoteText = (page: Page) => quoteBar(page).locator(".focus-quote-body");
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
const openQuotes = async (page: Page) => {
  await openAdmin(page);
  await page.locator(".settings-section-tabs").getByRole("button", { name: "名言警句", exact: true }).click();
};
const entries = (page: Page) => quotePanel(page).getByRole("list", { name: "名言列表" }).getByRole("listitem");

test("shows only the daily quote in one line above uninterrupted focus controls", async ({ page, isMobile }, testInfo) => {
  if (!isMobile) await page.setViewportSize({ width: 1280, height: 820 });
  const state = authenticatedState();
  state.settings.longBreakEvery = 1;
  state.focusSessions = [{
    id: "completed_quote_test_session",
    taskId: state.tasks[0].id,
    mode: "focus",
    duration: 1500,
    startedAt: new Date(Date.now() - 1500_000).toISOString(),
    endedAt: new Date().toISOString(),
    outcome: "completed",
    interruptionCounts: { internal: 0, external: 0 },
  }];
  await openApp(page, state);
  const task = state.tasks[0];
  let runningState = state;
  await page.route(`${MOCK_SERVER}/tasks/${task.id}/start*`, (route) => {
    const request = route.request();
    const { focus_session_id, work_session_id } = request.postDataJSON();
    const startedAt = new Date().toISOString();
    runningState = startTimerInState(state, "focus", task.id, startedAt, focus_session_id, { workSessionId: work_session_id });
    return route.fulfill({ json: {
      delta: true, mutation_id: request.headers()["x-timemanage-mutation-id"],
      rows: rowsFromState(runningState), deleted: [], server_time: startedAt,
    } });
  });
  await page.route(`${MOCK_SERVER}/work-sessions/*/pause*`, (route) => {
    const pausedAt = new Date().toISOString();
    const paused = toggleTimerInState(runningState, pausedAt);
    return route.fulfill({ json: {
      delta: true, mutation_id: route.request().headers()["x-timemanage-mutation-id"],
      rows: rowsFromState(paused), deleted: [], server_time: pausedAt,
    } });
  });
  await startWork(page);
  const bar = quoteBar(page);
  const text = quoteText(page);
  await expect(text).toBeVisible();
  const initial = await text.innerText();
  expect(builtInQuotes.some(({ text }) => text === initial)).toBe(true);
  await expect(bar.locator(":scope > *")).toHaveText(["每日一句", initial]);
  await expect(bar.locator("button, a, [tabindex]")).toHaveCount(0);
  await expect(text).toHaveAttribute("title", initial);
  await expect(text).toHaveCSS("white-space", "nowrap");
  if (!isMobile) {
    await expect(text).toHaveCSS("font-size", "20px");
    await expect(text).toHaveCSS("font-weight", "700");
    const [quote, body, label, task, orbit, controls, modes, sidebar] = await Promise.all(
      [bar, text, bar.locator(".focus-quote-label"), page.locator(".focus-current-panel"), page.locator(".focus-orbit"),
        page.locator(".timer-controls"), page.locator(".mode-switcher"), page.locator(".focus-side")]
        .map((locator) => locator.boundingBox()),
    );
    expect(quote!.height).toBeGreaterThanOrEqual(72);
    expect(quote!.height).toBeLessThanOrEqual(96);
    expect(Math.abs(body!.y + body!.height / 2 - (quote!.y + quote!.height / 2))).toBeLessThanOrEqual(1);
    expect(Math.abs(label!.y + label!.height / 2 - (body!.y + body!.height / 2))).toBeLessThanOrEqual(1);
    expect(quote!.x).toBeGreaterThanOrEqual(sidebar!.x + sidebar!.width);
    expect(quote!.y + quote!.height).toBeLessThanOrEqual(Math.min(task!.y, orbit!.y) + 1);
    expect(quote!.x + quote!.width).toBeGreaterThanOrEqual(orbit!.x + orbit!.width);
    expect(orbit!.width).toBe(orbit!.height);
    expect(controls!.y + controls!.height).toBeLessThanOrEqual(820);
    expect(modes!.y + modes!.height).toBeLessThanOrEqual(820);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
  await page.screenshot({ path: testInfo.outputPath("daily-quote-focus.png"), fullPage: isMobile });
  const started = page.waitForResponse((response) => new URL(response.url()).pathname === `/tasks/${task.id}/start`);
  await page.locator(".timer-controls").getByRole("button", { name: "开始工作" }).click();
  expect((await started).ok()).toBe(true);
  await expect(page.locator(".timer-face")).toContainText("专注番茄");
  await expect(text).toHaveText(initial);
  const paused = page.waitForResponse((response) => new URL(response.url()).pathname.endsWith("/pause"));
  await page.locator(".timer-controls").getByRole("button", { name: "暂停" }).click();
  expect((await paused).ok()).toBe(true);
  await expect(page.locator(".timer-controls").getByRole("button", { name: "继续" })).toBeVisible();
  await expect(text).toHaveText(initial);
  await page.locator(".mode-switcher").getByRole("button", { name: "短休息" }).click();
  await expect(page.locator(".timer-face")).toContainText("短休息");
  await expect(text).toHaveText(initial);
  await page.locator(".mode-switcher").getByRole("button", { name: "阶段休息" }).click();
  await expect(page.locator(".timer-face")).toContainText("长休息");
  await expect(text).toHaveText(initial);
});

test("truncates an 80-character quote without a current task and keeps the full text in the title", async ({ page, isMobile }, testInfo) => {
  if (!isMobile) await page.setViewportSize({ width: 1280, height: 820 });
  const state = authenticatedState();
  state.tasks = [];
  state.dailyPlans = [];
  const longText = "专注做好眼前的事".repeat(10);
  const dailyQuotes: DailyQuoteSettings = {
    ...defaultQuoteSettings("UTC"),
    disabled: builtInQuotes.map(({ id }) => id),
    custom: [{ id: "custom-long-sample", text: longText, author: "验收作者", source: "验收出处", url: "" }],
  };
  await openApp(page, state);
  await page.route(`${MOCK_SERVER}/settings`, (route) => route.fulfill({ json: { settings: { dailyQuotes } } }));
  await page.reload();
  await startWork(page);

  const bar = quoteBar(page);
  const text = quoteText(page);
  await expect(page.locator(".focus-current-panel")).toContainText("工作队列为空");
  await expect(bar.locator(":scope > *")).toHaveText(["每日一句", longText]);
  await expect(bar.locator("button, a, [tabindex]")).toHaveCount(0);
  await expect(text).toHaveAttribute("title", longText);
  await expect(text).toHaveCSS("text-overflow", "ellipsis");
  await expect(text).toHaveCSS("overflow", "hidden");
  expect(await text.evaluate((node) => node.scrollWidth > node.clientWidth)).toBe(true);
  expect((await bar.boundingBox())!.height).toBe(78);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
  await page.screenshot({ path: testInfo.outputPath("daily-quote-long.png"), fullPage: isMobile });
});

test("a regular member can find, edit, disable, restore and delete personal quotes", async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  await openApp(page, projectInviteeScenario().initialState);
  await startWork(page);
  await expect(quoteText(page)).toBeVisible();
  const dailyText = await quoteText(page).innerText();
  await openQuotes(page);
  const panel = quotePanel(page);
  await expect(panel.getByText("100 / 100")).toBeVisible();
  await expect(page.getByRole("button", { name: "成员管理", exact: true })).toHaveCount(0);
  await expect(entries(page)).toHaveCount(100);
  const preview = panel.locator(".quote-preview").getByRole("button", { name: dailyText, exact: true });
  await preview.press("Enter");
  const details = page.getByRole("dialog", { name: "名言全文与出处" });
  const source = builtInQuotes.find(({ text }) => text === dailyText)!;
  await expect(details.locator("blockquote")).toHaveText(dailyText);
  await expect(details).toContainText(`${source.author} · ${source.source}`);
  await expect(details.getByRole("link", { name: "打开参考来源" })).toHaveAttribute("href", source.url);
  await page.keyboard.press("Escape");
  await expect(details).toHaveCount(0);
  await expect(preview).toBeFocused();
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
    await openQuotes(secondPage);
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
  await expect(quoteBar(page).locator(":scope > *")).toHaveText(["每日一句", "暂无启用名言"]);
  await expect(quoteBar(page).locator("button, a, [tabindex], [title]")).toHaveCount(0);
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
  await expect(nav(nextAccountPage).getByRole("button", { name: "项目总览", exact: true })
    .or(mobileNav(nextAccountPage).getByRole("button", { name: "总览", exact: true }))).toHaveClass(/active/);
  await openQuotes(nextAccountPage);
  await expect(quotePanel(nextAccountPage).getByText("100 / 100")).toBeVisible();
  await expect(quotePanel(nextAccountPage).getByText("多端共用一份个人名言")).toHaveCount(0);
});
