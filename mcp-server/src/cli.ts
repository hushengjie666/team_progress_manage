#!/usr/bin/env node
import { defaultConfigPath, loadConfig } from "./config.js";
import { TimeManageMcpClient } from "./core.js";
import type { ProjectInput, TaskInput } from "./businessTypes.js";
import type { Priority, Severity, TaskStage, TaskStageMode, TaskStatus } from "../../src/types.js";

type FlagValue = string | true;

type ParsedCli = {
  command?: string;
  positional: string[];
  flags: Record<string, FlagValue>;
  json: boolean;
  env: NodeJS.ProcessEnv;
};

interface ProjectSummary {
  id: string;
  workspaceName?: string;
  name: string;
  description?: string;
  taskCount: number;
  memberCount: number;
  taskStageMode?: TaskStageMode;
  updatedAt?: string;
}

interface TaskSummary {
  id: string;
  title: string;
  projectId: string;
  project?: string;
  primaryExecutorName?: string;
  status: TaskStatus;
  priority?: Priority;
  stage?: TaskStage;
  progressPercent: number;
  progressNote?: string;
  dueAt?: string;
  updatedAt?: string;
}

interface TodayPlanSummary {
  date: string;
  combined?: {
    tasks: TaskSummary[];
  };
  plans: Array<{
    workspaceName?: string;
    tasks: TaskSummary[];
  }>;
}

interface ActiveWorkSummary {
  id: string;
  status: "active" | "paused";
  executorName?: string;
  task?: TaskSummary;
  startedAt: string;
  updatedAt?: string;
}

interface SearchSummary {
  projects: ProjectSummary[];
  members: Array<{ id: string; name: string; projectName?: string; email?: string }>;
  tasks: TaskSummary[];
}

interface ProjectOverviewSummary {
  project: ProjectSummary;
  statusCounts: Record<string, number>;
  progress: number;
  activeSessions: unknown[];
  riskSections: Array<{ title?: string; kind?: string; tasks: unknown[] }>;
  members: Array<{ id: string; name: string; roles?: string[] }>;
}

type CommandResult =
  | { kind: "json"; data: unknown }
  | { kind: "projects"; data: ProjectSummary[] }
  | { kind: "tasks"; data: TaskSummary[] }
  | { kind: "today"; data: TodayPlanSummary }
  | { kind: "active"; data: ActiveWorkSummary[] }
  | { kind: "search"; data: SearchSummary }
  | { kind: "overview"; data: ProjectOverviewSummary }
  | { kind: "task"; data: TaskSummary }
  | { kind: "message"; message: string; data?: unknown };

const taskStatuses = ["pool", "committed", "in_progress", "pending_review", "completed", "split", "archived"] as const satisfies readonly TaskStatus[];
const priorities = ["low", "medium", "high", "urgent"] as const satisfies readonly Priority[];
const severities = ["low", "medium", "high", "very_high"] as const satisfies readonly Severity[];
const taskStages = [
  "planning",
  "execution",
  "check",
  "sales",
  "requirements",
  "design",
  "development",
  "testing",
  "deployment",
  "acceptance",
] as const satisfies readonly TaskStage[];
const stageModes = ["regular", "software"] as const satisfies readonly TaskStageMode[];

const helpText = `TimeManage CLI：一次命令一次连接，不启动常驻 MCP 服务。

用法：
  timemanage <命令> [参数] [选项]

全局选项：
  --config <path>        配置文件，默认 ${defaultConfigPath()}
  --server-url <url>     覆盖服务器地址
  --email <account>      覆盖账号
  --password <password>  覆盖密码
  --device-id <id>       覆盖设备 ID
  --json                 输出完整 JSON

业务闭环命令：
  doctor                         检查连接
  account                        查看当前账号和工作区
  projects                       列项目
  project <项目名或ID>            看项目概览
  tasks [--project <项目名或ID>]  列任务
        [--status <状态|all>] [--query <关键字>]
  today [--date YYYY-MM-DD]      看今日/指定日期计划
  active                         看当前执行中的工作
  search <关键字>                搜索项目、成员、任务

写入命令：
  create-project --name <名称> [--description <说明>] [--mode regular|software]
  create-task --project <项目名或ID> --title <标题> [--notes <说明>]
              [--priority low|medium|high|urgent] [--due <ISO时间>]
  add-today <任务名或ID>          加入今日计划
  start <任务名或ID>              开始执行任务
  progress <任务名或ID> <0-100> [--note <说明>]
  complete <任务名或ID> --yes     标记完成，需要 --yes

例子：
  timemanage projects
  timemanage tasks --project 团队协助软件
  timemanage progress 接入表单 60 --note 已联通接口
`;

