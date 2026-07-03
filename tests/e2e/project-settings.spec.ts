import { expect, test } from "@playwright/test";
import type { SyncRow } from "../../src/sync";
import { MOCK_SERVER, STORAGE_KEY } from "./support/constants";
import { clearStoredApp, openApp } from "./support/openApp";
import { projectMoveState } from "./support/scenarioStates";

test.beforeEach(async ({ page }) => {
  await clearStoredApp(page);
});

test("saves project settings only after clicking save", async ({ page }) => {
  await openApp(page);

  await page.getByRole("button", { name: "进入项目" }).first().click();
  await page.getByRole("button", { name: "设置" }).click();

  const settingsPanel = page.locator(".project-settings-panel");
  await expect(settingsPanel.getByLabel("默认预计开始（小时）")).toHaveCount(0);

  await settingsPanel.getByLabel("项目名称").fill("E2E 保存后项目名");
  await settingsPanel.getByLabel("项目类型").selectOption("regular");
  await settingsPanel.getByLabel("项目说明").fill("设置页点击保存后才写入。");
  await page.waitForTimeout(350);

  await expect
    .poll(async () => {
      return page.evaluate((key) => {
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        const project = parsed.projects?.find((item: { id: string }) => item.id === "project_starter");
        return project ? { name: project.name, description: project.description, taskStageMode: project.taskStageMode } : null;
      }, STORAGE_KEY);
    })
    .toMatchObject({
      name: "TimeManage 团队进度",
      description: "从个人时间管理迁移而来的团队进度管控起始项目。",
      taskStageMode: "software",
    });

  await settingsPanel.getByRole("button", { name: "保存项目资料" }).click();

  await expect
    .poll(async () => {
      return page.evaluate((key) => {
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        const project = parsed.projects?.find((item: { id: string }) => item.id === "project_starter");
        return project ? { name: project.name, description: project.description, taskStageMode: project.taskStageMode } : null;
      }, STORAGE_KEY);
    })
    .toEqual({
      name: "E2E 保存后项目名",
      description: "设置页点击保存后才写入。",
      taskStageMode: "regular",
    });

  await page.getByRole("button", { name: "概览" }).click();
  await page.locator(".project-overview-task-board").getByRole("button", { name: "添加任务" }).click();
  const dialog = page.getByRole("dialog", { name: "添加项目任务" });
  await expect(dialog.getByRole("radio", { name: "规划" })).toBeVisible();
  await expect(dialog.getByRole("radio", { name: "执行" })).toBeVisible();
  await expect(dialog.getByRole("radio", { name: "检查" })).toBeVisible();
  await expect(dialog.getByRole("radio", { name: "开发" })).toHaveCount(0);
});

test("moves a project to another shared workspace from project settings", async ({ page }) => {
  await openApp(page, projectMoveState());

  await page.getByRole("button", { name: "进入项目" }).first().click();
  await page.getByRole("button", { name: "设置" }).click();

  const settingsPanel = page.locator(".project-settings-panel");
  await expect(settingsPanel.getByLabel("所属工作区")).toBeEnabled();
  await settingsPanel.getByLabel("所属工作区").selectOption("workspace_e2e_target");
  const saveRequest = page.waitForRequest((request) =>
    request.url() === `${MOCK_SERVER}/team/changes` && request.method() === "POST",
  );
  page.once("dialog", async (dialog) => {
    expect(dialog.message()).toContain("E2E 目标工作区");
    await dialog.accept();
  });
  await settingsPanel.getByRole("button", { name: "保存项目资料" }).click();
  const requestBody = (await saveRequest).postDataJSON() as { changes: SyncRow[] };
  expect(requestBody.changes).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        workspace_id: "workspace_e2e_target",
        entity: "project",
        id: "project_starter",
      }),
      expect.objectContaining({
        workspace_id: "workspace_e2e",
        entity: "project",
        id: "project_starter",
        deleted_at: expect.any(String),
      }),
    ]),
  );

  await expect(page.getByText("协作工作区 · E2E 目标工作区")).toBeVisible();
  await expect
    .poll(async () =>
      page.evaluate((key) => {
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        const project = parsed.projects?.find((item: { id: string }) => item.id === "project_starter");
        const task = parsed.tasks?.find((item: { id: string }) => item.id === "task_e2e_prd");
        const member = parsed.projectMembers?.find((item: { id: string }) => item.id === "member_owner");
        return {
          projectWorkspaceId: project?.workspaceId,
          taskWorkspaceId: task?.workspaceId,
          memberWorkspaceId: member?.workspaceId,
        };
      }, STORAGE_KEY),
    )
    .toEqual({
      projectWorkspaceId: "workspace_e2e_target",
      taskWorkspaceId: "workspace_e2e_target",
      memberWorkspaceId: "workspace_e2e_target",
    });

  await page.getByLabel("页面导航").getByRole("button", { name: "工作区" }).click();
  const sourceWorkspaceCard = page.locator("article").filter({ hasText: "E2E 工作区" });
  const targetWorkspaceCard = page.locator("article").filter({ hasText: "E2E 目标工作区" });
  await expect(sourceWorkspaceCard.getByRole("button", { name: /项目/ })).toContainText("0");
  await expect(targetWorkspaceCard.getByRole("button", { name: /项目/ })).toContainText("1");

  await targetWorkspaceCard.getByRole("button", { name: /项目/ }).click();
  const targetDialog = page.getByRole("dialog", { name: "E2E 目标工作区 项目管理" });
  await expect(targetDialog).toContainText("TimeManage 团队进度");
});
