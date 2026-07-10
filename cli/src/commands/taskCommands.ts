import type { Command } from "commander/esm.mjs";
import type { Priority, RepeatRule, Severity, TaskStage, TaskStatus } from "../../../src/types.js";
import {
  addDataOption,
  enumValue,
  integerValue,
  numberValue,
  parseData,
  resolveMemberId,
  resolveProjectId,
  resolveTaskId,
  splitList,
  type CliRuntime,
} from "../commandSupport.js";
import type { TimeManageClient } from "../client.js";

const statuses = new Set<TaskStatus>(["pool", "committed", "in_progress", "pending_review", "completed", "split", "archived"]);
const priorities = ["low", "medium", "high", "urgent"] as const satisfies readonly Priority[];
const severities = ["low", "medium", "high", "very_high"] as const satisfies readonly Severity[];
const stages = [
  "planning", "execution", "check", "sales", "requirements", "design", "development", "testing", "deployment", "acceptance",
] as const satisfies readonly TaskStage[];
const repeatRules = ["none", "daily", "weekly", "interval", "weekdays", "monthly", "after_completion"] as const satisfies readonly RepeatRule[];

const taskStatus = (value: string) => {
  if (!statuses.has(value as TaskStatus)) throw new Error(`Invalid task status: ${value}`);
  return value as TaskStatus;
};

export function registerTaskCommands(program: Command, runtime: CliRuntime) {
  const task = program.command("task").description("任务操作");
  task.command("list")
    .option("--project <project>")
    .option("--status <status>")
    .option("--assignee <member>")
    .option("--query <query>")
    .option("--include-archived")
    .option("--include-split")
    .action(async (options) => {
      const client = runtime.client();
      const projectId = options.project ? await resolveProjectId(client, options.project) : undefined;
      runtime.output(await client.listTasks({
        projectId,
        status: options.status ? (options.status === "all" ? "all" : taskStatus(options.status)) : undefined,
        assigneeMemberId: options.assignee ? await resolveMemberId(client, options.assignee, projectId) : undefined,
        query: options.query,
        includeArchived: Boolean(options.includeArchived),
        includeSplit: Boolean(options.includeSplit),
      }));
    });
  task.command("show <task>").action(async (taskRef) => {
    const client = runtime.client();
    runtime.output(await client.getTask(await resolveTaskId(client, taskRef)));
  });
  task.command("create <project>")
    .requiredOption("--title <title>")
    .option("--notes <notes>")
    .option("--tags <tags>")
    .option("--priority <priority>")
    .option("--severity <severity>")
    .option("--stage <stage>")
    .option("--estimate-hours <hours>")
    .option("--estimate-pomodoros <count>")
    .option("--executor <member>")
    .option("--collaborators <members>")
    .option("--expected-start <iso>")
    .option("--expected-finish <iso>")
    .option("--due <iso>")
    .option("--reminder <iso>")
    .option("--repeat <rule>")
    .option("--repeat-interval-days <days>")
    .option("--subtasks <titles>")
    .action(async (projectRef, options) => {
      const client = runtime.client();
      const projectId = await resolveProjectId(client, projectRef);
      runtime.output(await client.createTask({
        projectId,
        title: options.title,
        notes: options.notes,
        tags: options.tags ? splitList(options.tags) : undefined,
        priority: options.priority ? enumValue(options.priority, "priority", priorities) : undefined,
        severity: options.severity ? enumValue(options.severity, "severity", severities) : undefined,
        stage: options.stage ? enumValue(options.stage, "stage", stages) : undefined,
        estimateHours: options.estimateHours === undefined ? undefined : numberValue(options.estimateHours, "estimate-hours", 0),
        estimatePomodoros: options.estimatePomodoros === undefined ? undefined : integerValue(options.estimatePomodoros, "estimate-pomodoros", 1),
        primaryExecutorMemberId: options.executor ? await resolveMemberId(client, options.executor, projectId) : undefined,
        collaboratorMemberIds: options.collaborators
          ? await Promise.all(splitList(options.collaborators).map((ref) => resolveMemberId(client, ref, projectId)))
          : undefined,
        expectedStartAt: options.expectedStart,
        expectedFinishAt: options.expectedFinish,
        dueAt: options.due,
        reminderAt: options.reminder,
        repeatRule: options.repeat ? enumValue(options.repeat, "repeat", repeatRules) : undefined,
        repeatIntervalDays: options.repeatIntervalDays === undefined ? undefined : integerValue(options.repeatIntervalDays, "repeat-interval-days", 1),
        subtasks: options.subtasks ? splitList(options.subtasks) : undefined,
      }));
    });
  addDataOption(task.command("create-batch").argument("<project>"))
    .action(async (projectRef, options) => {
      const client = runtime.client();
      runtime.output(await client.batchCreateTasks(
        await resolveProjectId(client, projectRef),
        parseData<Parameters<TimeManageClient["batchCreateTasks"]>[1]>(options.data),
      ));
    });
  addDataOption(task.command("update").argument("<task>"))
    .action(async (taskRef, options) => {
      const client = runtime.client();
      runtime.output(await client.updateTask(
        await resolveTaskId(client, taskRef),
        parseData<Parameters<TimeManageClient["updateTask"]>[1]>(options.data),
      ));
    });
  task.command("delete <task>").requiredOption("--yes", "确认删除").action(async (taskRef) => {
    const client = runtime.client();
    runtime.output(await client.deleteTask(await resolveTaskId(client, taskRef), true));
  });
  addDataOption(task.command("assign").argument("<task>"))
    .action(async (taskRef, options) => {
      const client = runtime.client();
      runtime.output(await client.assignTask(
        await resolveTaskId(client, taskRef),
        parseData<Parameters<TimeManageClient["assignTask"]>[1]>(options.data),
      ));
    });
  addDataOption(task.command("assign-batch").requiredOption("--tasks <tasks>", "逗号分隔的任务引用"))
    .action(async (options) => {
      const client = runtime.client();
      const taskIds = await Promise.all(splitList(options.tasks).map((ref) => resolveTaskId(client, ref)));
      runtime.output(await client.batchAssignTasks(
        taskIds,
        parseData<Parameters<TimeManageClient["batchAssignTasks"]>[1]>(options.data),
      ));
    });
  task.command("status <task> <status>").option("--yes", "确认终态操作").action(async (taskRef, status, options) => {
    const client = runtime.client();
    runtime.output(await client.setTaskStatus(await resolveTaskId(client, taskRef), taskStatus(status), Boolean(options.yes)));
  });
  task.command("progress <task> <percent>").option("--note <note>").action(async (taskRef, percent, options) => {
    const client = runtime.client();
    runtime.output(await client.updateTaskProgress(
      await resolveTaskId(client, taskRef),
      numberValue(percent, "percent", 0, 100),
      options.note,
    ));
  });
  task.command("split <task>")
    .requiredOption("--data <json-or-file>", "子任务标题 JSON 数组或 @path.json")
    .requiredOption("--yes", "确认拆分")
    .action(async (taskRef, options) => {
      const client = runtime.client();
      runtime.output(await client.splitTask(
        await resolveTaskId(client, taskRef),
        parseData<string[]>(options.data),
        true,
      ));
    });
}
