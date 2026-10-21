import { expect, test } from "@playwright/test";
import { startTimerInState } from "../../src/appModel";
import { authenticatedState } from "./support/authenticatedState";
import { workspaceMemberState } from "./support/scenarioStates";
import { clearStoredApp, openApp } from "./support/openApp";

test.use({ viewport: { width: 1440, height: 1000 } });
test.beforeEach(async ({ page }) => { await clearStoredApp(page); });

const legacyOverviewState = () => {
  const state = authenticatedState();
  const member = { ...state.projectMembers[0], roles: [], name: state.auth.account!.name };
  const teammate = {
    ...member, id: "member_overview_teammate", accountId: "account_wangshuo", name: "王硕", email: "wangshuo",
  };
  state.projectMembers = [member, teammate];
  state.tasks = [
    ...Array.from({ length: 5 }, (_, index) => ({
      ...state.tasks[0], id: `task_unassigned_${index}`, title: `未分配的今日任务 ${index + 1}`,
      primaryExecutorMemberId: undefined, collaboratorMemberIds: [], status: "completed" as const,
    })),
    { ...state.tasks[0], id: "task_assigned", title: "有执行人的今日任务", status: "completed" as const },
    {
      ...state.tasks[0], id: "task_shared", title: "多人共同参与的今日任务", primaryExecutorMemberId: teammate.id,
      collaboratorMemberIds: [member.id], status: "completed" as const,
    },
    {
      ...state.tasks[0], id: "task_completed_outside_plan", title: "未进计划但今天完成的任务",
      primaryExecutorMemberId: undefined, status: "completed" as const,
      completedAt: new Date().toISOString(), reviewSubmittedByMemberId: member.id,
    },
  ];
  state.dailyPlans[0].committedTaskIds = state.tasks.slice(0, 7).map((task) => task.id);
  return state;
};

test("reconciles missing assignments and today's unplanned completion with a distinct task total", async ({ page }, testInfo) => {
  const state = legacyOverviewState();
  const privateProject = { ...state.projects[0], id: "project_overview_private", workspaceId: "workspace_private_account_owner", name: "私人项目" };
  state.projects.push(privateProject);
  state.tasks.push({ ...state.tasks[7], id: "task_private", projectId: privateProject.id, workspaceId: privateProject.workspaceId, title: "私人任务不应进入协作总览" });
  await openApp(page, state);
  await page.getByRole("group", { name: "工作区筛选" }).getByRole("button", { name: "E2E 工作区", exact: true }).click();
  await page.getByLabel("页面导航").getByRole("button", { name: "成员状况" }).click();
  const panel = page.locator(".member-status-panel");
  const ownerColumn = panel.locator(".member-status-column").filter({ has: page.getByText(state.auth.account!.name, { exact: true }) });
  const teammateColumn = panel.locator(".member-status-column").filter({ has: page.getByText("王硕", { exact: true }) });
  await expect(panel.locator(".count-pill")).toHaveText("8 项任务");
  await expect(ownerColumn.locator(".member-task-item")).toHaveCount(8);
  await expect(teammateColumn.locator(".member-task-item")).toHaveCount(1);
  expect(new Set(await panel.locator(".member-task-item strong").allTextContents()).size).toBe(8);
  await expect(panel).not.toContainText("私人任务不应进入协作总览");
  await expect(ownerColumn.locator(".member-project-role")).toHaveText("成员");
  await page.screenshot({ path: testInfo.outputPath("member-overview-reconciled.png") });
  await ownerColumn.getByRole("button", { name: /未分配的今日任务 1/ }).click();
  await expect(page.getByRole("dialog", { name: /任务详情：未分配的今日任务 1/ })).toBeVisible();
});

test("shows unresolvable legacy assignments without inventing a project owner", async ({ page }) => {
  const state = legacyOverviewState();
  state.tasks = state.tasks.slice(0, 2);
  state.tasks[1].primaryExecutorMemberId = "missing_legacy_member";
  state.dailyPlans[0].ownerAccountId = undefined;
  state.dailyPlans[0].committedTaskIds = state.tasks.map((task) => task.id);
  await openApp(page, state);
  await page.getByLabel("页面导航").getByRole("button", { name: "成员状况" }).click();
  const unresolved = page.locator(".member-status-column").filter({ has: page.getByText("归属待确认", { exact: true }) });
  await expect(unresolved.locator(".member-task-item")).toHaveCount(2);
  await expect(page.locator(".member-status-panel .count-pill")).toHaveText("2 项任务");
});

test("includes running work in both the member column and the total when a plan is absent", async ({ page }) => {
  const initial = authenticatedState();
  const state = startTimerInState(initial, "focus", initial.tasks[0].id, new Date().toISOString(), "overview_running_timer", { workSessionId: "overview_running_work" });
  state.dailyPlans = [];
  await openApp(page, state);
  await page.getByLabel("页面导航").getByRole("button", { name: "成员状况" }).click();
  const panel = page.locator(".member-status-panel");
  await expect(panel.locator(".count-pill")).toHaveText("1 项任务");
  await expect(panel.locator(".member-task-item.running")).toContainText(initial.tasks[0].title);
});

test("keeps review actions restricted when opening task details from the overview", async ({ page }) => {
  const state = workspaceMemberState();
  const executor = {
    ...state.projectMembers[0], id: "member_overview_executor", accountId: "account_wangshuo",
    name: "王硕", email: "wangshuo", roles: ["executor" as const],
  };
  state.projectMembers.push(executor);
  state.tasks[0] = { ...state.tasks[0], status: "pending_review", primaryExecutorMemberId: executor.id };
  await openApp(page, state);
  await page.getByLabel("页面导航").getByRole("button", { name: "成员状况" }).click();
  await page.locator(".member-status-panel").getByRole("button", { name: new RegExp(state.tasks[0].title) }).click();
  const dialog = page.getByRole("dialog", { name: new RegExp(`任务详情：${state.tasks[0].title}`) });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "验收通过", exact: true })).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: "退回任务", exact: true })).toHaveCount(0);
});
