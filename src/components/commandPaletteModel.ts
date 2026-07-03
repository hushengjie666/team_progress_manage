import { parseQuickInput } from "../planning";
import type { CommandAction, ParsedQuickInput, Task } from "../types";

type CommandItem = {
  action: CommandAction;
  label: string;
  hint: string;
};

type CommandPaletteMatches = {
  keyword: string;
  parsed: ParsedQuickInput;
  filtered: CommandItem[];
  matchedTasks: Task[];
  showQuickCreate: boolean;
};

type CommandPaletteRunTarget = {
  action: CommandAction;
  parsed?: ParsedQuickInput;
  taskId?: string;
};

const baseCommands: CommandItem[] = [
  { action: "navigate_settings", label: "打开管理中心", hint: "管理项目成员、计时偏好、备份和系统能力" },
  { action: "navigate_workspace", label: "打开项目总览", hint: "查看项目进度、执行中任务和风险" },
  { action: "navigate_focus", label: "打开我的任务", hint: "查看分配给我的任务并开始工作" },
  { action: "navigate_calendar", label: "打开历史日报", hint: "查看历史计划、番茄记录和回顾" },
  { action: "navigate_daily", label: "打开每日总结", hint: "填写日终回顾、阻碍和明日注意事项" },
  { action: "navigate_reports", label: "打开洞察", hint: "查看项目与执行趋势" },
  { action: "start_focus", label: "开始工作", hint: "从工作队列启动一段工作会话" },
  { action: "toggle_timer", label: "暂停/继续计时", hint: "控制当前计时器" },
  { action: "record_internal_interruption", label: "记录内部中断", hint: "把突然想做的事先记下来" },
  { action: "record_external_interruption", label: "记录外部中断", hint: "把消息/请求放进中断收件箱" },
  { action: "open_sync_settings", label: "打开团队后台", hint: "检查服务器、登录、诊断和立即同步" },
  { action: "open_shortcut_help", label: "快捷键说明", hint: "查看高频场景下的键盘命令" },
];

export const commandPaletteMatches = (query: string, tasks: Task[]): CommandPaletteMatches => {
  const parsed = parseQuickInput(query);
  const keyword = query.trim().toLowerCase();
  const filtered = baseCommands.filter((item) => `${item.label} ${item.hint}`.toLowerCase().includes(keyword));
  const matchedTasks = keyword
    ? tasks.filter((task) => {
        const keywords = `${task.title} ${task.notes} ${task.project} ${task.tags.join(" ")}`.toLowerCase();
        return keywords.includes(keyword);
      })
    : [];
  return {
    keyword,
    parsed,
    filtered,
    matchedTasks,
    showQuickCreate: Boolean(query.trim() && parsed.title.trim()),
  };
};

export const commandPaletteEnterTarget = (matches: CommandPaletteMatches): CommandPaletteRunTarget | undefined => {
  if (!matches.keyword) return undefined;
  const command = matches.filtered[0];
  if (command) return { action: command.action };
  const task = matches.matchedTasks[0];
  if (task) return { action: "open_task", taskId: task.id };
  if (matches.showQuickCreate) return { action: "add_quick_task", parsed: matches.parsed };
  return undefined;
};
