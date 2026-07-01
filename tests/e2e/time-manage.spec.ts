import { expect, test, type Page } from "@playwright/test";
import { createInitialState } from "../../src/seed";
import { flattenStateToChanges, type SyncRow } from "../../src/sync";
import type { AppState } from "../../src/types";

const STORAGE_KEY = "timemanage.app_state.v1";
const MOCK_SERVER = "http://127.0.0.1:8787";

const authenticatedState = (): AppState => {
  const base = createInitialState();
  const now = new Date().toISOString();
  const today = now.slice(0, 10);
  const privateWorkspace = {
    id: "workspace_private_account_owner",
    name: "项目负责人私人区",
    type: "private" as const,
    ownerAccountId: "account_owner",
    createdAt: now,
    updatedAt: now,
  };
  const sharedWorkspace = {
    id: "workspace_e2e",
    name: "E2E 工作区",
    type: "shared" as const,
    ownerAccountId: "account_owner",
    createdAt: now,
    updatedAt: now,
  };
  return {
    ...base,
    auth: {
      status: "authenticated",
      token: "e2e-token",
      expiresAt: "2099-01-01T00:00:00.000Z",
      bootstrapped: true,
      message: "E2E 本地登录",
      workspace: sharedWorkspace,
      workspaces: [privateWorkspace, sharedWorkspace],
      membership: {
        id: "membership_workspace_e2e_account_owner",
        workspaceId: "workspace_e2e",
        accountId: "account_owner",
        name: "项目负责人",
        email: "owner@example.com",
        role: "owner",
        status: "active",
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
      ...base.sync,
      enabled: false,
      token: "e2e-token",
      autoSync: false,
      serverUrl: MOCK_SERVER,
      status: "idle",
      message: "E2E 本地模式",
    },
    onboarding: {
      ...base.onboarding,
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

const rowsFromState = (state: AppState, revision: number): SyncRow[] =>
  flattenStateToChanges(state).map((change) => ({
    ...change,
    revision,
    version: 1,
  }));

const upsertById = <T extends { id: string }>(items: T[], item: T) =>
  items.some((value) => value.id === item.id)
    ? items.map((value) => (value.id === item.id ? item : value))
    : [item, ...items];

const applyRemoteChange = (state: AppState, change: SyncRow): AppState => {
  if (change.deleted_at) return state;
  const payload = change.payload as never;
  if (change.entity === "settings") return { ...state, settings: payload };
  if (change.entity === "onboarding") return { ...state, onboarding: payload };
  if (change.entity === "reward_state") return { ...state, rewardState: payload };
  if (change.entity === "project") return { ...state, projects: upsertById(state.projects, payload) };
  if (change.entity === "team_member") return { ...state, teamMembers: upsertById(state.teamMembers, payload) };
  if (change.entity === "project_member") return { ...state, projectMembers: upsertById(state.projectMembers, payload) };
  if (change.entity === "task") return { ...state, tasks: upsertById(state.tasks, payload) };
  if (change.entity === "daily_plan") return { ...state, dailyPlans: upsertById(state.dailyPlans, payload) };
  if (change.entity === "focus_session") return { ...state, focusSessions: upsertById(state.focusSessions, payload) };
  if (change.entity === "work_session") return { ...state, workSessions: upsertById(state.workSessions, payload) };
  if (change.entity === "execution_signal") return { ...state, executionSignals: upsertById(state.executionSignals, payload) };
  if (change.entity === "interruption") return { ...state, interruptions: upsertById(state.interruptions, payload) };
  if (change.entity === "strict_violation") return { ...state, strictViolations: upsertById(state.strictViolations, payload) };
  if (change.entity === "block_profile") return { ...state, blockProfiles: upsertById(state.blockProfiles, payload) };
  return state;
};

const mockTeamBackend = async (page: Page, initialState: AppState) => {
  const workspaceStates: Record<string, AppState> = {
    [initialState.auth.workspace?.id ?? "workspace_e2e"]: initialState,
    workspace_private_account_owner: {
      ...initialState,
      auth: {
        ...initialState.auth,
        workspace: initialState.auth.workspaces?.find((workspace) => workspace.id === "workspace_private_account_owner"),
      },
      projects: [],
      projectMembers: [],
      tasks: [],
      dailyPlans: [],
    },
  };
  let activeWorkspaceId = initialState.auth.workspace?.id ?? "workspace_e2e";
  let revision = 1;
  await page.route(`${MOCK_SERVER}/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === "/auth/status") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          bootstrapped: true,
          workspace_id: initialState.auth.workspace?.id,
          workspace_name: initialState.auth.workspace?.name,
        }),
      });
      return;
    }
    if (url.pathname === "/auth/switch-workspace") {
      const body = request.postDataJSON() as { workspace_id?: string };
      const workspace = initialState.auth.workspaces?.find((item) => item.id === body.workspace_id);
      if (!workspace) {
        await route.fulfill({
          status: 403,
          contentType: "application/json",
          body: JSON.stringify({ error: "workspace access denied" }),
        });
        return;
      }
      activeWorkspaceId = workspace.id;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          token: "e2e-token",
          user_id: initialState.auth.account?.id,
          expires_at: initialState.auth.expiresAt,
          account: {
            id: initialState.auth.account?.id,
            workspace_id: workspace.id,
            name: initialState.auth.account?.name,
            email: initialState.auth.account?.email,
            created_at: initialState.auth.account?.createdAt,
            updated_at: initialState.auth.account?.updatedAt,
          },
          workspace: {
            id: workspace.id,
            name: workspace.name,
            type: workspace.type,
            owner_account_id: workspace.ownerAccountId,
            created_at: workspace.createdAt,
            updated_at: workspace.updatedAt,
          },
          membership: {
            id: `membership_${workspace.id}_account_owner`,
            workspace_id: workspace.id,
            account_id: initialState.auth.account?.id,
            name: initialState.auth.account?.name,
            email: initialState.auth.account?.email,
            role: "owner",
            status: "active",
            created_at: workspace.createdAt,
            updated_at: workspace.updatedAt,
          },
          workspaces: initialState.auth.workspaces?.map((item) => ({
            id: item.id,
            name: item.name,
            type: item.type,
            owner_account_id: item.ownerAccountId,
            created_at: item.createdAt,
            updated_at: item.updatedAt,
          })),
        }),
      });
      return;
    }
    if (url.pathname === "/team/state") {
      const serverState = workspaceStates[activeWorkspaceId] ?? initialState;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ current_revision: revision, changes: rowsFromState(serverState, revision) }),
      });
      return;
    }
    if (url.pathname === "/team/revision" || url.pathname === "/sync/revision") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ current_revision: revision }),
      });
      return;
    }
    if (url.pathname === "/team/changes") {
      const body = request.postDataJSON() as { changes?: SyncRow[] };
      const accepted = (body.changes ?? []).map((change) => ({ ...change, revision: ++revision, version: 1 }));
      const serverState = workspaceStates[activeWorkspaceId] ?? initialState;
      workspaceStates[activeWorkspaceId] = accepted.reduce(applyRemoteChange, serverState);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ accepted, conflicts: [], current_revision: revision }),
      });
      return;
    }
    await route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ error: `unhandled mock route: ${url.pathname}` }),
    });
  });
};

const openApp = async (page: Page) => {
  const state = authenticatedState();
  await mockTeamBackend(page, state);
  await page.addInitScript(
    ({ key, value }) => {
      localStorage.setItem(key, JSON.stringify(value));
    },
    { key: STORAGE_KEY, value: state },
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
  await expect(page.getByRole("heading", { name: "按职责管理项目、偏好与系统能力" })).toBeVisible();

  await nav.getByRole("button", { name: "开始工作" }).click();
  await expect(page.getByRole("heading", { name: "当下清单" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "今日任务" })).toBeVisible();
});

test("switches shared and private workspace navigation", async ({ page }) => {
  await openApp(page);

  const nav = page.getByLabel("页面导航");
  const workspaceSelect = page.locator(".topbar-actions").getByLabel("当前工作区");
  await expect(nav.getByRole("button", { name: "成员状况" })).toBeVisible();

  await workspaceSelect.selectOption("workspace_private_account_owner");
  await expect(workspaceSelect).toHaveValue("workspace_private_account_owner");
  await expect(nav.getByRole("button", { name: "成员状况" })).toHaveCount(0);
  await expect(nav.getByRole("button", { name: "项目总览" })).toBeVisible();

  await workspaceSelect.selectOption("workspace_e2e");
  await expect(workspaceSelect).toHaveValue("workspace_e2e");
  await expect(nav.getByRole("button", { name: "成员状况" })).toBeVisible();
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
