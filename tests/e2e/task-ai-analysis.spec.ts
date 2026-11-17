import { expect, test } from "@playwright/test";
import { openApp } from "./support/openApp";
import { mockAutora } from "./support/mockAutora";

const taskTitle = "整理时间管理系统 PRD";
const openAi = async (page: import("@playwright/test").Page) => {
  await page.getByRole("button", { name: "进入项目" }).first().click();
  await page.getByRole("button", { name: `AI 需求分析：${taskTitle}`, exact: true }).click();
  return page.getByRole("dialog", { name: `AI 需求分析：${taskTitle}` });
};

test("opens the AI dialog independently and saves requirement edits only on explicit save", async ({ page }) => {
  await mockAutora(page);
  await openApp(page);
  const taskWrites: unknown[] = [];
  page.on("request", (request) => {
    if (request.method() === "PATCH" && request.url().includes("/tasks/")) taskWrites.push(request.postDataJSON());
  });
  const dialog = await openAi(page);
  await expect(page.getByRole("dialog", { name: /^任务详情/ })).toHaveCount(0);
  await expect(dialog.getByText("AutoRA 已连接 · 本机测试")).toBeVisible();
  await expect(dialog.getByText("已达到 AutoRA 扫描或上下文上限", { exact: false })).toBeVisible();
  await expect(dialog.getByRole("option", { name: "其他工作区目录" })).toHaveCount(0);
  await dialog.getByLabel("需求标题").fill("AI 编辑后的需求");
  await dialog.getByLabel("需求描述").fill("新增需求描述");
  expect(taskWrites).toHaveLength(0);
  await dialog.getByRole("button", { name: "保存到任务" }).click();
  await expect.poll(() => taskWrites.length).toBe(1);
  expect(taskWrites[0]).toMatchObject({ title: "AI 编辑后的需求", notes: "新增需求描述" });
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("button", { name: "AI 需求分析：AI 编辑后的需求" })).toBeFocused();
});

test("submits a requirement snapshot, continues its conversation and replays a lost receipt with the same key", async ({ page }, testInfo) => {
  const mock = await mockAutora(page, "analysis", true);
  await openApp(page);
  const dialog = await openAi(page);
  await expect(dialog.getByRole("button", { name: "发送分析" })).toBeEnabled();
  await dialog.getByRole("button", { name: "发送分析" }).click();
  await expect(dialog.getByText("分析已完成", { exact: true })).toBeVisible();
  await expect(dialog.getByText(/测试分析报告/)).toContainText("<script>unsafe()</script>");
  await expect(dialog.locator("script")).toHaveCount(0);
  const initialRequests = mock.requests.filter((request) => request.path.endsWith("/turns"));
  expect(initialRequests).toHaveLength(2);
  expect(initialRequests[0].key).toBe(initialRequests[1].key);
  expect(mock.turns.size).toBe(1);
  await dialog.getByLabel("发送给 AI").fill("请进一步说明验收条件");
  await dialog.getByRole("button", { name: "发送分析" }).click();
  await expect(dialog.getByText("分析已完成", { exact: true })).toHaveCount(2);
  expect(mock.requests.filter((request) => request.path === "/requirements")).toHaveLength(1);
  expect(mock.requests.filter((request) => request.path === "/conversations")).toHaveLength(1);
  await page.screenshot({ path: testInfo.outputPath("ai-dialog-mocked-analysis.png") });
  await dialog.getByRole("button", { name: "关闭 AI 需求分析" }).click();
  await page.getByRole("button", { name: `AI 需求分析：${taskTitle}`, exact: true }).click();
  await expect(dialog.getByText("分析已完成", { exact: true })).toHaveCount(2);
  await dialog.getByLabel("需求描述").fill("修改需求后重新分析");
  await dialog.getByLabel("发送给 AI").fill("分析这个新版本");
  await dialog.getByRole("button", { name: "发送分析" }).click();
  await expect(dialog.getByText("分析已完成", { exact: true })).toHaveCount(1);
  expect(mock.requests.filter((request) => request.path === "/requirements")).toHaveLength(2);
});

