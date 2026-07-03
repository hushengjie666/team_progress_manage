import { Clock3 } from "lucide-react";
import { modeLabel } from "../../appModel";
import type { FocusSession, Interruption, Task } from "../../types";

type CalendarDayTimelineProps = {
  tasks: Task[];
  selectedSessions: FocusSession[];
  selectedInterruptions: Interruption[];
  openTask: (taskId: string) => void;
};

export function CalendarDayTimeline({
  tasks,
  selectedSessions,
  selectedInterruptions,
  openTask,
}: CalendarDayTimelineProps) {
  return (
    <div className="timeline-section">
      <div className="section-title">
        <div>
          <p className="eyebrow">执行时间线</p>
          <h3>日内番茄与中断</h3>
        </div>
        <Clock3 size={20} />
      </div>
      <div className="timeline">
        {selectedSessions.map((session) => {
          const task = session.taskId ? tasks.find((item) => item.id === session.taskId) : undefined;
          return (
            <article className="timeline-item" key={session.id}>
              <span />
              <div>
                <strong>{task?.title ?? modeLabel[session.mode]}</strong>
                <p>
                  {new Date(session.startedAt).toLocaleString()} · {session.outcome ?? "进行中"} · 内/外中断{" "}
                  {session.interruptionCounts.internal}/{session.interruptionCounts.external}
                </p>
                {task && <button className="link-button" onClick={() => openTask(task.id)}>查看任务</button>}
              </div>
            </article>
          );
        })}
        {selectedInterruptions.map((item) => (
          <article className="timeline-item" key={item.id}>
            <span />
            <div>
              <strong>中断记录</strong>
              <p>
                {new Date(item.createdAt).toLocaleString()} · {item.type === "internal" ? "内部" : "外部"}
              </p>
              <small>{item.note}</small>
            </div>
          </article>
        ))}
        {!selectedSessions.length && !selectedInterruptions.length && <p className="empty">当天还没有可追溯记录。</p>}
      </div>
      {selectedInterruptions.filter((item) => item.type === "external").length > 0 && (
        <p className="muted">外部中断较多，建议在专注前再清理消息源。</p>
      )}
    </div>
  );
}
