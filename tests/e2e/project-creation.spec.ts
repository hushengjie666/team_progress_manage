import { expect, test } from "@playwright/test";
import { STORAGE_KEY } from "./support/constants";
import { clearStoredApp, openApp } from "./support/openApp";

test.beforeEach(async ({ page }) => {
  await clearStoredApp(page);
});

test("creates a regular project from workspace modal and opens regular stages", async ({ page }) => {
  await openApp(page);

  const nav = page.getByLabel("页面导航");
  await nav.getByRole("button", { name: "工作区" }).click();
  await page.locator("article").filter({ hasText: "E2E 工作区" }).getByRole("button", { name: /项目/ }).click();

  const dialog = page.getByRole("dialog", { name: "E2E 工作区 项目管理" });
  await expect(dialog).toBeVisible();
  const createForm = dialog.locator(".workspace-project-create");
  await createForm.getByRole("button", { name: "添加项目" }).click();
  await expect(createForm).toContainText("项目名称不能为空");
  await createForm.getByLabel("项目名称").fill("E2E 常规项目");
  await createForm.getByLabel("项目类型").selectOption("regular");
  await createForm.getByLabel("项目说明").fill("用来验证常规项目阶段。");
  await createForm.getByRole("button", { name: "添加项目" }).click();

  const newProjectCard = dialog.locator("article").filter({ hasText: "E2E 常规项目" });
  await expect(newProjectCard).toContainText("用来验证常规项目阶段。");
  await newProjectCard.getByRole("button", { name: /进入项目/ }).click();

  await expect(page.getByText("协作工作区 · E2E 工作区")).toBeVisible();
  await expect(page.getByRole("heading", { name: "任务阶段总览" })).toBeVisible();
  await expect(page.locator(".project-overview-task-board")).toContainText("规划");
  await expect(page.locator(".project-overview-task-board")).toContainText("执行");
  await expect(page.locator(".project-overview-task-board")).toContainText("检查");
  await expect(page.locator(".project-overview-task-board")).not.toContainText("销售");
});

test("creates a project from overview add card without navigating away", async ({ page }) => {
  await openApp(page);

  const projectOverview = page.getByLabel("项目卡片总览");
  await projectOverview.getByRole("button", { name: /新增项目/ }).click();

  const dialog = page.getByRole("dialog", { name: "新增项目" });
  await expect(dialog).toBeVisible();
  await expect(page.getByRole("heading", { name: "我的工作区" })).toHaveCount(0);

  await dialog.getByRole("button", { name: "添加项目" }).click();
  await expect(dialog).toContainText("项目名称不能为空");
  await dialog.getByLabel("项目名称").fill("E2E 总览弹窗项目");
  await dialog.getByLabel("所属工作区").selectOption("workspace_e2e");
  await dialog.getByLabel("项目类型").selectOption("regular");
  await dialog.getByLabel("项目说明").fill("从项目总览弹窗创建。");
  await dialog.getByRole("button", { name: "添加项目" }).click();

  await expect(dialog).toHaveCount(0);
  await expect(projectOverview).toContainText("E2E 总览弹窗项目");
  await expect(page.getByRole("heading", { name: "我的工作区" })).toHaveCount(0);

  await expect
    .poll(async () =>
      page.evaluate((key) => {
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        const project = parsed.projects?.find((item: { name: string }) => item.name === "E2E 总览弹窗项目");
        return project
          ? { workspaceId: project.workspaceId, taskStageMode: project.taskStageMode, description: project.description }
          : null;
      }, STORAGE_KEY),
    )
    .toEqual({
      workspaceId: "workspace_e2e",
      taskStageMode: "regular",
      description: "从项目总览弹窗创建。",
    });
});

test("hides project member management for private workspace projects", async ({ page }) => {
  await openApp(page);

  const nav = page.getByLabel("页面导航");
  await nav.getByRole("button", { name: "工作区" }).click();
  await page.locator("article").filter({ hasText: "项目负责人私人区" }).getByRole("button", { name: /项目/ }).click();

  const dialog = page.getByRole("dialog", { name: "项目负责人私人区 项目管理" });
  await expect(dialog).toBeVisible();
  const createForm = dialog.locator(".workspace-project-create");
  await createForm.getByLabel("项目名称").fill("E2E 私人项目");
  await createForm.getByLabel("项目类型").selectOption("regular");
  await createForm.getByRole("button", { name: "添加项目" }).click();

  await dialog.getByLabel("关闭").click();
  await nav.getByRole("button", { name: "项目总览" }).click();
  const privateProjectCard = page.getByLabel("项目卡片总览").locator("article").filter({ hasText: "E2E 私人项目" });
  await expect(privateProjectCard.locator(".workspace-source-badge")).toHaveText("私人");
  await privateProjectCard.getByRole("button", { name: "进入项目" }).click();
  await expect(page.getByText("私人工作区 · 项目负责人私人区")).toBeVisible();
  await expect(page.getByRole("button", { name: "项目成员管理" })).toHaveCount(0);
});
