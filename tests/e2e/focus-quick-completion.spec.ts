import { expect, test, type Page } from "@playwright/test";
import { startTimerInState } from "../../src/appModel";
import type { BusinessRow } from "../../src/teamBusinessRows";
import { authenticatedState } from "./support/authenticatedState";
import { MOCK_SERVER } from "./support/constants";
import { openApp } from "./support/openApp";
import { workspaceMemberState } from "./support/scenarioStates";

const goToFocus = (page: Page, mobile = false) => page.getByRole("navigation", {
  name: mobile ? "手机页面导航" : "页面导航", exact: true,
}).getByRole("button", { name: mobile ? "专注" : "开始工作", exact: true }).click();

const observeFeedback = (page: Page) => page.addInitScript(() => {
  document.addEventListener("animationstart", (event) => {
    if (event.animationName === "focus-completion") {
      document.body.dataset.completions = String(Number(document.body.dataset.completions ?? 0) + 1);
    }
  });
});

for (const mobile of [false, true]) {
  test.describe(mobile ? "narrow touch viewport" : "desktop viewport", () => {
    test.use({ viewport: mobile ? { width: 390, height: 844 } : { width: 1365, height: 900 }, isMobile: mobile, hasTouch: mobile });

    test("saves both review policies and closes only the submitted task's session", async ({ page }, testInfo) => {
      const initial = authenticatedState();
      const activeTask = initial.tasks[0];
      const project = { ...initial.projects[0], id: "project_manual", name: "人工验收项目", autoAcceptCompletedTasks: false };
      initial.projects.push(project);
      initial.projectMembers.push({ ...initial.projectMembers[0], projectId: project.id, id: "member_manual" });
      const other = { ...activeTask, id: "task_manual", projectId: project.id, project: project.name,
        title: "核对验收清单", primaryExecutorMemberId: "member_manual" };
      initial.tasks.push(other);
      initial.dailyPlans[0].committedTaskIds.push(other.id);
      const state = startTimerInState(initial, "focus", activeTask.id, new Date().toISOString(), "focus_current", { workSessionId: "work_current" });
      await observeFeedback(page);
      await openApp(page, state);
      await goToFocus(page, mobile);
      const list = page.locator(".focus-todo-panel");
      const current = list.getByRole("article").filter({ hasText: activeTask.title });
      const manual = list.getByRole("article").filter({ hasText: other.title });
      const capture = async (name: string) => {
        await list.scrollIntoViewIfNeeded();
        await page.screenshot({ path: testInfo.outputPath(name + ".png") });
      };
      await expect(current.getByRole("button", { name: "完成", exact: true })).toBeVisible();
      await expect(manual.getByRole("button", { name: "开始", exact: true })).toBeVisible();
      await capture("before");
      const submitAndReadRows = async (action: () => Promise<void>) => {
        const response = page.waitForResponse((item) => item.url().includes("/submit-review") && item.request().method() === "POST");
        await action();
        const saved = await response;
        expect(saved.ok()).toBe(true);
        return (await saved.json()).rows as BusinessRow[];
      };
      const otherRows = await submitAndReadRows(() => manual.getByRole("button", { name: "提交验收" }).click());
      await expect(manual).toContainText("待验收");
      await expect(current).toContainText("执行中");
      await expect(page.locator(".timer-face")).toContainText(activeTask.title);
      await expect(page.locator(".timer-controls").getByRole("button", { name: "暂停" })).toBeVisible();
      expect(otherRows.find((row) => row.id === "work_current")?.payload).toMatchObject({ status: "active" });
      expect(otherRows.find((row) => row.id === "focus_current")?.payload).not.toHaveProperty("endedAt");
      await expect(page.locator("body")).not.toHaveAttribute("data-completions", /.+/);

      const rows = await submitAndReadRows(() => current.getByRole("button", { name: "完成", exact: true }).press("Enter"));
      await expect(current).toContainText("已完成");
      await expect(current).toContainText("0/3 番茄");
      expect(rows.find((row) => row.id === "work_current")?.payload).toMatchObject({ status: "ended", taskId: activeTask.id });
      expect(rows.find((row) => row.id === "focus_current")?.payload).toMatchObject({ outcome: "skipped", taskId: activeTask.id });
      expect(rows.filter((row) => row.entity === "execution_signal" && "type" in row.payload && row.payload.type === "work_ended")).toHaveLength(1);
      await expect(page.locator(".timer-controls").getByRole("button", { name: "暂停" })).toHaveCount(0);
      await expect(page.locator("body")).toHaveAttribute("data-completions", "1");
      await expect(current.locator(".just-completed")).toHaveCount(0);
      await capture("after");
      await page.getByRole("navigation", { name: mobile ? "手机页面导航" : "页面导航", exact: true })
        .getByRole("button", { name: "我的任务", exact: true }).click();
      await goToFocus(page, mobile);
      await expect(current).toContainText("已完成");
      await expect(current.locator(".just-completed")).toHaveCount(0);
      await page.reload();
      await goToFocus(page, mobile);
      await expect(current).toContainText("已完成");
      await expect(manual).toContainText("待验收");
      await expect(page.locator("body")).not.toHaveAttribute("data-completions", /.+/);
    });
  });
}

