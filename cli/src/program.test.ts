import { describe, expect, it } from "vitest";
import type { Command } from "commander/esm.mjs";
import { cliCapabilityCommands } from "./capabilities";
import type { TimeManageClient } from "./client";
import { createCliProgram } from "./program";

const commandPaths = (command: Command, prefix = ""): string[] =>
  command.commands.flatMap((child) => {
    const path = [prefix, child.name()].filter(Boolean).join(" ");
    return [path, ...commandPaths(child, path)];
  });

const overrideExits = (command: Command) => {
  command.configureOutput({ writeErr: () => undefined });
  command.exitOverride();
  command.commands.forEach(overrideExits);
};

const fakeClient = () => {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  const results: Record<string, unknown> = {
    listProjects: [{ id: "project_alpha", name: "Alpha" }],
    listTasks: [{ id: "task_alpha", title: "Task Alpha", projectId: "project_alpha" }],
    listMembers: [{ id: "member_alpha", name: "Member Alpha" }],
    listPlatformAccounts: [{ id: "account_alpha", name: "Account Alpha", email: "alpha@example.com" }],
    listTaskTemplates: [{ id: "template_alpha", name: "Template Alpha" }],
    listWorkspaces: {
      workspaces: [
        { id: "workspace_alpha", name: "Workspace Alpha" },
        { id: "workspace_beta", name: "Workspace Beta" },
      ],
      memberships: [
        { id: "membership_alpha", workspaceId: "workspace_alpha", name: "Shared Member", email: "shared-alpha@example.com" },
        { id: "membership_beta", workspaceId: "workspace_beta", name: "Shared Member", email: "shared-beta@example.com" },
      ],
    },
  };
  const client = new Proxy({}, {
    get: (_target, property) => async (...args: unknown[]) => {
      const method = String(property);
      calls.push({ method, args });
      return results[method] ?? { id: "result", method };
    },
  }) as TimeManageClient;
  return { client, calls };
};

const run = async (args: string[]) => {
  const fake = fakeClient();
  const output: string[] = [];
  const program = createCliProgram({ client: fake.client, write: (text) => output.push(text) });
  program.exitOverride();
  await program.parseAsync(["node", "timemanage", ...args]);
  return { ...fake, output };
};

describe("TimeManage CLI program", () => {
  it("registers a real command path for every public client capability", () => {
    const paths = new Set(commandPaths(createCliProgram({ client: fakeClient().client })));
    for (const path of Object.values(cliCapabilityCommands)) expect(paths.has(path), path).toBe(true);
  });

  it("resolves project references before showing a project", async () => {
    const result = await run(["--json", "project", "show", "Alpha"]);
    expect(result.calls.map((call) => call.method)).toEqual(["listProjects", "getProjectOverview"]);
    expect(result.calls[1].args).toEqual(["project_alpha"]);
  });

  it("parses structured workspace updates", async () => {
    const result = await run(["workspace", "update", "Workspace Alpha", "--data", "{\"name\":\"Updated\",\"type\":\"shared\"}"]);
    expect(result.calls.at(-1)).toEqual({
      method: "updateWorkspace",
      args: ["workspace_alpha", { name: "Updated", type: "shared" }],
    });
  });

  it("resolves workspace memberships within the selected workspace", async () => {
    const result = await run([
      "workspace", "member", "update", "Workspace Alpha", "Shared Member", "--data", "{\"role\":\"admin\"}",
    ]);
    expect(result.calls.at(-1)).toEqual({
      method: "updateWorkspaceMembership",
      args: ["workspace_alpha", "membership_alpha", { role: "admin" }],
    });
  });

  it("resolves task references and validates progress", async () => {
    const result = await run(["task", "progress", "Task Alpha", "75", "--note", "done"]);
    expect(result.calls.at(-1)).toEqual({ method: "updateTaskProgress", args: ["task_alpha", 75, "done"] });
  });

  it("rejects invalid task enum values before mutation", async () => {
    await expect(run(["task", "create", "Alpha", "--title", "Invalid", "--priority", "critical"]))
      .rejects.toThrow(/priority must be one of/i);
  });

  it("dispatches workflow and settings command groups", async () => {
    const planResult = await run(["plan", "add-batch", "Task Alpha"]);
    expect(planResult.calls.at(-1)).toEqual({ method: "batchAddTasksToToday", args: [["task_alpha"]] });

    const settingsResult = await run(["settings", "update", "--data", "{\"focusMinutes\":30}"]);
    expect(settingsResult.calls.at(-1)).toEqual({ method: "updateSettings", args: [{ focusMinutes: 30 }] });
  });

  it("requires confirmation flags before destructive commands", async () => {
    const fake = fakeClient();
    const program = createCliProgram({ client: fake.client });
    overrideExits(program);
    await expect(program.parseAsync(["node", "timemanage", "project", "archive", "Alpha"]))
      .rejects.toThrow(/required option '--yes'/i);
    expect(fake.calls).toHaveLength(0);
  });
});