const parseCli = (argv: string[]): ParsedCli => {
  const flags: Record<string, FlagValue> = {};
  const positional: string[] = [];
  const env: NodeJS.ProcessEnv = { ...process.env };
  let command: string | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg.startsWith("--")) {
      const withoutPrefix = arg.slice(2);
      const [rawName, inlineValue] = withoutPrefix.split("=", 2);
      const next = argv[index + 1];
      const value = inlineValue ?? (next && !next.startsWith("--") ? next : true);
      if (inlineValue === undefined && value !== true) index += 1;
      flags[rawName] = value;
      continue;
    }
    if (!command) command = arg;
    else positional.push(arg);
  }

  const applyEnv = (flag: string, envName: string) => {
    const value = flags[flag];
    if (typeof value === "string") env[envName] = value;
  };
  applyEnv("config", "TM_MCP_CONFIG");
  applyEnv("server-url", "TM_MCP_SERVER_URL");
  applyEnv("email", "TM_MCP_EMAIL");
  applyEnv("password", "TM_MCP_PASSWORD");
  applyEnv("device-id", "TM_MCP_DEVICE_ID");

  return { command, positional, flags, json: flags.json === true, env };
};

const flagString = (flags: Record<string, FlagValue>, name: string) => {
  const value = flags[name];
  return typeof value === "string" ? value : undefined;
};

const hasFlag = (flags: Record<string, FlagValue>, name: string) => flags[name] === true || flags[name] === "true";

const requireFlagString = (flags: Record<string, FlagValue>, name: string) => {
  const value = flagString(flags, name);
  if (!value) throw new Error(`Missing --${name}`);
  return value;
};

const requirePositional = (parsed: ParsedCli, index: number, label: string) => {
  const value = parsed.positional[index];
  if (!value) throw new Error(`Missing ${label}`);
  return value;
};

const isTaskStatus = (value: string): value is TaskStatus => (taskStatuses as readonly string[]).includes(value);
const isPriority = (value: string): value is Priority => (priorities as readonly string[]).includes(value);
const isSeverity = (value: string): value is Severity => (severities as readonly string[]).includes(value);
const isTaskStage = (value: string): value is TaskStage => (taskStages as readonly string[]).includes(value);
const isStageMode = (value: string): value is TaskStageMode => (stageModes as readonly string[]).includes(value);

const parseTaskStatus = (value?: string): TaskStatus | "all" | undefined => {
  if (!value) return undefined;
  if (value === "all") return "all";
  if (isTaskStatus(value)) return value;
  throw new Error(`Invalid status: ${value}`);
};

const parseNumber = (value: string, label: string, min?: number, max?: number) => {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) throw new Error(`${label} must be a number.`);
  if (min !== undefined && numberValue < min) throw new Error(`${label} must be >= ${min}.`);
  if (max !== undefined && numberValue > max) throw new Error(`${label} must be <= ${max}.`);
  return numberValue;
};

const resolveProjectId = async (client: TimeManageMcpClient, projectRef?: string) => {
  if (!projectRef) return undefined;
  const projects: ProjectSummary[] = await client.listProjects();
  const exact = projects.filter((project) => project.id === projectRef || project.name === projectRef);
  if (exact.length === 1) return exact[0].id;
  if (exact.length > 1) throw new Error(`Project ref is ambiguous: ${projectRef}`);
  const fuzzy = projects.filter((project) => project.name.includes(projectRef));
  if (fuzzy.length === 1) return fuzzy[0].id;
  if (fuzzy.length > 1) throw new Error(`Project ref is ambiguous: ${projectRef}. Matches: ${fuzzy.map((project) => project.name).join(", ")}`);
  throw new Error(`Project not found: ${projectRef}`);
};

