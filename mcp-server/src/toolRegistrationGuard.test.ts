import { describe, expect, it } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { TimeManageMcpClient, type TimeManageMcpClient as TimeManageMcpClientType } from "./core.js";
import { registerTimeManageTools } from "./tools.js";

type RegisteredTool = {
  callback: (input: Record<string, unknown>) => Promise<CallToolResult>;
};

const registerToolsWithClient = () => {
  const tools = new Map<string, RegisteredTool>();
  const server = {
    registerTool(name: string, _config: unknown, callback: RegisteredTool["callback"]) {
      tools.set(name, { callback });
    },
  } as unknown as McpServer;
  const client = new Proxy({}, {
    get: (_target, key) => (...args: unknown[]) => Promise.resolve({ method: String(key), args }),
  }) as TimeManageMcpClientType;
  registerTimeManageTools(server, client);
  return tools;
};

describe("TimeManage MCP confirmation guardrails", () => {
  it("guards the account-disable tool before dispatch", async () => {
    const tools = registerToolsWithClient();
    const result = await tools.get("disable_platform_account")!.callback({ accountId: "account_1" });

    expect(result.isError).toBe(true);
    expect(result.content[0]?.type).toBe("text");
    expect(result.content[0]?.text).toMatch(/confirmation|confirmed|确认/i);
  });

  it("keeps destructive client methods behind explicit confirmation before network access", async () => {
    const client = new TimeManageMcpClient({
      serverUrl: "http://127.0.0.1:1",
      email: "member@example.com",
      password: "password",
      deviceId: "test_device",
    });
    const calls = [
      () => client.deleteMember("member_1"),
      () => client.unbindProjectMember("member_1"),
      () => client.archiveProject("project_1"),
      () => client.deleteTask("task_1"),
      () => client.setTaskStatus("task_1", "completed"),
      () => client.splitTask("task_1", ["一", "二"]),
      () => client.acceptTaskReview("task_1"),
      () => client.deleteTaskTemplate("template_1"),
    ];

    for (const call of calls) {
      await expect(call()).rejects.toThrow(/confirmation/i);
    }
  });
});
