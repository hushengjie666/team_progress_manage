import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.removeItem("timemanage.app_state.v1"));
  await page.reload();
});

test("completes onboarding and reaches the workspace", async ({ page }) => {
  await expect(page.getByRole("heading", { name: "先把分心源摆到桌面上。" })).toBeVisible();
  await page.getByRole("button", { name: "下一步" }).click();
  await page.getByRole("button", { name: "下一步" }).click();
  await page.getByRole("button", { name: "下一步" }).click();
  await page.getByRole("button", { name: "开始今天" }).click();
  await expect(page.getByRole("heading", { name: "今日工作台" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "下一步很明确" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "今日计划助手" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "活动清单", exact: true }).first()).toBeVisible();
});

test("creates a task, commits it, records interruption and review", async ({ page }) => {
  await page.getByRole("button", { name: "下一步" }).click();
  await page.getByRole("button", { name: "下一步" }).click();
  await page.getByRole("button", { name: "下一步" }).click();
  await page.getByRole("button", { name: "开始今天" }).click();

  await page.getByPlaceholder("例如：整理严格模式权限说明").fill("E2E 可靠计时任务");
  await page.getByRole("button", { name: /添加/ }).click();
  await page.locator("article").filter({ hasText: "E2E 可靠计时任务" }).getByRole("button", { name: "选入今日" }).click();
  await expect(page.getByRole("heading", { name: "今日承诺", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "专注" }).click();
  await page.getByRole("button", { name: /开始番茄/ }).click();
  await page.getByPlaceholder("记录突发念头或外部请求").fill("突然想到要回消息");
  await page.getByRole("button", { name: "内部中断" }).click();

  await page.getByRole("button", { name: "工作台" }).click();
  await page.getByText("突然想到要回消息").waitFor();
  await page.getByRole("button", { name: "转任务" }).first().click();
  await page.getByLabel("今日收获").fill("完成了核心链路测试");
  await page.getByRole("button", { name: /完成回顾/ }).click();
  await expect(page.getByText(/建议明日/)).toBeVisible();
});

test("starts assigned work from the personal workbench without daily commitment", async ({ page }) => {
  await page.getByRole("button", { name: "下一步" }).click();
  await page.getByRole("button", { name: "下一步" }).click();
  await page.getByRole("button", { name: "下一步" }).click();
  await page.getByRole("button", { name: "开始今天" }).click();

  const workbench = page.locator(".personal-workbench");
  await expect(workbench.getByRole("heading", { name: "我的任务" })).toBeVisible();
  await expect(workbench.getByText("当前执行者")).toBeVisible();

  const assignedPoolTask = workbench.locator("article").filter({ hasText: "设计番茄报表指标" });
  await expect(assignedPoolTask).toBeVisible();
  await assignedPoolTask.getByRole("button", { name: "开始工作" }).click();

  await expect(page.getByText("设计番茄报表指标").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "暂停" })).toBeVisible();

  await page.getByLabel("页面导航").getByRole("button", { name: "工作台" }).click();
  await expect(workbench.getByText("会先结束当前会话，再开始新任务")).toBeVisible();
  await workbench.locator("article").filter({ hasText: "整理时间管理系统 PRD" }).getByRole("button", { name: "切换任务" }).click();
  await expect(page.getByText("整理时间管理系统 PRD").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "暂停" })).toBeVisible();

  await page.waitForFunction(() => {
    const raw = localStorage.getItem("timemanage.app_state.v1");
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    return parsed.workSessions?.filter((session: { status: string }) => session.status === "active").length === 1
      && parsed.executionSignals?.some((signal: { type: string; payload?: { reason?: string } }) =>
        signal.type === "work_ended" && signal.payload?.reason === "task_switch",
      );
  });
  const workSessionState = await page.evaluate(() => {
    const raw = localStorage.getItem("timemanage.app_state.v1");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return {
      activeCount: parsed.workSessions.filter((session: { status: string }) => session.status === "active").length,
      endedBySwitchCount: parsed.executionSignals.filter((signal: { type: string; payload?: { reason?: string } }) =>
        signal.type === "work_ended" && signal.payload?.reason === "task_switch",
      ).length,
    };
  });
  expect(workSessionState).toEqual({ activeCount: 1, endedBySwitchCount: 1 });
});

