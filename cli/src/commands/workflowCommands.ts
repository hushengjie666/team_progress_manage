import type { Command } from "commander/esm.mjs";
import {
  addDataOption,
  parseData,
  resolveProjectId,
  resolveTaskId,
  type CliRuntime,
} from "../commandSupport.js";
import type { TimeManageClient } from "../client.js";

export function registerWorkflowCommands(program: Command, runtime: CliRuntime) {
  const plan = program.command("plan").description("计划和队列");
  plan.command("show").option("--date <date>").action(async (options) =>
    runtime.output(await runtime.client().getTodayPlan(options.date)));
  plan.command("workbench").option("--project <project>").option("--date <date>").action(async (options) => {
    const client = runtime.client();
    runtime.output(await client.getTodayWorkbench(
      options.project ? await resolveProjectId(client, options.project) : undefined,
      options.date,
    ));
  });
  plan.command("add <task>").action(async (taskRef) => {
    const client = runtime.client();
    runtime.output(await client.addTaskToToday(await resolveTaskId(client, taskRef)));
  });
  plan.command("add-batch <tasks...>").action(async (taskRefs) => {
    const client = runtime.client();
    runtime.output(await client.batchAddTasksToToday(await Promise.all(taskRefs.map((ref: string) => resolveTaskId(client, ref)))));
  });
  plan.command("remove <task>").action(async (taskRef) => {
    const client = runtime.client();
    runtime.output(await client.removeTaskFromToday(await resolveTaskId(client, taskRef)));
  });
  plan.command("move <task> <direction>").action(async (taskRef, direction) => {
    if (direction !== "up" && direction !== "down") throw new Error("direction must be up or down.");
    const client = runtime.client();
    runtime.output(await client.moveTodayTask(await resolveTaskId(client, taskRef), direction === "up" ? -1 : 1));
  });
  plan.command("schedule <task> <date>").action(async (taskRef, date) => {
    const client = runtime.client();
    runtime.output(await client.scheduleTaskForDate(await resolveTaskId(client, taskRef), date));
  });

  const work = program.command("work").description("执行状态");
  work.command("active").option("--project <project>").action(async (options) => {
    const client = runtime.client();
    runtime.output(await client.getActiveWork(options.project ? await resolveProjectId(client, options.project) : undefined));
  });
  work.command("start <task>").action(async (taskRef) => {
    const client = runtime.client();
    runtime.output(await client.startTask(await resolveTaskId(client, taskRef)));
  });
  addDataOption(work.command("pause"))
    .action(async (options) => runtime.output(await runtime.client().pauseWorkSession(
      parseData<Parameters<TimeManageClient["pauseWorkSession"]>[0]>(options.data),
    )));
  addDataOption(work.command("resume"))
    .action(async (options) => runtime.output(await runtime.client().resumeWorkSession(
      parseData<Parameters<TimeManageClient["resumeWorkSession"]>[0]>(options.data),
    )));
  addDataOption(work.command("finish"))
    .action(async (options) => runtime.output(await runtime.client().finishWorkSession(
      parseData<Parameters<TimeManageClient["finishWorkSession"]>[0]>(options.data),
    )));
  addDataOption(work.command("interrupt"))
    .action(async (options) => runtime.output(await runtime.client().recordInterruption(
      parseData<Parameters<TimeManageClient["recordInterruption"]>[0]>(options.data),
    )));
}
