import { createContext, useContext, useEffect, useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from "react";
import { Check, Sparkles } from "lucide-react";
import type { AppState, Task } from "../../types";
import { completionSummary } from "./completionModel";
import "./completion.css";

type Point = { x: number; y: number };
type Feedback = ReturnType<typeof completionSummary> & { key: number; origin: Point; motion: boolean };
type PrepareFeedback = (id: string, event: MouseEvent<HTMLButtonElement>) => ((saved: AppState) => void) | undefined;
const CompletionContext = createContext<PrepareFeedback>(() => undefined);
export const useCompletionFeedback = () => useContext(CompletionContext);

function originFor(event: MouseEvent<HTMLButtonElement>): Point {
  const rect = event.currentTarget.getBoundingClientRect();
  const point = event.detail ? { x: event.clientX, y: event.clientY } :
    { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  return rect.width && rect.height && point.x >= 0 && point.x <= innerWidth && point.y >= 0 && point.y <= innerHeight
    ? point : { x: innerWidth / 2, y: innerHeight * 0.35 };
}

export function CompletionFeedback({ todayTasks, workspaceId, children }: {
  todayTasks: Task[]; workspaceId: string | null; children: ReactNode;
}) {
  const [events, setEvents] = useState<Feedback[]>([]);
  const nextKey = useRef(0);
  const milestoneSequence = useRef(0);
  const latest = events[events.length - 1];
  const prepare: PrepareFeedback = (id, event) => {
    const origin = originFor(event);
    const sequence = milestoneSequence.current;
    return (saved) => {
      const summary = completionSummary(id, todayTasks, saved, workspaceId);
      // Concurrent saves may both return a fully completed plan.
      const allClear = summary.allClear && sequence === milestoneSequence.current;
      if (allClear) milestoneSequence.current += 1;
      const feedback = { ...summary, allClear, origin, key: ++nextKey.current,
        motion: !window.matchMedia("(prefers-reduced-motion: reduce)").matches };
      setEvents((active) => [...active.slice(-5), feedback]);
    };
  };

  return (
    <CompletionContext.Provider value={prepare}>
      {children}
      {latest && <div className="completion-overlay">
        {events.map((item) => <CelebrationBurst key={item.key} item={item}
          onFinish={() => setEvents((active) => active.filter((entry) => entry.key !== item.key))} />)}
        <div key={latest.key} className="completion-banner" data-milestone={latest.allClear} role="status">
          <span className="completion-seal">{latest.allClear ? <Sparkles size={18} /> : <Check size={18} />}</span>
          <div className="completion-message">
            <strong>{latest.allClear ? "今日任务全部达成！" : "任务完成"}</strong>
            <small>任务已完成并自动验收通过</small>
          </div>
          <span>{latest.allClear ? `共 ${latest.plannedCount} 项` : `今日第 ${latest.achievedToday} 项`}</span>
        </div>
      </div>}
    </CompletionContext.Provider>
  );
}

function CelebrationBurst({ item, onFinish }: { item: Feedback; onFinish: () => void }) {
  const finish = useRef(onFinish);
  useEffect(() => {
    const timer = window.setTimeout(() => finish.current(), 1550);
    return () => clearTimeout(timer);
  }, []);
  if (!item.motion) return null;
  return <>
    <div className="completion-burst" aria-hidden="true" style={{ left: item.origin.x, top: item.origin.y }}>
      <i className="completion-ring" />
      <PaperSpray direction={0} />
    </div>
    {item.allClear && ([-1, 1] as const).map((side) => (
      <div key={side} className="completion-salute" aria-hidden="true" data-side={side}>
        <PaperSpray direction={side} />
      </div>
    ))}
  </>;
}

const palette = ["#337763", "#80c9a5", "#e5b45d", "#dd9173", "#a4b9ce"];
function PaperSpray({ direction }: { direction: number }) {
  const count = direction ? 20 : 17;
  return Array.from({ length: count }, (_, i) => {
    const angle = direction ? -1.25 + (i % 7) * 0.15 : (2 * Math.PI * i) / count;
    const distance = direction ? 125 + (i * 31) % 154 : 45 + (i * 29) % 65;
    const x = Math.cos(angle) * distance * (direction || 1);
    const y = Math.sin(angle) * distance - 30;
    const style = {
      "--peak-x": `${x * 0.74}px`, "--peak-y": `${y * 0.8 - 19}px`,
      "--end-x": `${x}px`, "--end-y": `${y + 58}px`, "--spin": `${(i % 2 ? 1 : -1) * (70 + i * 13)}deg`,
      "--flight": `${640 + (i % 5) * 62 + (direction ? 120 : 0)}ms`, backgroundColor: palette[i % palette.length],
    } as CSSProperties;
    return <i key={i} className="completion-paper" style={style} />;
  });
}
