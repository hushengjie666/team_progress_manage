import { useState, type FormEvent } from "react";
import { validateQuoteFields, type LibraryQuote, type QuoteFields } from "../../dailyQuotes/library";

const empty = { text: "", author: "", source: "", url: "" };

export function QuoteEditor({ quote, library, busy, onSave, onClose }: {
  quote?: LibraryQuote;
  library: LibraryQuote[];
  busy: boolean;
  onSave: (value: QuoteFields) => Promise<boolean>;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<QuoteFields>(quote ?? empty);
  const [error, setError] = useState("");
  const change = (key: keyof QuoteFields, value: string) => setDraft((current) => ({ ...current, [key]: value }));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validated = validateQuoteFields(draft, library, quote?.id);
    if (!validated.value) {
      setError(validated.error);
      return;
    }
    setError("");
    if (await onSave(validated.value)) onClose();
    else setError("名言未保存，草稿已保留。请确认网络和账号设置后重试。");
  }

  return (
    <form className="quote-editor" onSubmit={(event) => void submit(event)} aria-label={quote ? "编辑名言" : "新增名言"}>
      <h3>{quote ? "编辑名言" : "新增名言"}</h3>
      <label>正文（1–80 字符）<textarea autoFocus rows={3} value={draft.text} onChange={(event) => change("text", event.target.value)} /></label>
      <label>作者或归属（1–40 字符）<input value={draft.author} onChange={(event) => change("author", event.target.value)} /></label>
      <label>出处说明（选填）<input value={draft.source} onChange={(event) => change("source", event.target.value)} /></label>
      <label>参考链接（选填）<input inputMode="url" value={draft.url} onChange={(event) => change("url", event.target.value)} /></label>
      {quote?.kind === "builtin" && <p className="muted">保存个人修改后，出处状态会标为未重新核实。</p>}
      {error && <p className="warning-line" role="alert">{error}</p>}
      <div className="button-row">
        <button type="submit" className="primary-button" disabled={busy}>保存名言</button>
        <button type="button" className="secondary-button" disabled={busy} onClick={onClose}>取消编辑</button>
      </div>
    </form>
  );
}
