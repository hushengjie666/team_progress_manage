import { useMemo, useState } from "react";
import { useAccountQuotes, useDailyQuote } from "../../dailyQuotes/DailyQuotesProvider";
import { builtInQuotes } from "../../dailyQuotes/builtInQuotes";
import { normalizeQuoteText, quoteSourceStatus, validateQuoteFields, type DailyQuoteSettings, type LibraryQuote, type QuoteFields } from "../../dailyQuotes/library";
import { uid } from "../../seed";
import { ConfirmDialog } from "../Dialogs";
import { QuoteDetails } from "../QuoteDetails";
import { QuoteEditor } from "./QuoteEditor";
import { QuoteScheduleForm } from "./QuoteScheduleForm";

export function SettingsQuotesPanel() {
  const { settings, busy, warning, reload, save } = useAccountQuotes();
  const { library, enabledCount, quote, next } = useDailyQuote();
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("all");
  const [enabled, setEnabled] = useState("all");
  const [editor, setEditor] = useState<LibraryQuote | "new">();
  const [detailId, setDetailId] = useState<string>();
  const [confirmation, setConfirmation] = useState<LibraryQuote>();
  const [confirmError, setConfirmError] = useState("");
  const [listError, setListError] = useState("");
  const detail = library.find((entry) => entry.id === detailId);
  const visible = useMemo(() => {
    const term = normalizeQuoteText(query);
    return library.filter((entry) =>
      (kind === "all" || (kind === "custom" ? entry.kind === "custom" : entry.kind !== "custom")) &&
      (enabled === "all" || entry.enabled === (enabled === "on")) &&
      (!term || [entry.text, entry.author, entry.source].some((field) => normalizeQuoteText(field).includes(term))),
    );
  }, [query, kind, enabled, library]);

  function saveEntry(fields: QuoteFields) {
    if (!editor || editor === "new") return save({
      ...settings, custom: [...settings.custom, { ...fields, id: uid("custom").replace("_", "-") }],
    });
    return save(editor.kind === "custom"
      ? { ...settings, custom: settings.custom.map((entry) => entry.id === editor.id ? { ...fields, id: editor.id } : entry) }
      : { ...settings, overrides: { ...settings.overrides, [editor.id]: fields } });
  }

  async function toggle(entry: LibraryQuote) {
    const disabled = entry.enabled ? [...settings.disabled, entry.id] : settings.disabled.filter((id) => id !== entry.id);
    setListError("");
    if (!await save({ ...settings, disabled })) setListError("启用状态未保存，请确认网络后重试。");
  }

  async function confirmChange() {
    if (!confirmation) return;
    const { id, kind } = confirmation;
    setConfirmError("");
    let nextSettings: DailyQuoteSettings;
    if (kind === "custom") {
      nextSettings = { ...settings, custom: settings.custom.filter((entry) => entry.id !== id), disabled: settings.disabled.filter((key) => key !== id) };
    } else {
      const original = builtInQuotes.find((entry) => entry.id === id);
      if (!original) return;
      const validation = validateQuoteFields(original, library, id);
      if (validation.error) {
        setConfirmError("另一条名言正在使用原始正文。请先修改或删除重复条目。");
        return;
      }
      const overrides = { ...settings.overrides };
      delete overrides[id];
      nextSettings = { ...settings, overrides };
    }
    if (await save(nextSettings)) setConfirmation(undefined);
    else setConfirmError("更改未保存，请确认网络后重试。");
  }

  return (
    <section className="band settings-panel quote-settings" aria-label="个人名言">
      <div className="section-title">
        <div>
          <h2>名言警句</h2>
          <p className="muted">仅影响你的账号。同一账号的其他客户端刷新后可读取已保存的名言设置。若在其他客户端编辑过，请先刷新。</p>
        </div>
        <button className="secondary-button" disabled={busy} onClick={() => void reload()}>刷新名言配置</button>
      </div>
      {warning && <p className="warning-line" role="status">{warning}</p>}
      <div className="quote-preview">
        <div>
          <h3>当天预览</h3>
          {quote ? (
            <>
              <button className="quote-link-button" onClick={() => setDetailId(quote.id)}>{quote.text}</button>
              <p className="muted">{quote.author}{quote.source && ` · ${quote.source}`}</p>
            </>
          ) : <p>暂无启用名言</p>}
        </div>
        <div>
          <p><strong>{enabledCount} / {library.length}</strong> 条已启用</p>
          <p>当前每天 {settings.time} · {settings.timeZone}</p>
          <p>下次轮换 <time dateTime={next.toISOString()}>{next.toLocaleString("zh-CN", { timeZone: settings.timeZone, hour12: false })}</time></p>
          {settings.fallbackTimeZone && <p className="muted">设备时区无法识别，已使用 UTC。</p>}
        </div>
      </div>
      <QuoteScheduleForm />
      <p className="muted">调整轮换时间、时区或启用名言后会立即重算，当前名言可能随之变化。</p>

      <div className="quote-form-row">
        <label>搜索名言<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="正文、作者或出处" /></label>
        <label><span id="quote-type-label">类型</span><select aria-labelledby="quote-type-label" value={kind} onChange={(event) => setKind(event.target.value)}>
          <option value="all">全部类型</option><option value="builtin">内置</option><option value="custom">自定义</option>
        </select></label>
        <label><span id="quote-status-label">状态</span><select aria-labelledby="quote-status-label" value={enabled} onChange={(event) => setEnabled(event.target.value)}>
          <option value="all">全部状态</option><option value="on">已启用</option><option value="off">已停用</option>
        </select></label>
        <button className="primary-button" disabled={busy || Boolean(editor)} onClick={() => setEditor("new")}>新增名言</button>
      </div>
      {editor && <QuoteEditor
        key={editor === "new" ? "new" : editor.id}
        quote={editor === "new" ? undefined : editor}
        library={library}
        busy={busy}
        onSave={saveEntry}
        onClose={() => setEditor(undefined)}
      />}
      {listError && <p className="warning-line" role="alert">{listError}</p>}
      <p className="muted">共 {visible.length} 条结果</p>
      {visible.length ? (
        <ul className="quote-list" aria-label="名言列表">
          {visible.map((entry) => (
            <li key={entry.id}>
              <div>
                <button className="quote-link-button" onClick={() => setDetailId(entry.id)}>{entry.text}</button>
                <p className="muted">{entry.author}{entry.source && ` · ${entry.source}`}</p>
                <small>{quoteSourceStatus(entry.kind)} · {entry.enabled ? "已启用" : "已停用"}</small>
              </div>
              <div className="button-row">
                <button className="small-button" disabled={busy || Boolean(editor)} onClick={() => setEditor(entry)}>编辑</button>
                <button className="small-button" disabled={busy} onClick={() => void toggle(entry)}>{entry.enabled ? "停用" : "启用"}</button>
                {entry.kind !== "builtin" && (
                  <button className="small-button" disabled={busy} onClick={() => {
                    setConfirmError("");
                    setConfirmation(entry);
                  }}>{entry.kind === "custom" ? "删除" : "恢复原始内容"}</button>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : <p className="muted">没有符合条件的名言。</p>}
      {detail && <QuoteDetails quote={detail} onClose={() => setDetailId(undefined)} />}
      <ConfirmDialog
        open={Boolean(confirmation)}
        title={confirmation?.kind === "custom" ? "删除自定义名言" : "恢复内置名言"}
        body={confirmation?.kind === "custom" ? `删除「${confirmation.text}」？` : "恢复该条名言的原始内容与已核实出处？启用状态会保留。"}
        confirmLabel={confirmation?.kind === "custom" ? "确认删除" : "确认恢复"}
        danger={confirmation?.kind === "custom"}
        busy={busy}
        error={confirmError}
        onCancel={() => setConfirmation(undefined)}
        onConfirm={() => void confirmChange()}
      />
    </section>
  );
}