const resolveTaskId = async (client: TimeManageMcpClient, taskRef: string, projectId?: string) => {
  const tasks: TaskSummary[] = await client.listTasks({ projectId, status: "all", includeArchived: true, includeSplit: true });
  const exact = tasks.filter((task) => task.id === taskRef || task.title === taskRef);
  if (exact.length === 1) return exact[0].id;
  if (exact.length > 1) throw new Error(`Task ref is ambiguous: ${taskRef}`);
  const fuzzy = tasks.filter((task) => task.title.includes(taskRef));
  if (fuzzy.length === 1) return fuzzy[0].id;
  if (fuzzy.length > 1) throw new Error(`Task ref is ambiguous: ${taskRef}. Matches: ${fuzzy.map((task) => task.title).join(", ")}`);
  throw new Error(`Task not found: ${taskRef}`);
};

const commandResult = async (client: TimeManageMcpClient, parsed: ParsedCli): Promise<CommandResult> => {
  const command = parsed.command;
  if (!command || command === "help" || command === "--help" || command === "-h") return { kind: "message", message: helpText };

  if (command === "doctor" || command === "health") return { kind: "json", data: await client.getBackendDiagnostics() };
  if (command === "account") return { kind: "json", data: await client.getCurrentAccount() };
  if (command === "workspaces") return { kind: "json", data: await client.listWorkspaces() };
  if (command === "projects") return { kind: "projects", data: await client.listProjects() };
  if (command === "search") return { kind: "search", data: await client.search(requirePositional(parsed, 0, "query")) };
  if (command === "project") {
    const projectId = await resolveProjectId(client, requirePositional(parsed, 0, "project"));
    return { kind: "overview", data: await client.getProjectOverview(projectId) };
  }
  if (command === "tasks") {
    const projectId = await resolveProjectId(client, flagString(parsed.flags, "project"));
    const status = parseTaskStatus(flagString(parsed.flags, "status"));
    return { kind: "tasks", data: await client.listTasks({ projectId, status, query: flagString(parsed.flags, "query") }) };
  }
  if (command === "today") return { kind: "today", data: await client.getTodayPlan(flagString(parsed.flags, "date")) };
  if (command === "active") return { kind: "active", data: await client.getActiveWork() };
  if (command === "create-project") {
    const mode = flagString(parsed.flags, "mode");
    if (mode && !isStageMode(mode)) throw new Error(`Invalid mode: ${mode}`);
    const input: ProjectInput = {
      name: requireFlagString(parsed.flags, "name"),
      description: flagString(parsed.flags, "description"),
      taskStageMode: hasFlag(parsed.flags, "software") ? "software" : mode,
    };
    return { kind: "overview", data: { project: await client.createProject(input), statusCounts: {}, progress: 0, activeSessions: [], riskSections: [], members: [] } };
  }
  if (command === "create-task") {
    const priority = flagString(parsed.flags, "priority");
    const severity = flagString(parsed.flags, "severity");
    const stage = flagString(parsed.flags, "stage");
    if (priority && !isPriority(priority)) throw new Error(`Invalid priority: ${priority}`);
    if (severity && !isSeverity(severity)) throw new Error(`Invalid severity: ${severity}`);
    if (stage && !isTaskStage(stage)) throw new Error(`Invalid stage: ${stage}`);
    const input: TaskInput = {
      projectId: await resolveProjectId(client, requireFlagString(parsed.flags, "project")),
      title: requireFlagString(parsed.flags, "title"),
      notes: flagString(parsed.flags, "notes"),
      priority,
      severity,
      stage,
      dueAt: flagString(parsed.flags, "due"),
    };
    return { kind: "task", data: await client.createTask(input) };
  }
  if (command === "add-today") {
    const taskId = await resolveTaskId(client, requirePositional(parsed, 0, "task"));
    return { kind: "today", data: await client.addTaskToToday(taskId) };
  }
  if (command === "start") {
    const taskId = await resolveTaskId(client, requirePositional(parsed, 0, "task"));
    return { kind: "active", data: await client.startTask(taskId) };
  }
  if (command === "progress") {
    const taskId = await resolveTaskId(client, requirePositional(parsed, 0, "task"));
    const progressPercent = parseNumber(requirePositional(parsed, 1, "progress"), "progress", 0, 100);
    return { kind: "task", data: await client.updateTaskProgress(taskId, progressPercent, flagString(parsed.flags, "note")) };
  }
  if (command === "complete") {
    if (!hasFlag(parsed.flags, "yes")) throw new Error("complete requires --yes.");
    const taskId = await resolveTaskId(client, requirePositional(parsed, 0, "task"));
    return { kind: "task", data: await client.setTaskStatus(taskId, "completed", true) };
  }

  throw new Error(`Unknown command: ${command}`);
};