test("shows observe mode honestly and cancels the queued analysis", async ({ page }) => {
  const mock = await mockAutora(page, "observe");
  await openApp(page);
  const dialog = await openAi(page);
  await expect(dialog.getByText(/真实模型分析尚未启用/)).toBeVisible();
  await expect(dialog.getByRole("button", { name: "发送分析" })).toBeEnabled();
  await dialog.getByRole("button", { name: "发送分析" }).click();
  await expect(dialog.getByRole("button", { name: "取消分析" })).toBeVisible();
  await expect(dialog.getByText(/请求已接收，尚未调用模型/)).toBeVisible();
  await expect(dialog.getByLabel("需求描述")).toBeDisabled();
  await dialog.getByRole("button", { name: "取消分析" }).click();
  await expect(dialog.getByText("本轮分析已取消")).toBeVisible();
  expect(mock.turns.get("turn-1")?.state).toBe("cancelled");
  await dialog.getByRole("button", { name: "新建会话" }).click();
  await expect(dialog.getByRole("log")).not.toContainText("本轮分析已取消");
});

test("reports a disconnected local service and prevents analysis submission", async ({ page }) => {
  await page.route("**/__autora/api/v1/**", (route) => route.fulfill({ status: 503, json: { error: { code: "autora_unavailable" } } }));
  await openApp(page);
  const dialog = await openAi(page);
  await expect(dialog.getByRole("alert")).toContainText("无法连接本机 AutoRA");
  await expect(dialog.getByRole("button", { name: "发送分析" })).toBeDisabled();
  await expect(dialog.getByRole("button", { name: "刷新 AutoRA 连接" })).toBeEnabled();
});

test("connects to the real local AutoRA, submits and cancels an observe turn", async ({ page }, testInfo) => {
  test.skip(process.env.TM_AUTORA_LIVE !== "1", "Enable the real local service check explicitly");
  await openApp(page);
  const dialog = await openAi(page);
  await expect(dialog.getByText("AutoRA 已连接 · 本机测试")).toBeVisible();
  await expect(dialog.getByRole("combobox", { name: "项目目录绑定" })).not.toHaveValue("");
  await expect(dialog.getByText(/已检查 \d+ 个上下文文件/)).toBeVisible();
  await expect(dialog.getByText(/真实模型分析尚未启用/)).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("ai-dialog-local-autora.png") });
  await dialog.getByRole("button", { name: "发送分析" }).click();
  await expect(dialog.getByText(/请求已接收，尚未调用模型/)).toBeVisible();
  await dialog.getByRole("button", { name: "取消分析" }).click();
  await expect(dialog.getByText("本轮分析已取消")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("ai-dialog-local-cancelled.png") });
  await dialog.getByRole("button", { name: "关闭 AI 需求分析" }).click();
  await page.screenshot({ path: testInfo.outputPath("task-stage-ai-entry.png") });
});

test("requires readable code context and retries its inspection after refresh", async ({ page }) => {
  await mockAutora(page);
  let unavailable = true;
  await page.route("**/__autora/api/v1/bindings/*/context", async (route) => {
    if (unavailable) await route.fulfill({ status: 409, json: { error: { code: "path_unavailable" } } });
    else await route.fallback();
  });
  await openApp(page);
  const dialog = await openAi(page);
  await expect(dialog.getByText("读取范围检查失败", { exact: false })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "发送分析" })).toBeDisabled();
  unavailable = false;
  await dialog.getByRole("button", { name: "刷新 AutoRA 连接" }).click();
  await expect(dialog.getByText(/已检查 1 个上下文文件/)).toBeVisible();
  await expect(dialog.getByRole("button", { name: "发送分析" })).toBeEnabled();
});

test("restores an uncertain submission and retries its original request after reopening", async ({ page }) => {
  const mock = await mockAutora(page);
  const keys: string[] = [];
  let failures = 2;
  await page.route("**/__autora/api/v1/conversations/*/turns", async (route) => {
    keys.push(route.request().headers()["idempotency-key"]);
    if (failures-- > 0) await route.abort("failed");
    else await route.fallback();
  });
  await openApp(page);
  const dialog = await openAi(page);
  await expect(dialog.getByRole("button", { name: "发送分析" })).toBeEnabled();
  await dialog.getByRole("button", { name: "发送分析" }).click();
  await expect(dialog.getByRole("button", { name: "重试提交" })).toBeEnabled();
  await expect(dialog.getByLabel("需求描述")).toBeDisabled();
  await dialog.getByRole("button", { name: "关闭 AI 需求分析" }).click();
  await page.getByRole("button", { name: `AI 需求分析：${taskTitle}`, exact: true }).click();
  await expect(dialog.getByRole("button", { name: "重试提交" })).toBeEnabled();
  await dialog.getByRole("button", { name: "重试提交" }).click();
  await expect(dialog.getByText("分析已完成", { exact: true })).toBeVisible();
  expect(keys).toHaveLength(3);
  expect(new Set(keys).size).toBe(1);
  expect(mock.turns.size).toBe(1);
});
