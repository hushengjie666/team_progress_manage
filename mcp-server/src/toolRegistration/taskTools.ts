import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { TimeManageMcpClient } from "../core.js";
import { taskInputShape, taskStatusSchema } from "../schemas.js";
import { confirmedShape, registerJsonTool, taskListShape, taskUpdateShape } from "./helpers.js";

export const registerTaskTools = (server: McpServer, client: TimeManageMcpClient) => {
  registerJsonTool(server, "list_tasks", "按项目、状态、成员或关键字列出任务。", taskListShape, (input) => client.listTasks(input), true);
  registerJsonTool(server, "get_task", "读取单个任务详情。", { taskId: z.string() }, ({ taskId }) => client.getTask(taskId), true);
  registerJsonTool(server, "create_task", "创建项目任务。", { projectId: z.string(), ...taskInputShape }, (input) => client.createTask(input));
  registerJsonTool(
    server,
    "batch_create_tasks",
    "批量创建项目任务。",
    { projectId: z.string(), tasks: z.array(z.object(taskInputShape)) },
    ({ projectId, tasks }) => client.batchCreateTasks(projectId, tasks),
  );
  registerJsonTool(
    server,
    "update_task",
    "更新任务基础信息。",
    { taskId: z.string(), ...taskUpdateShape },
    ({ taskId, ...input }) => client.updateTask(taskId, input),
  );
  registerJsonTool(
    server,
    "delete_task",
    "删除任务并移出相关计划。需要 confirmed=true。",
    { taskId: z.string(), ...confirmedShape },
    ({ taskId, confirmed }) => client.deleteTask(taskId, confirmed),
  );
  registerJsonTool(
    server,
    "assign_task",
    "分配任务执行者和协作者。",
    { taskId: z.string(), projectId: z.string().optional(), primaryExecutorMemberId: z.string().optional(), collaboratorMemberIds: z.array(z.string()).optional() },
    ({ taskId, ...assignment }) => client.assignTask(taskId, assignment),
  );
  registerJsonTool(
    server,
    "batch_assign_tasks",
    "批量分配任务执行者和协作者。",
    { taskIds: z.array(z.string()), projectId: z.string().optional(), primaryExecutorMemberId: z.string().optional(), collaboratorMemberIds: z.array(z.string()).optional() },
    ({ taskIds, ...assignment }) => client.batchAssignTasks(taskIds, assignment),
  );
  registerJsonTool(
    server,
    "set_task_status",
    "设置任务状态。完成、拆分或归档需要 confirmed=true。",
    { taskId: z.string(), status: taskStatusSchema, ...confirmedShape },
    ({ taskId, status, confirmed }) => client.setTaskStatus(taskId, status, confirmed),
  );
  registerJsonTool(
    server,
    "update_task_progress",
    "更新任务进度。",
    { taskId: z.string(), progressPercent: z.number(), progressNote: z.string().optional() },
    ({ taskId, progressPercent, progressNote }) => client.updateTaskProgress(taskId, progressPercent, progressNote),
  );
  registerJsonTool(
    server,
    "split_task",
    "拆分任务。需要 confirmed=true。",
    { taskId: z.string(), childTitles: z.array(z.string()), ...confirmedShape },
    ({ taskId, childTitles, confirmed }) => client.splitTask(taskId, childTitles, confirmed),
  );
};
