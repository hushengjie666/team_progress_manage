import { BarChart3, CalendarDays, Clock3, Focus, FolderKanban, Keyboard, LayoutDashboard, ListChecks, Plus, Search, Settings, UserCheck, X } from "lucide-react";
import { useMemo, useState } from "react";
import { parseQuickInput } from "../planning";
import type { CommandAction, ParsedQuickInput, Task } from "../types";

type CommandItem = {
  action: CommandAction;
  label: string;
  hint: string;
};

const baseCommands: CommandItem[] = [
  { action: "navigate_settings", label: "打开项目", hint: "管理项目、成员和同步设置" },
  { action: "navigate_workspace", label: "打开进度看板", hint: "查看项目进度、执行中任务和风险" },
  { action: "navigate_focus", label: "打开我的工作台", hint: "查看分配给我的任务并开始工作" },
  { action: "navigate_calendar", label: "打开排期", hint: "查看长期计划和模板" },
  { action: "navigate_reports", label: "打开洞察", hint: "查看项目与执行趋势" },
  { action: "start_focus", label: "开始工作", hint: "从工作队列启动一段工作会话" },
  { action: "toggle_timer", label: "暂停/继续计时", hint: "控制当前计时器" },
  { action: "record_internal_interruption", label: "记录内部中断", hint: "把突然想做的事先记下来" },
  { action: "record_external_interruption", label: "记录外部中断", hint: "把消息/请求放进中断收件箱" },
  { action: "open_sync_settings", label: "同步设置", hint: "检查服务器、登录和立即同步" },
  { action: "open_shortcut_help", label: "快捷键说明", hint: "查看高频场景下的键盘命令" },
];

export function CommandPalette(props: {
  open: boolean;
  onClose: () => void;
  tasks: Task[];
  onRun: (action: CommandAction, parsed?: ParsedQuickInput, taskId?: string) => void;
}) {
  const [query, setQuery] = useState("");
  const parsed = useMemo(() => parseQuickInput(query), [query]);
  const keyword = query.trim().toLowerCase();
  const filtered = baseCommands.filter((item) => `${item.label} ${item.hint}`.toLowerCase().includes(keyword));
  const matchedTasks = keyword
    ? props.tasks.filter((task) => {
        const keywords = `${task.title} ${task.notes} ${task.project} ${task.tags.join(" ")}`.toLowerCase();
        return keywords.includes(keyword);
      })
    : [];
  const showQuickCreate = query.trim() && parsed.title.trim();
  if (!props.open) return null;

  return (
    <div className="modal-backdrop command-backdrop" role="presentation">
      <section className="command-panel" role="dialog" aria-modal="true" aria-label="命令面板">
        <div className="command-search">
          <Search size={18} />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") props.onClose();
              if (event.key === "Enter" && showQuickCreate) {
                props.onRun("add_quick_task", parsed);
                setQuery("");
              }
            }}
            placeholder="搜索命令，或输入：明天10点 写周报 #工作 2p"
          />
          <button className="icon-button small" onClick={props.onClose} title="关闭">
            <X size={16} />
          </button>
        </div>
        {query.trim() && (
          <button className="command-create" onClick={() => props.onRun("add_quick_task", parsed)}>
            <Plus size={17} />
            <div>
              <strong>创建任务：{parsed.title}</strong>
              <span>
                {parsed.estimatePomodoros} 番茄{parsed.dueAt ? ` · ${new Date(parsed.dueAt).toLocaleString()}` : ""}{parsed.tags.length ? ` · #${parsed.tags.join(" #")}` : ""}
              </span>
            </div>
          </button>
        )}
        <div className="command-list">
          {filtered.map((item) => (
            <button className="command-item" key={item.action} onClick={() => props.onRun(item.action)}>
              <CommandIcon action={item.action} />
              <div>
                <strong>{item.label}</strong>
                <span>{item.hint}</span>
              </div>
            </button>
          ))}
        </div>
        {matchedTasks.length > 0 && (
          <div className="command-section">
            <div className="command-subtitle">匹配任务</div>
            <div className="command-list">
              {matchedTasks.slice(0, 8).map((task) => (
                <button
                  className="command-item"
                  key={task.id}
                  onClick={() => {
                    props.onRun("open_task", undefined, task.id);
                    setQuery("");
                  }}
                >
                  <ListChecks size={17} />
                  <div>
                    <strong>{task.title}</strong>
                    <span>
                      {task.project} · {task.estimatePomodoros} 番茄
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function CommandIcon({ action }: { action: CommandAction }) {
  if (action === "navigate_workspace") return <LayoutDashboard size={17} />;
  if (action === "open_task") return <ListChecks size={17} />;
  if (action === "navigate_focus") return <UserCheck size={17} />;
  if (action === "start_focus" || action === "toggle_timer") return <Focus size={17} />;
  if (action === "navigate_calendar") return <CalendarDays size={17} />;
  if (action === "navigate_reports") return <BarChart3 size={17} />;
  if (action === "navigate_settings") return <FolderKanban size={17} />;
  if (action === "open_sync_settings") return <Settings size={17} />;
  if (action === "open_shortcut_help") return <Keyboard size={17} />;
  return <Clock3 size={17} />;
}