const line = (value: string) => process.stdout.write(`${value}\n`);
const writeJson = (data: unknown) => line(JSON.stringify(data, null, 2));

const taskLine = (task: TaskSummary) => {
  const owner = task.primaryExecutorName ? ` @${task.primaryExecutorName}` : "";
  const project = task.project ? ` [${task.project}]` : "";
  const due = task.dueAt ? ` due:${task.dueAt.slice(0, 10)}` : "";
  return `${task.title}${project} — ${task.status} ${task.progressPercent}%${owner}${due} (${task.id})`;
};

const printProjects = (projects: ProjectSummary[]) => {
  if (!projects.length) return line("没有项目。");
  for (const project of projects) {
    line(`${project.name} — ${project.taskCount} 个任务，${project.memberCount} 个成员，${project.workspaceName ?? "未命名工作区"} (${project.id})`);
  }
};

const printTasks = (tasks: TaskSummary[]) => {
  if (!tasks.length) return line("没有任务。");
  for (const task of tasks) line(taskLine(task));
};

const printToday = (plan: TodayPlanSummary) => {
  const tasks = plan.combined?.tasks ?? [];
  line(`${plan.date} 今日计划：${tasks.length} 个任务`);
  printTasks(tasks);
};

const printActive = (sessions: ActiveWorkSummary[]) => {
  if (!sessions.length) return line("当前没有执行中或暂停中的工作。");
  for (const session of sessions) {
    const task = session.task ? taskLine(session.task) : session.id;
    line(`${session.status} — ${task}，执行人：${session.executorName ?? "未分配"}`);
  }
};

const printSearch = (result: SearchSummary) => {
  line(`项目：${result.projects.length}`);
  printProjects(result.projects);
  line(`成员：${result.members.length}`);
  for (const member of result.members) line(`${member.name}${member.projectName ? ` [${member.projectName}]` : ""} (${member.id})`);
  line(`任务：${result.tasks.length}`);
  printTasks(result.tasks);
};

const printOverview = (overview: ProjectOverviewSummary) => {
  line(`${overview.project.name} — ${overview.project.taskCount} 个任务，${overview.project.memberCount} 个成员`);
  line(`进度：${overview.progress}%`);
  line(`状态：${Object.entries(overview.statusCounts).map(([status, count]) => `${status}:${count}`).join("，") || "无"}`);
  line(`风险分区：${overview.riskSections.length}，活跃会话：${overview.activeSessions.length}`);
};

const resultData = (result: CommandResult): unknown => {
  if (result.kind === "message") return result.data ?? result.message;
  return result.data;
};

const printResult = (result: CommandResult, json: boolean) => {
  if (json || result.kind === "json") return writeJson(resultData(result));
  if (result.kind === "message") {
    line(result.message);
    if (result.data) writeJson(result.data);
    return;
  }
  if (result.kind === "projects") return printProjects(result.data);
  if (result.kind === "tasks") return printTasks(result.data);
  if (result.kind === "today") return printToday(result.data);
  if (result.kind === "active") return printActive(result.data);
  if (result.kind === "search") return printSearch(result.data);
  if (result.kind === "overview") return printOverview(result.data);
  if (result.kind === "task") return line(taskLine(result.data));
};

const main = async () => {
  const parsed = parseCli(process.argv.slice(2));
  if (!parsed.command || parsed.command === "help" || parsed.command === "--help" || parsed.command === "-h") {
    line(helpText);
    return;
  }
  const client = new TimeManageMcpClient(loadConfig(parsed.env));
  printResult(await commandResult(client, parsed), parsed.json);
};

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
