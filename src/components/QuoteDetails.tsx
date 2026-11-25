import { useEffect, useRef, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { quoteSourceStatus, type LibraryQuote } from "../dailyQuotes/library";

export function QuoteDetails({ quote, onClose }: { quote: LibraryQuote; onClose: () => void }) {
  const link = useRef<HTMLAnchorElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previous = document.activeElement;
    closeButton.current?.focus();
    return () => {
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, []);

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onClose();
    }
    if (event.key === "Tab") {
      event.preventDefault();
      const next = !link.current || document.activeElement === link.current ? closeButton.current : link.current;
      next?.focus();
    }
  }

  return createPortal(
    <div className="modal-backdrop">
      <section className="quote-details modal-panel" aria-label="名言全文与出处" role="dialog" aria-modal="true" onKeyDown={handleKeyDown}>
        <h2>名言全文与出处</h2>
        <blockquote>{quote.text}</blockquote>
        <p>{quote.author}{quote.source && ` · ${quote.source}`}</p>
        <p className="muted">{quoteSourceStatus(quote.kind)}</p>
        {quote.original && <p lang="en">{quote.original}</p>}
        {quote.translation && <p className="muted">{quote.translation}</p>}
        {quote.url && <p><a ref={link} href={quote.url} target="_blank" rel="noreferrer">打开参考来源</a></p>}
        <div className="button-row modal-actions">
          <button type="button" className="secondary-button" ref={closeButton} onClick={onClose}>关闭</button>
        </div>
      </section>
    </div>,
    document.body,
  );
}
