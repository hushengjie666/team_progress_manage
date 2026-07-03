import { Clock3, Focus, FolderKanban, Keyboard, LayoutDashboard, ListChecks, Plus, Search, Settings, UserCheck, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { CommandAction, ParsedQuickInput, Task } from "../types";
import { commandPaletteEnterTarget, commandPaletteMatches } from "./commandPaletteModel";

export { commandPaletteEnterTarget, commandPaletteMatches } from "./commandPaletteModel";

export function CommandPalette(props: {
  open: boolean;
  onClose: () => void;
  tasks: Task[];
  onRun: (action: CommandAction, parsed?: ParsedQuickInput, taskId?: string) => void;
}) {
  const [query, setQuery] = useState("");
  const matches = useMemo(() => commandPaletteMatches(query, props.tasks), [query, props.tasks]);
  const { parsed, filtered, matchedTasks } = matches;
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
              if (event.key === "Enter") {
                const target = commandPaletteEnterTarget(matches);
                if (!target) return;
                props.onRun(target.action, target.parsed, target.taskId);
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
  if (action === "navigate_settings") return <FolderKanban size={17} />;
  if (action === "open_sync_settings") return <Settings size={17} />;
  if (action === "open_shortcut_help") return <Keyboard size={17} />;
  return <Clock3 size={17} />;
}
