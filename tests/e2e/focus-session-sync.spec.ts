import { expect, test } from "@playwright/test";
import { startTimerInState } from "../../src/appModel";
import { WORKSPACE_SCOPE_PREFERENCES_KEY } from "../../src/workspaceScopePreference";
import { authenticatedState } from "./support/authenticatedState";
import { openApp } from "./support/openApp";

for (const mobile of [false, true]) {
  const surface = mobile ? "mobile" : "desktop";
  test.describe(surface, () => {
    test.use({ viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 820 }, isMobile: mobile, hasTouch: mobile });

    test("keeps the account timer when its task is outside the selected workspace", async ({ page }, testInfo) => {
      const initial = authenticatedState();
      const task = initial.tasks[0];
      const state = startTimerInState(initial, "focus", task.id, new Date(Date.now() - 65_000).toISOString(),
        "focus_other_workspace", { workSessionId: "work_other_workspace" });
      await page.addInitScript(({ key, scope }) => {
        localStorage.setItem(key, JSON.stringify(scope));
      }, { key: WORKSPACE_SCOPE_PREFERENCES_KEY, scope: { [state.auth.account!.id]: state.auth.workspaces![0].id } });
      await openApp(page, state);
      const nav = page.getByRole("navigation", { name: mobile ? "手机页面导航" : "页面导航", exact: true });
      await nav.getByRole("button", { name: mobile ? "专注" : "开始工作" }).click();

      const panel = page.locator(".focus-timer-panel");
      const face = panel.locator(".timer-face");
      const countdown = face.locator(".timer-countdown");
      await expect(page.locator(".focus-todo-list")).not.toContainText(task.title);
      await expect(face).toContainText("专注番茄");
      await expect(countdown).toHaveText(/23:\d{2}/);
      await expect(panel.getByRole("button", { name: "暂停" })).toBeVisible();

      await panel.getByRole("button", { name: "短休息", exact: true }).click();
      await expect(face).toContainText("短休息");
      await expect(countdown).toHaveText(/04:5\d/);
      await panel.getByRole("button", { name: "暂停" }).click();
      await expect(panel.getByRole("button", { name: "继续" })).toBeVisible();
      const paused = await countdown.innerText();
      await page.waitForTimeout(1100);
      await expect(countdown).toHaveText(paused);
      await panel.getByRole("button", { name: "继续" }).click();
      await expect(countdown).not.toHaveText(paused);
      await countdown.scrollIntoViewIfNeeded();
      await page.screenshot({ path: testInfo.outputPath(surface + ".png") });
    });
  });
}
