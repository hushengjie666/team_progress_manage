import { Leaf } from "lucide-react";
import { useState } from "react";
import { useDailyQuote } from "../../dailyQuotes/DailyQuotesProvider";
import { QuoteDetails } from "../QuoteDetails";

export function FocusDailyQuote({ openSettings }: { openSettings: () => void }) {
  const { quote } = useDailyQuote();
  const [details, setDetails] = useState(false);

  return (
    <section className="focus-quote" aria-label="每日一句">
      <div className="focus-quote-label">
        <span><Leaf size={13} aria-hidden="true" />每日一句</span>
        <button type="button" className="quote-link-button" onClick={openSettings}>管理名言</button>
      </div>
      {quote ? (
        <button type="button" className="focus-quote-body" aria-label="查看每日名言全文" onClick={() => setDetails(true)}>
          <strong>{quote.text}</strong>
          <span>{quote.author}{quote.source && ` · ${quote.source}`}</span>
        </button>
      ) : <p className="muted">暂无启用名言</p>}
      {details && quote && <QuoteDetails quote={quote} onClose={() => setDetails(false)} />}
    </section>
  );
}
