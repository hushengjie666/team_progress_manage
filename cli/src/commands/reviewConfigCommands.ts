import type { Command } from "commander/esm.mjs";
import {
  addDataOption,
  parseData,
  resolveProjectId,
  resolveTaskId,
  resolveTemplateId,
  type CliRuntime,
} from "../commandSupport.js";
import type { TimeManageClient } from "../client.js";

export function registerReviewConfigCommands(program: Command, runtime: CliRuntime) {
  const review = program.command("review").description("任务验收");
  review.command("submit <task>").action(async (taskRef) => {
    const client = runtime.client();
    runtime.output(await client.submitTaskReview(await resolveTaskId(client, taskRef)));
  });
  review.command("accept <task>").requiredOption("--yes", "确认接受验收").action(async (taskRef) => {
    const client = runtime.client();
    runtime.output(await client.acceptTaskReview(await resolveTaskId(client, taskRef), true));
  });
  review.command("return <task>").requiredOption("--reason <reason>").action(async (taskRef, options) => {
    const client = runtime.client();
    runtime.output(await client.returnTaskReview(await resolveTaskId(client, taskRef), options.reason));
  });
  review.command("pending").option("--project <project>").action(async (options) => {
    const client = runtime.client();
    runtime.output(await client.listPendingReviews(options.project ? await resolveProjectId(client, options.project) : undefined));
  });

  program.command("member").command("status")
    .option("--project <project>")
    .option("--date <date>")
    .action(async (options) => {
      const client = runtime.client();
      runtime.output(await client.getMemberStatus(
        options.project ? await resolveProjectId(client, options.project) : undefined,
        options.date,
      ));
    });

  const daily = program.command("daily").description("日报和复盘");
  daily.command("summary").option("--date <date>").action(async (options) =>
    runtime.output(await runtime.client().getDailySummary(options.date)));
  addDataOption(daily.command("review"))
    .action(async (options) => runtime.output(await runtime.client().updateDailyReview(
      parseData<Parameters<TimeManageClient["updateDailyReview"]>[0]>(options.data),
    )));

  const settings = program.command("settings").description("应用设置");
  settings.command("show").action(async () => runtime.output(await runtime.client().getSettings()));
  addDataOption(settings.command("update"))
    .action(async (options) => runtime.output(await runtime.client().updateSettings(
      parseData<Parameters<TimeManageClient["updateSettings"]>[0]>(options.data),
    )));

  const template = program.command("template").description("任务模板");
  template.command("list").action(async () => runtime.output(await runtime.client().listTaskTemplates()));
  addDataOption(template.command("save"))
    .action(async (options) => runtime.output(await runtime.client().saveTaskTemplate(
      parseData<Parameters<TimeManageClient["saveTaskTemplate"]>[0]>(options.data),
    )));
  template.command("delete <template>").requiredOption("--yes", "确认删除模板").action(async (templateRef) => {
    const client = runtime.client();
    runtime.output(await client.deleteTaskTemplate(await resolveTemplateId(client, templateRef), true));
  });
  template.command("instantiate <template> <project>").action(async (templateRef, projectRef) => {
    const client = runtime.client();
    runtime.output(await client.instantiateTaskTemplate(
      await resolveTemplateId(client, templateRef),
      await resolveProjectId(client, projectRef),
    ));
  });
}