test("blocks repeated submission, retries a failure and respects reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await observeFeedback(page);
  await openApp(page);
  await goToFocus(page);
  let requests = 0;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route(`${MOCK_SERVER}/tasks/*/submit-review*`, async (route) => {
    if (++requests === 1) {
      await gate;
      await route.fulfill({ status: 403, json: { error: "保存被拒绝" } });
    } else {
      await route.fallback();
    }
  });
  const card = page.locator(".focus-todo-item");
  const button = card.getByRole("button", { name: "完成", exact: true });
  await button.evaluate((element: HTMLButtonElement) => { element.click(); element.click(); });
  try {
    await expect(button).toBeDisabled();
    await expect(page.locator(".focus-current-panel").getByRole("button", { name: "完成任务" })).toBeDisabled();
    await expect(card).not.toContainText("已完成");
  } finally {
    release();
  }
  await expect(page.getByRole("alert")).toContainText("保存被拒绝");
  await expect(button).toBeEnabled();
  expect(requests).toBe(1);
  await button.press("Space");
  await expect(card).toContainText("已完成");
  expect(requests).toBe(2);
  await expect(card.locator(".completed-pill")).toHaveCSS("animation-name", "none");
  await expect(page.locator("body")).not.toHaveAttribute("data-completions", /.+/);
});

test("offers completion to an assigned collaborator and hides it on an unassigned card", async ({ page }) => {
  const state = workspaceMemberState();
  const member = { ...state.projectMembers[0], id: "collaborator", accountId: state.auth.account.id,
    email: state.auth.account.email, roles: ["executor" as const] };
  state.projectMembers.push(member);
  const task = state.tasks[0];
  task.collaboratorMemberIds = [member.id];
  const unassigned = { ...task, id: "unassigned", title: "待认领任务", primaryExecutorMemberId: undefined, collaboratorMemberIds: [] };
  state.tasks.push(unassigned);
  state.dailyPlans[0].ownerAccountId = state.auth.account.id;
  state.dailyPlans[0].committedTaskIds.push(unassigned.id);
  await openApp(page, state);
  await goToFocus(page);
  const unassignedCard = page.getByRole("article").filter({ hasText: unassigned.title });
  await expect(unassignedCard.getByRole("button", { name: "开始" })).toBeVisible();
  await expect(unassignedCard.getByRole("button", { name: "完成", exact: true })).toHaveCount(0);
  const assigned = page.getByRole("article").filter({ hasText: task.title });
  await assigned.getByRole("button", { name: "完成", exact: true }).click();
  await expect(assigned).toContainText("已完成");
});

test("uses the confirmed status when the project's policy changes after opening focus", async ({ page }) => {
  const state = authenticatedState();
  await observeFeedback(page);
  await openApp(page, state);
  await goToFocus(page);
  const card = page.locator(".focus-todo-item");
  const complete = card.getByRole("button", { name: "完成", exact: true });
  await expect(complete).toBeVisible();
  // Simulate a project owner changing the setting in another session.
  const updated = await page.evaluate(async (url) => (await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ autoAcceptCompletedTasks: false }),
  })).ok, `${MOCK_SERVER}/projects/${state.tasks[0].projectId}`);
  expect(updated).toBe(true);
  await complete.click();
  await expect(card).toContainText("待验收");
  await expect(card.locator(".completed-pill")).toHaveCount(0);
  await expect(page.locator("body")).not.toHaveAttribute("data-completions", /.+/);
});