test("persists task progress percent and progress note", async ({ page }) => {
  await page.getByRole("button", { name: "下一步" }).click();
  await page.getByRole("button", { name: "下一步" }).click();
  await page.getByRole("button", { name: "下一步" }).click();
  await page.getByRole("button", { name: "开始今天" }).click();

  const workbench = page.locator(".personal-workbench");
  await workbench.locator("article").filter({ hasText: "设计番茄报表指标" }).getByTitle("任务详情").click();
  await page.getByRole("spinbutton", { name: "进度百分比" }).fill("45");
  await page.getByLabel("进展说明").fill("完成指标口径，剩余图表校验。");

  await page.waitForFunction(() => {
    const raw = localStorage.getItem("timemanage.app_state.v1");
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    const task = parsed.tasks.find((item: { title: string }) => item.title === "设计番茄报表指标");
    return task?.progressPercent === 45 && task?.progressNote === "完成指标口径，剩余图表校验。";
  });

  await page.reload();
  await expect(page.getByRole("heading", { name: "今日工作台" })).toBeVisible();
  await workbench.locator("article").filter({ hasText: "设计番茄报表指标" }).getByTitle("任务详情").click();
  await expect(page.getByRole("spinbutton", { name: "进度百分比" })).toHaveValue("45");
  await expect(page.getByLabel("进展说明")).toHaveValue("完成指标口径，剩余图表校验。");
});

test("orders the progress board by risk before normal work", async ({ page }) => {
  await page.getByRole("button", { name: "下一步" }).click();
  await page.getByRole("button", { name: "下一步" }).click();
  await page.getByRole("button", { name: "下一步" }).click();
  await page.getByRole("button", { name: "开始今天" }).click();

  await page.waitForFunction(() => {
    const raw = localStorage.getItem("timemanage.app_state.v1");
    if (!raw) return false;
    return JSON.parse(raw).onboarding?.completed === true;
  });
  const progressBoardState = await page.evaluate(() => {
    const raw = localStorage.getItem("timemanage.app_state.v1");
    if (!raw) return "";
    const state = JSON.parse(raw);
    const projectId = state.projects[0].id;
    const memberId = state.projectMembers[0].id;
    const now = Date.now();
    const old = new Date(now - 48 * 60 * 60 * 1000).toISOString();
    const stale = new Date(now - 30 * 60 * 60 * 1000).toISOString();
    const recent = new Date(now - 60 * 60 * 1000).toISOString();
    const nearFinish = new Date(now + 60 * 60 * 1000).toISOString();
    state.projects = state.projects.map((project: { id: string; defaultExpectedStartHours: number }) =>
      project.id === projectId ? { ...project, defaultExpectedStartHours: 1 } : project,
    );
    const base = state.tasks[0];
    const task = (id: string, title: string, status: string, patch = {}) => ({
      ...base,
      id,
      title,
      projectId,
      project: state.projects[0].name,
      primaryExecutorMemberId: memberId,
      status,
      progressPercent: 20,
      progressNote: "",
      createdAt: old,
      updatedAt: recent,
      expectedStartAt: undefined,
      expectedFinishAt: undefined,
      completedAt: undefined,
      reviewReturnReason: undefined,
      ...patch,
    });
    state.tasks = [
      task("e2e_assigned", "E2E 已分配未开始", "pool", { updatedAt: old }),
      task("e2e_stalled", "E2E 停滞任务", "in_progress", { updatedAt: stale }),
      task("e2e_blocked", "E2E 阻塞任务", "in_progress", { progressNote: "被外部系统阻塞" }),
      task("e2e_review", "E2E 待验收任务", "pending_review", { progressPercent: 100, reviewSubmittedAt: recent }),
      task("e2e_near_finish", "E2E 临近完成任务", "in_progress", { progressPercent: 80, expectedFinishAt: nearFinish }),
      task("e2e_normal", "E2E 正常工作", "in_progress", { progressPercent: 25 }),
    ];
    state.workSessions = [
      { id: "work_stalled", taskId: "e2e_stalled", executorMemberId: memberId, focusSessionId: "focus_stalled", status: "ended", startedAt: stale, endedAt: stale, totalPausedSeconds: 0, createdAt: stale, updatedAt: stale },
      { id: "work_blocked", taskId: "e2e_blocked", executorMemberId: memberId, focusSessionId: "focus_blocked", status: "ended", startedAt: recent, endedAt: recent, totalPausedSeconds: 0, createdAt: recent, updatedAt: recent },
      { id: "work_near", taskId: "e2e_near_finish", executorMemberId: memberId, focusSessionId: "focus_near", status: "ended", startedAt: recent, endedAt: recent, totalPausedSeconds: 0, createdAt: recent, updatedAt: recent },
      { id: "work_normal", taskId: "e2e_normal", executorMemberId: memberId, focusSessionId: "focus_normal", status: "active", startedAt: recent, totalPausedSeconds: 0, createdAt: recent, updatedAt: recent },
    ];
    state.executionSignals = state.workSessions.map((session: { id: string; taskId: string; executorMemberId: string; updatedAt: string }) => ({
      id: `signal_${session.taskId}`,
      workSessionId: session.id,
      taskId: session.taskId,
      executorMemberId: session.executorMemberId,
      type: "work_started",
      createdAt: session.updatedAt,
    }));
    return JSON.stringify(state);
  });
  await page.addInitScript((payload) => {
    localStorage.setItem("timemanage.app_state.v1", payload);
  }, progressBoardState);
  await page.reload();

  const board = page.locator(".progress-board");
  await expect(board.getByRole("heading", { name: "项目进度看板" })).toBeVisible();
  await expect(board.getByText("活跃工作会话")).toBeVisible();
  await expect(board.getByText("E2E 正常工作").first()).toBeVisible();
  const sectionTitles = await board.locator(".board-section-heading strong").allTextContents();
  expect(sectionTitles).toEqual(["已分配未开始", "停滞风险", "阻塞任务", "待验收", "临近预计完成", "正常工作"]);
  await expect(board.locator(".board-section").filter({ hasText: "已分配未开始" })).toContainText("E2E 已分配未开始");
  await expect(board.locator(".board-section").filter({ hasText: "正常工作" })).toContainText("E2E 正常工作");
});

