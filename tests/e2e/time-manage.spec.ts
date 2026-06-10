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
