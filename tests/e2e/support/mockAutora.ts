import type { Page } from "@playwright/test";

export async function mockAutora(page: Page, mode: "analysis" | "observe" = "analysis", loseFirstReceipt = false) {
  const requests: { path: string; body: any; key: string | undefined }[] = [];
  const turns = new Map<string, { turnId: string; state: string; report: string | null; blockedReason: string | null; reason: string | null }>();
  const receipts = new Map<string, unknown>();
  let conversationCount = 0;
  let revision = 1;
  const bindings = [
    { id: "binding-timemanage", revision: 1, workspaceId: "workspace_e2e", projectId: "project_starter", enabled: true, label: "TimeManage 本地代码", roots: [{ id: "code", label: "TimeManage", kind: "code" }] },
    { id: "binding-other", revision: 1, workspaceId: "other", projectId: "project_starter", enabled: true, label: "其他工作区目录", roots: [] },
  ];
  await page.route("**/__autora/api/v1/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace("/__autora/api/v1", "");
    const body = request.method() === "POST" ? request.postDataJSON() : undefined;
    const key = request.headers()["idempotency-key"];
    requests.push({ path, body, key });
    let result: unknown;
    if (path === "/status") result = { mode, codex: { auth: "authenticated", permissions: { code: mode === "observe" ? "permissions_unsupported" : "supported" } } };
    else if (path === "/bindings") result = { bindings };
    else if (path.endsWith("/context")) result = { files: [{ path: "src/taskTypes.ts" }], coverage: ["context_byte_limit"] };
    else if (path === "/requirements") result = { requirementSnapshotId: `snapshot-${conversationCount + 1}` };
    else if (path === "/conversations") {
      conversationCount += 1;
      result = { conversationId: `conversation-${conversationCount}`, revision: `rev-${revision}`, source: { revision: "source-1" } };
    } else if (path.endsWith("/turns")) {
      if (receipts.has(key!)) result = receipts.get(key!);
      else {
        const turnId = `turn-${turns.size + 1}`;
        turns.set(turnId, { turnId, state: mode === "observe" ? "queued" : "completed", report: mode === "observe" ? null : "测试分析报告：相关模块 src/taskTypes.ts；验收条件：点击 AI 打开需求对话。<script>unsafe()</script>", blockedReason: mode === "observe" ? "observe" : null, reason: null });
        result = { turnId, conversationRevision: `rev-${++revision}` };
        receipts.set(key!, result);
        if (loseFirstReceipt) { loseFirstReceipt = false; return route.abort("failed"); }
      }
    } else if (path.endsWith("/cancel")) {
      const turn = turns.get(path.split("/")[2])!;
      turn.state = "cancelled";
      turn.blockedReason = null;
      turn.reason = "user_cancelled";
      result = turn;
    } else if (path.startsWith("/turns/")) result = turns.get(path.split("/")[2]);
    else if (path.startsWith("/conversations/")) result = { conversationId: path.split("/")[2], revision: `rev-${revision}`, source: { revision: "source-1" } };
    else return route.fulfill({ status: 404, json: { error: { code: "not_found" } } });
    await route.fulfill({ status: 200, json: result });
  });
  return { requests, turns };
}