test("uses usability helpers for advanced task fields, split, delete undo and sync wizard", async ({ page }) => {
  await page.getByRole("button", { name: "下一步" }).click();
  await page.getByRole("button", { name: "下一步" }).click();
  await page.getByRole("button", { name: "下一步" }).click();
  await page.getByRole("button", { name: "开始今天" }).click();

  await page.getByRole("button", { name: "更多设置" }).click();
  await page.getByPlaceholder("例如：整理严格模式权限说明").fill("E2E 高级任务");
  await page.getByLabel("项目").first().fill("E2E 项目");
  await page.getByRole("button", { name: /^添加$/ }).click();
  await expect(page.getByText("E2E 高级任务").first()).toBeVisible();

  await page.locator("article").filter({ hasText: "拆分移动端严格模式实现" }).getByRole("button", { name: "拆分" }).first().click();
  await expect(page.getByRole("dialog", { name: "拆分任务" })).toBeVisible();
  const splitDialog = page.getByRole("dialog", { name: "拆分任务" });
  await splitDialog.locator("textarea").fill("E2E 拆分一\nE2E 拆分二");
  await splitDialog.getByRole("button", { name: "拆分任务" }).click();
  await expect(page.getByText("E2E 拆分一").first()).toBeVisible();

  const createdTask = page.locator("article").filter({ hasText: "E2E 高级任务" }).filter({ has: page.getByTitle("删除任务") }).first();
  await createdTask.getByTitle("删除任务").click();
  const deleteDialog = page.getByRole("dialog", { name: "删除任务" });
  await expect(deleteDialog).toBeVisible();
  await deleteDialog.getByRole("button", { name: "删除", exact: true }).click();
  await page.getByRole("button", { name: "撤销" }).click();
  await expect(page.getByText("E2E 高级任务").first()).toBeVisible();

  await page.getByRole("button", { name: "设置", exact: true }).click();
  await expect(page.getByRole("heading", { name: "同步配置向导" })).toBeVisible();
  await expect(page.getByRole("button", { name: "检查服务" })).toBeVisible();
  await page.getByRole("button", { name: "展开高级状态" }).click();
  await expect(page.getByText("远端版本")).toBeVisible();
});

