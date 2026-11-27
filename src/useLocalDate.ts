import { useEffect, useState } from "react";
import { todayKey } from "./seed";

export function useLocalDate() {
  const [day, setDay] = useState(() => todayKey());
  useEffect(() => {
    const update = () => setDay(todayKey());
    const midnight = new Date();
    midnight.setHours(24, 0, 0, 0);
    const timer = window.setTimeout(update, midnight.getTime() - Date.now());
    update();
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("focus", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, [day]);
  return day;
}
