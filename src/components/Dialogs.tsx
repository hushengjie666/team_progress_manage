import { X } from "lucide-react";
import type { SplitDraft } from "../appModel";

export function ConfirmDialog(props: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  danger?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!props.open) return null;
  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal-panel" role="dialog" aria-modal="true" aria-label={props.title}>
        <div className="section-title">
          <div>
            <p className="eyebrow">Confirm</p>
            <h2>{props.title}</h2>
          </div>
          <button className="icon-button small" onClick={props.onCancel} title="关闭">
            <X size={16} />
          </button>
        </div>
        <p className="muted">{props.body}</p>
        <div className="button-row modal-actions">
          <button className="secondary-button" onClick={props.onCancel}>
            取消
          </button>
          <button className={props.danger ? "primary-button danger-button" : "primary-button"} onClick={props.onConfirm}>
            {props.confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}

export function SplitTaskDialog(props: {
  draft: SplitDraft | null;
  setDraft: (draft: SplitDraft | null) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!props.draft) return null;
  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal-panel split-modal" role="dialog" aria-modal="true" aria-label="拆分任务">
        <div className="section-title">
          <div>
            <p className="eyebrow">Split Task</p>
            <h2>拆分「{props.draft.task.title}」</h2>
          </div>
          <button className="icon-button small" onClick={props.onCancel} title="关闭">
            <X size={16} />
          </button>
        </div>
        <p className="muted">每行一个子任务。确认后原任务会归档，新任务会保留项目、标签、优先级和工作队列位置。</p>
        <textarea
          value={props.draft.text}
          onChange={(event) => props.setDraft({ ...props.draft!, text: event.target.value })}
        />
        <div className="button-row modal-actions">
          <button className="secondary-button" onClick={props.onCancel}>
            取消
          </button>
          <button className="primary-button" onClick={props.onConfirm}>
            拆分任务
          </button>
        </div>
      </section>
    </div>
  );
}

export function ShortcutHelpDialog(props: {
  open: boolean;
  onClose: () => void;
}) {
  if (!props.open) return null;
  const shortcuts = [
    { keys: "⌘/Ctrl + 1", desc: "打开项目与成员" },
    { keys: "⌘/Ctrl + 2", desc: "打开进度看板" },
    { keys: "⌘/Ctrl + 3", desc: "打开我的工作台" },
    { keys: "⌘/Ctrl + 4", desc: "打开排期" },
    { keys: "⌘/Ctrl + 5", desc: "打开洞察" },
    { keys: "/", desc: "打开命令面板" },
    { keys: "⌘/Ctrl + K", desc: "打开命令面板" },
    { keys: "Esc", desc: "关闭当前弹窗/面板" },
    { keys: "空格", desc: "开始/继续/暂停计时（当前有活动计时）" },
    { keys: "Shift+空格", desc: "确认后重置当前番茄" },
    { keys: "Enter", desc: "从已选任务开始工作会话（我的工作台）" },
    { keys: "Q", desc: "计时器返回进度看板" },
    { keys: "↑ / ↓", desc: "上下调整工作队列顺序（我的工作台）" },
    { keys: "⌘/Ctrl + Enter", desc: "快速完成个人回顾（我的工作台）" },
    { keys: "I", desc: "记录内部中断（在专注页）" },
    { keys: "O", desc: "记录外部中断（在专注页）" },
  ];

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal-panel" role="dialog" aria-modal="true" aria-label="快捷键说明">
        <div className="section-title">
          <div>
            <p className="eyebrow">Shortcuts</p>
            <h2>快捷键说明</h2>
          </div>
          <button className="icon-button small" onClick={props.onClose} title="关闭">
            <X size={16} />
          </button>
        </div>
        <p className="muted">这些是当前流程里最常用的键盘入口，浏览器和 Tauri 体验一致。</p>
        <div className="shortcut-grid">
          {shortcuts.map((item) => (
            <div className="shortcut-row" key={item.keys}>
              <kbd>{item.keys}</kbd>
              <span>{item.desc}</span>
            </div>
          ))}
        </div>
        <div className="button-row modal-actions">
          <button className="secondary-button" onClick={props.onClose}>
            我知道了
          </button>
        </div>
      </section>
    </div>
  );
}
