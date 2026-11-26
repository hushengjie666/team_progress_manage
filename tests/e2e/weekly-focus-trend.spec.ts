import { expect, test } from "@playwright/test";
import { MOCK_SERVER } from "./support/constants";
import { openApp } from "./support/openApp";
import { weeklyFocusSample } from "./support/weeklyFocusSample";
import { mockTeamBackend } from "./support/mockTeamBackend";
import { accountResponse, membershipResponse, workspaceResponse } from "./support/mockTeamBackendSerializers";

for (const mobile of [false, true]) {
  const view = mobile ? "mobile" : "desktop";
  test.describe(view, () => {
    test.use({
      viewport: mobile ? { width: 390, height: 844 } : { width: 1365, height: 900 },
      isMobile: mobile, hasTouch: mobile, timezoneId: "Asia/Shanghai",
    });

    test("checks daily focus, workspace and account changes, and midnight rollover", async ({ page }, info) => {
      await page.clock.install({ time: new Date("2026-04-02T23:59:00+08:00") });
      const state = weeklyFocusSample("2026-04-02");
      await openApp(page, state);
      await page.getByRole("button", { name: "我的任务", exact: true }).click();
      const chart = page.getByRole("region", { name: "最近 7 天投入时长" });
      const rows = chart.getByRole("listitem");
      await expect(chart.locator("header")).toContainText("合计 2:40:00");
      await expect(rows.locator("b")).toHaveText(["0:00:00", "1:15:00", "0:00:00", "0:20:00", "0:40:00", "0:25:00", "0:00:00"]);
      await expect(rows.locator("time")).toHaveText(["03/27", "03/28", "03/29", "03/30", "03/31", "04/01", "04/02"]);
      await expect(chart.locator("polyline")).toBeVisible();
      await rows.first().focus();
      await page.keyboard.press("Tab");
      await expect(rows.nth(1)).toBeFocused();
      await expect(rows.nth(1)).toHaveAccessibleName("2026-03-28，1小时15分0秒");
      expect(await chart.evaluate((el) => el.getBoundingClientRect().right <= document.documentElement.clientWidth)).toBe(true);
      expect(await rows.evaluateAll((items) => items.every((el) => el.scrollWidth <= el.clientWidth))).toBe(true);
      await page.screenshot({ path: info.outputPath(view + ".png") });

      const filter = page.getByRole("group", { name: "工作区筛选" });
      await filter.getByRole("button", { name: "私人", exact: true }).click();
      await expect(chart.locator("header")).toContainText("合计 0:25:00");
      await filter.getByRole("button", { name: "E2E 工作区", exact: true }).click();
      await expect(chart.locator("header")).toContainText("合计 2:15:00");
      await page.clock.fastForward(65_000);
      await expect(rows.last().locator("time")).toHaveAttribute("datetime", "2026-04-03");

      if (mobile) await page.getByRole("button", { name: "更多", exact: true }).click();
      await page.getByRole("button", { name: "退出登录：项目负责人" }).click();
      await expect(page.getByRole("heading", { name: "登录账号" })).toBeVisible();
      const membership = state.auth.workspaceMemberships!.find((member) => member.accountId === "account_wangshuo")!;
      const account = { ...state.auth.account!, id: membership.accountId, name: membership.name, email: membership.email };
      const workspace = state.auth.workspace!;
      const next = { ...state, auth: { ...state.auth, account, workspace, membership, workspaces: [workspace], workspaceMemberships: [membership] } };
      await mockTeamBackend(page, next);
      await page.route(MOCK_SERVER + "/auth/login", (route) => route.fulfill({ json: {
        token: "sample-session", expires_at: next.auth.expiresAt, user_id: account.id, account: accountResponse(account, workspace.id),
        workspace: workspaceResponse(workspace), membership: membershipResponse(membership), workspaces: [workspaceResponse(workspace)],
      } }));
      await page.getByLabel("登录邮箱或手机号").fill(account.email);
      await page.getByLabel("密码", { exact: true }).fill("sample-only");
      await page.getByRole("button", { name: "登录", exact: true }).click();
      await page.getByRole("button", { name: "我的任务", exact: true }).click();
      await expect(chart.locator("header")).toContainText("合计 0:07:00");
    });
  });
}