test("shows reports insights", async ({ page }) => {
  await page.getByRole("button", { name: "下一步" }).click();
  await page.getByRole("button", { name: "下一步" }).click();
  await page.getByRole("button", { name: "下一步" }).click();
  await page.getByRole("button", { name: "开始今天" }).click();
  await page.getByRole("button", { name: "报告" }).click();
  await expect(page.getByRole("heading", { name: "可操作洞察" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "自律激励" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "下一步建议" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "中断高发时段" })).toBeVisible();
  await expect(page.getByText("明日容量建议")).toBeVisible();
  await expect(page.getByText("估算准确").first()).toBeVisible();
});

test("uses calendar templates, command palette, report filters and data export", async ({ page }) => {
  await page.getByRole("button", { name: "下一步" }).click();
  await page.getByRole("button", { name: "下一步" }).click();
  await page.getByRole("button", { name: "下一步" }).click();
  await page.getByRole("button", { name: "开始今天" }).click();

  await page.getByRole("button", { name: "日历" }).click();
  await expect(page.getByRole("heading", { name: "长期计划日历" })).toBeVisible();
  await page.locator(".template-item").filter({ hasText: "晨间计划" }).getByRole("button", { name: "生成" }).click();
  await expect(page.getByText("晨间计划").first()).toBeVisible();
  await page.getByRole("button", { name: "日历" }).click();
  await page.getByLabel("排入这一天").selectOption({ label: "设计番茄报表指标" });
  await page.getByRole("button", { name: "加入计划" }).click();
  await expect(page.getByText("设计番茄报表指标").first()).toBeVisible();
  await expect(page.getByText("日终回顾")).toBeVisible();
  await expect(page.getByText("该日尚未完成回顾")).toBeVisible();
  await page.getByRole("button", { name: "新建模板" }).click();
  await page.getByLabel("名称").fill("E2E 模板");
  await page.getByLabel("子任务").fill("准备\n执行\n复盘");
  await page.getByRole("button", { name: "保存模板" }).click();
  await expect(page.getByText("E2E 模板").first()).toBeVisible();

  await page.getByRole("button", { name: "工作台", exact: true }).click();
  await page.getByPlaceholder("例如：整理严格模式权限说明").fill("命令面板定位任务");
  await page.locator(".add-task").getByRole("button", { name: "添加", exact: true }).click();
  await page.keyboard.press("/");
  const commandDialog = page.getByRole("dialog", { name: "命令面板" });
  await expect(commandDialog).toBeVisible();
  await commandDialog.getByPlaceholder("搜索命令，或输入：明天10点 写周报 #工作 2p").fill("命令面板定位任务");
  await commandDialog.locator(".command-section .command-item").filter({ hasText: "命令面板定位任务" }).click();
  await expect(page.getByRole("heading", { name: "今日工作台" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "标题" })).toHaveValue("命令面板定位任务");

  await page.getByRole("button", { name: "报告" }).click();
  await expect(page.getByRole("heading", { name: "近 30 天复盘" })).toBeVisible();
  await page.getByLabel("时间范围").selectOption("7d");
  await expect(page.getByRole("heading", { name: "近 7 天复盘" })).toBeVisible();

  await page.getByRole("button", { name: "设置", exact: true }).click();
  await expect(page.getByRole("heading", { name: "数据管理" })).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出 CSV" }).click();
  expect((await download).suggestedFilename()).toContain("timemanage");
  await expect(page.getByRole("heading", { name: "自建服务器部署提示" })).toBeVisible();
});
