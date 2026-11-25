import { useState, type FormEvent } from "react";
import { useAccountQuotes } from "../../dailyQuotes/DailyQuotesProvider";
import { isRotationTime, isTimeZone } from "../../dailyQuotes/rotation";
import type { DailyQuoteSettings } from "../../dailyQuotes/library";

const supportedValues = (Intl as typeof Intl & { supportedValuesOf?: (key: "timeZone") => string[] }).supportedValuesOf;
const timeZones = ["UTC", ...(supportedValues?.("timeZone") ?? [
  "Asia/Shanghai", "Asia/Tokyo", "Asia/Singapore", "Europe/London", "Europe/Paris",
  "America/New_York", "America/Los_Angeles", "Australia/Sydney", "Pacific/Auckland",
])];

export function QuoteScheduleForm() {
  const { settings, busy, save } = useAccountQuotes();
  const [draft, setDraft] = useState<Pick<DailyQuoteSettings, "time" | "timeZone">>();
  const [message, setMessage] = useState<{ text: string; error?: boolean }>();
  const { time, timeZone } = draft ?? settings;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const zone = timeZone.trim();
    if (!isRotationTime(time) || !isTimeZone(zone)) {
      setMessage({ text: "请输入 00:00–23:59 的轮换时间和有效的 IANA 时区，例如 Asia/Shanghai。", error: true });
      return;
    }
    setMessage(undefined);
    if (await save({ ...settings, time, timeZone: zone, fallbackTimeZone: false })) {
      setDraft(undefined);
      setMessage({ text: "轮换设置已保存。" });
    } else {
      setMessage({ text: "轮换设置未保存，输入已保留。请确认网络后重试。", error: true });
    }
  }

  return (
    <form className="quote-schedule" onSubmit={(event) => void submit(event)} noValidate>
      <div className="quote-form-row">
        <label>每天轮换时间<input type="time" value={time} onChange={(event) => {
          setDraft({ time: event.target.value, timeZone });
          setMessage(undefined);
        }} /></label>
        <label>固定 IANA 时区<input value={timeZone} list="quote-time-zones" onChange={(event) => {
          setDraft({ time, timeZone: event.target.value });
          setMessage(undefined);
        }} /></label>
        <datalist id="quote-time-zones">
          {timeZones.map((zone) => <option key={zone} value={zone} />)}
        </datalist>
        <button type="submit" className="secondary-button" disabled={busy || !draft}>保存轮换设置</button>
      </div>
      {message && <p className={message.error ? "warning-line" : "muted"} role={message.error ? "alert" : "status"}>{message.text}</p>}
    </form>
  );
}
