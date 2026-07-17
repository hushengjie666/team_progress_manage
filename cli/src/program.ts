import { Command } from "commander/esm.mjs";
import { TimeManageClient } from "./client.js";
import { writeResult, type CliRuntime } from "./commandSupport.js";
import { loadConfig } from "./config.js";
import { registerAccountWorkspaceCommands } from "./commands/accountWorkspaceCommands.js";
import { registerProjectCommands } from "./commands/projectCommands.js";
import { registerReviewConfigCommands } from "./commands/reviewConfigCommands.js";
import { registerTaskCommands } from "./commands/taskCommands.js";
import { registerWorkflowCommands } from "./commands/workflowCommands.js";

export type CliProgramOptions = {
  client?: TimeManageClient;
  env?: NodeJS.ProcessEnv;
  write?: (text: string) => void;
};

export function createCliProgram(options: CliProgramOptions = {}) {
  const program = new Command();
  program
    .name("timemanage")
    .description("TimeManage CLI：一次命令一次连接，不启动常驻服务。")
    .version("0.2.4")
    .option("--config <path>", "配置文件路径")
    .option("--server-url <url>", "覆盖服务器地址")
    .option("--email <account>", "覆盖登录账号")
    .option("--password <password>", "覆盖登录密码")
    .option("--device-id <id>", "覆盖设备 ID")
    .option("--json", "输出完整 JSON")
    .showHelpAfterError();

  let client = options.client;
  const runtime: CliRuntime = {
    client: () => {
      if (client) return client;
      const flags = program.opts();
      const env = { ...(options.env ?? process.env) };
      const overrides: Array<[string, string]> = [
        ["config", "TM_CLI_CONFIG"],
        ["serverUrl", "TM_CLI_SERVER_URL"],
        ["email", "TM_CLI_EMAIL"],
        ["password", "TM_CLI_PASSWORD"],
        ["deviceId", "TM_CLI_DEVICE_ID"],
      ];
      for (const [flag, envName] of overrides) {
        if (typeof flags[flag] === "string") env[envName] = flags[flag];
      }
      client = new TimeManageClient(loadConfig(env));
      return client;
    },
    output: (value) => writeResult(options.write ?? ((text) => process.stdout.write(text)), value, Boolean(program.opts().json)),
  };

  program.command("doctor").description("检查后台连接和数据概况").action(async () => runtime.output(await runtime.client().getBackendDiagnostics()));
  program.command("health").description("检查后台健康状态").action(async () => runtime.output(await runtime.client().health()));
  program.command("search <query>").description("搜索项目、成员和任务").action(async (query) => runtime.output(await runtime.client().search(query)));

  registerAccountWorkspaceCommands(program, runtime);
  registerProjectCommands(program, runtime);
  registerTaskCommands(program, runtime);
  registerWorkflowCommands(program, runtime);
  registerReviewConfigCommands(program, runtime);
  return program;
}
