import { useEffect, useRef, useState } from "react";
import { Bot, FolderCode, RefreshCw, Send, Square, X } from "lucide-react";
import { autoraTurnLabel } from "../../autoraClient";
import type { Task } from "../../types";
import { useTaskAiConversation } from "./useTaskAiConversation";

export function TaskAiDialog(props: {
  task: Task;
  ownerId: string;
  canEdit: boolean;
  close: () => void;
  updateTask: (taskId: string, patch: Partial<Task>) => void;
}) {
  const ai = useTaskAiConversation(props.task, props.ownerId);
  const [message, setMessage] = useState("请结合绑定的本地目录和现有代码，分析这个需求的实现范围、相关模块、待澄清问题、任务拆解及验收条件。");
  const panel = useRef<HTMLElement>(null);
  const end = useRef<HTMLDivElement>(null);
  const onClose = useRef(props.close);
  onClose.current = props.close;

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.querySelector<HTMLElement>("button")?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.stopPropagation(); onClose.current(); }
      if (event.key !== "Tab") return;
      const fields = Array.from(panel.current?.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), a[href]") ?? []);
      const first = fields[0];
      const last = fields[fields.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", keydown);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", keydown);
      previous?.focus();
    };
  }, []);

  useEffect(() => { end.current?.scrollIntoView({ block: "nearest" }); }, [ai.session?.messages.length, ai.turns]);

  const submit = async () => {
    if (await ai.send(message)) setMessage("");
  };
  const draftChanged = ai.title.trim() !== props.task.title || ai.text.trim() !== props.task.notes;

  return (
    <div className="modal-backdrop task-ai-backdrop" onClick={(event) => { if (event.target === event.currentTarget) props.close(); }}>
      <section
        className="modal-panel task-ai-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={`AI 需求分析：${props.task.title}`}
        ref={panel}
      >
        <header className="task-ai-header">
          <div className="task-ai-heading">
            <span className="task-ai-mark"><Bot size={22} /></span>
            <div>
              <h2>AI 需求分析</h2>
              <p>{props.task.project} · {props.task.title}</p>
            </div>
          </div>
          <button className="icon-button small" onClick={props.close} aria-label="关闭 AI 需求分析">
            <X size={18} />
          </button>
        </header>
        <div className="task-ai-layout">
          <aside className="task-ai-requirement">
            <div className="task-ai-section-heading"><h3>需求编辑</h3><span>草稿</span></div>
            <label>
              需求标题
              <input
                value={ai.title}
                maxLength={300}
                disabled={ai.fieldsLocked || !props.canEdit}
                onChange={(event) => ai.setTitle(event.target.value)}
              />
            </label>
            <label className="task-ai-description">
              需求描述
              <textarea
                value={ai.text}
                maxLength={100000}
                rows={8}
                disabled={ai.fieldsLocked || !props.canEdit}
                onChange={(event) => ai.setText(event.target.value)}
                placeholder="描述目标、使用场景和期望结果…"
              />
            </label>
            <div className="task-ai-context">
              <div className="task-ai-section-heading">
                <h3><FolderCode size={16} /> 本地目录与代码</h3>
                <button
                  className="icon-button small"
                  onClick={() => void ai.refresh()}
                  disabled={ai.loading || ai.fieldsLocked}
                  aria-label="刷新 AutoRA 连接"
                ><RefreshCw size={15} /></button>
              </div>
              <label>
                项目目录绑定
                <select
                  value={ai.bindingId}
                  disabled={ai.loading || ai.fieldsLocked}
                  onChange={(event) => ai.setBindingId(event.target.value)}
                >
                  <option value="">{ai.loading ? "正在连接 AutoRA…" : "请选择本地目录绑定"}</option>
                  {ai.bindings.map((binding) => (
                    <option value={binding.id} key={binding.id} disabled={!binding.enabled}>
                      {binding.label}{binding.enabled ? "" : "（未启用）"}
                    </option>
                  ))}
                </select>
              </label>
              {ai.binding && (
                <p className="task-ai-hint">
                  {ai.binding.roots.map((root) => root.label).join("、")} · {ai.contextError
                    ? "读取范围检查失败"
                    : ai.contextCount === undefined ? "检查读取范围中…" : `已检查 ${ai.contextCount} 个上下文文件`}
                </p>
              )}
              {ai.contextLimited && <p className="task-ai-hint">已达到 AutoRA 扫描或上下文上限，分析仅覆盖限额内的文件。</p>}
              {ai.contextError && <p className="task-ai-notice" role="alert">{ai.contextError}</p>}
              {!ai.loading && ai.status && ai.bindings.length === 0 && (
                <p className="task-ai-hint">
                  此项目尚未绑定本地目录。请在 AutoRA 中绑定当前工作区和项目。
                  <br />工作区：{props.task.workspaceId ?? "未设置"}
                  <br />项目：{props.task.projectId}
                </p>
              )}
              <a href="http://127.0.0.1:8890/manage" target="_blank" rel="noreferrer">打开本机 AutoRA 管理</a>
            </div>
            <p className="task-ai-hint">编辑后的草稿用于本次分析。点击保存后才会更新任务需求。</p>
            <button
              className="secondary-button"
              disabled={!props.canEdit || ai.fieldsLocked || !ai.title.trim() || !draftChanged}
              onClick={() => props.updateTask(props.task.id, { title: ai.title.trim(), notes: ai.text.trim() })}
            >保存到任务</button>
          </aside>
          <div className="task-ai-discussion">
            <div className="task-ai-discussion-heading">
              <h3>分析对话</h3>
              <span className={`task-ai-connection ${ai.status ? "connected" : ""}`}>
                {ai.loading ? "连接中" : ai.status ? "AutoRA 已连接 · 本机测试" : "AutoRA 未连接"}
              </span>
              {ai.session && <button className="small-button" disabled={ai.fieldsLocked} onClick={ai.newSession}>新建会话</button>}
            </div>
            {ai.status?.mode === "observe" && <p className="task-ai-notice">AutoRA 当前为观察模式。可验证需求提交、会话和取消流程，真实模型分析尚未启用。</p>}
            {ai.status?.codex.permissions.code === "permissions_unsupported" && <p className="task-ai-notice">本机 AutoRA 尚未完成只读权限验证，当前无法生成真实代码分析。</p>}
            {ai.error && <p className="task-ai-error" role="alert">{ai.error}</p>}
            <div className="task-ai-messages" role="log" aria-label="需求分析对话记录">
              {!ai.session?.messages.length && (
                <div className="task-ai-empty">
                  <Bot size={32} />
                  <h3>结合代码，把需求讨论清楚</h3>
                  <p>检查左侧需求与本地目录，然后发送分析请求。<br />你可以继续追问实现方案、影响范围和验收条件。</p>
                </div>
              )}
              {ai.session?.messages.map((item) => {
                const turn = item.turnId ? ai.turns[item.turnId] : undefined;
                return (
                  <div className="task-ai-exchange" key={item.id}>
                    <article className="task-ai-message user"><strong>你</strong><p>{item.text}</p></article>
                    <article className="task-ai-message assistant">
                      <strong><Bot size={15} /> AutoRA</strong>
                      <p className="task-ai-turn-status">{turn ? autoraTurnLabel(turn) : "正在查询分析状态…"}</p>
                      {turn?.report && <p>{turn.report}</p>}
                      {turn?.truncated && <p className="task-ai-notice">分析文本已达到长度上限，结果有所截断。</p>}
                    </article>
                  </div>
                );
              })}
              <div ref={end} />
            </div>
            {ai.sourceChanged && <p className="task-ai-hint task-ai-source-notice">需求或目录已修改，下次发送将使用新快照建立会话。</p>}
            <form className="task-ai-composer" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
              <label>
                发送给 AI
                <textarea
                  rows={3}
                  maxLength={60000}
                  value={ai.session?.pending?.text ?? message}
                  disabled={ai.busy || Boolean(ai.session?.pending)}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder="继续补充需求或追问…"
                />
              </label>
              <div className="task-ai-composer-actions">
                <span>分析结果保留在对话中</span>
                {ai.activeTurn ? (
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={ai.busy || ai.activeTurn.state === "cancelling"}
                    onClick={() => void ai.cancel()}
                  ><Square size={14} />取消分析</button>
                ) : (
                  <button
                    className="primary-button"
                    type="submit"
                    disabled={!ai.canSend || (!message.trim() && !ai.session?.pending)}
                  >
                    <Send size={15} />
                    {ai.busy ? "提交中…" : ai.session?.pending ? "重试提交" : "发送分析"}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      </section>
    </div>
  );
}
