import { expect, test, type Page } from "@playwright/test";

const STORAGE_KEY = "timemanage.app_state.v1";

const authenticatedState = () => {
  const now = new Date().toISOString();
  const today = now.slice(0, 10);
  return {
    auth: {
      status: "authenticated",
      token: "e2e-token",
      expiresAt: "2099-01-01T00:00:00.000Z",
      bootstrapped: true,
      message: "E2E 本地登录",
      workspace: {
        id: "workspace_e2e",
        name: "E2E 工作区",
        createdAt: now,
        updatedAt: now,
      },
      account: {
        id: "account_owner",
        workspaceId: "workspace_e2e",
        name: "项目负责人",
        email: "owner@example.com",
        createdAt: now,
        updatedAt: now,
      },
    },
    sync: {
      enabled: false,
      token: "e2e-token",
      autoSync: false,
      status: "idle",
      message: "E2E 本地模式",
    },
    onboarding: {
      completed: true,
    },
    tasks: [
      {
        id: "task_e2e_prd",
        title: "整理时间管理系统 PRD",
        notes: "把方法论、竞品图和旧系统升级点沉淀成可执行范围。",
        tags: ["方法论", "产品"],
        projectId: "project_starter",
        project: "TimeManage",
        creatorMemberId: "member_owner",
        primaryExecutorMemberId: "member_owner",
        collaboratorMemberIds: [],
        progressPercent: 0,
        progressNote: "",
        priority: "urgent",
        severity: "high",
        stage: "requirements",
        estimatePomodoros: 3,
        status: "committed",
        repeatRule: "none",
        subtasks: [],
        sortOrder: 10,
        actualPomodoros: 0,
        estimateHistory: [],
        createdAt: now,
        updatedAt: now,
      },
    ],
    dailyPlans: [
      {
        id: `plan_${today}`,
        date: today,
        capacityPomodoros: 8,
        committedTaskIds: ["task_e2e_prd"],
        completedPomodoros: 0,
        suggestedTaskIds: [],
        reflection: "",
        review: {
          mood: "normal",
          wins: "",
          blockers: "",
          interruptionPattern: "",
          tomorrowFocus: "",
        },
        createdAt: now,
        updatedAt: now,
      },
    ],
    updatedAt: now,
  };
};

const openApp = async (page: Page) => {
  await page.addInitScript(
    ({ key, value }) => {
      localStorage.setItem(key, JSON.stringify(value));
    },
    { key: STORAGE_KEY, value: authenticatedState() },
  );
  await page.goto("/");
};

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate((key) => localStorage.removeItem(key), STORAGE_KEY);
});

test("opens current navigation and primary work surfaces", async ({ page }) => {
  await openApp(page);

  const nav = page.getByLabel("页面导航");
  await expect(nav.getByRole("button", { name: "项目总览" })).toBeVisible();
  await expect(nav.getByRole("button", { name: "我的任务" })).toBeVisible();
  await expect(nav.getByRole("button", { name: "管理中心" })).toBeVisible();
  await expect(page.getByLabel("项目卡片总览")).toContainText("TimeManage 团队进度");

  await nav.getByRole("button", { name: "我的任务" }).click();
  await expect(page.getByRole("heading", { name: "活动清单" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "工作队列" })).toBeVisible();

  await nav.getByRole("button", { name: "管理中心" }).click();
  await expect(page.getByRole("heading", { name: "团队成员库" })).toBeVisible();

  await nav.getByRole("button", { name: "开始工作" }).click();
  await expect(page.getByRole("heading", { name: "当下清单" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "待办清单" })).toBeVisible();
});

test("opens a project and creates a task with the unified task form", async ({ page }) => {
  await openApp(page);

  await page.getByRole("button", { name: "进入项目" }).first().click();
  await expect(page.getByRole("heading", { name: "任务阶段总览" })).toBeVisible();

  await page.getByRole("button", { name: "添加任务" }).click();
  const dialog = page.getByRole("dialog", { name: "添加项目任务" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("标题")).toBeVisible();
  await expect(dialog.getByLabel("主执行人")).toBeVisible();
  await expect(dialog.getByLabel("估算时长（小时）")).toBeVisible();
  await expect(dialog.getByRole("radiogroup", { name: "任务阶段" })).toBeVisible();

  await dialog.getByLabel("标题").fill("E2E 项目弹窗任务");
  await dialog.getByRole("radio", { name: "开发" }).click();
  await dialog.getByLabel("估算时长（小时）").fill("2");
  await dialog.getByRole("button", { name: "创建任务" }).click();

  await expect(dialog).toHaveCount(0);
  await expect(page.getByText("E2E 项目弹窗任务").first()).toBeVisible();

  await expect
    .poll(async () => {
      return page.evaluate((key) => {
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return parsed.tasks?.find((task: { title: string }) => task.title === "E2E 项目弹窗任务") ?? null;
      }, STORAGE_KEY);
    })
    .toMatchObject({
      title: "E2E 项目弹窗任务",
      stage: "development",
      estimatePomodoros: 5,
    });
});

test("edits task detail and persists progress fields", async ({ page }) => {
  await openApp(page);

  await page.getByRole("button", { name: "我的任务" }).click();
  await page.locator("article").filter({ hasText: "整理时间管理系统 PRD" }).getByTitle("任务详情").click();

  const dialog = page.getByRole("dialog", { name: /任务详情：整理时间管理系统 PRD/ });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("spinbutton", { name: "进度百分比" }).fill("45");
  await dialog.getByLabel("进展说明").fill("E2E 进度已持久化。");

  await expect
    .poll(async () => {
      return page.evaluate((key) => {
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        const task = parsed.tasks?.find((item: { title: string }) => item.title === "整理时间管理系统 PRD");
        return task ? { progressPercent: task.progressPercent, progressNote: task.progressNote } : null;
      }, STORAGE_KEY);
    })
    .toEqual({ progressPercent: 45, progressNote: "E2E 进度已持久化。" });

  await expect(dialog.getByRole("spinbutton", { name: "进度百分比" })).toHaveValue("45");
  await expect(dialog.getByLabel("进展说明")).toHaveValue("E2E 进度已持久化。");
});

test("opens calendar, daily review, reports and command palette", async ({ page }) => {
  await openApp(page);

  const nav = page.getByLabel("页面导航");
  await nav.getByRole("button", { name: "历史日报" }).click();
  await expect(page.getByRole("heading", { name: "历史日报" })).toBeVisible();

  await nav.getByRole("button", { name: "每日总结" }).click();
  await expect(page.getByRole("heading", { name: "日终回顾" })).toBeVisible();

  await nav.getByRole("button", { name: "复盘洞察" }).click();
  await expect(page.getByRole("heading", { name: "近 30 天复盘" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "自律激励" })).toBeVisible();

  await page.keyboard.press("/");
  await expect(page.getByRole("dialog", { name: "命令面板" })).toBeVisible();
});
