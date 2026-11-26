import { Leaf } from "lucide-react";
import { useDailyQuote } from "../../dailyQuotes/DailyQuotesProvider";

export function FocusDailyQuote() {
  const { quote } = useDailyQuote();

  return (
    <section className="focus-quote" aria-label="每日一句">
      <span className="focus-quote-label"><Leaf size={13} aria-hidden="true" />每日一句</span>
      {quote ? (
        <p className="focus-quote-body" title={quote.text}>{quote.text}</p>
      ) : <p className="muted">暂无启用名言</p>}
    </section>
  );
}
