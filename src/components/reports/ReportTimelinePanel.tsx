import { Clock3 } from "lucide-react";
import { modeLabel } from "../../appModel";
import type { FocusSession, Task } from "../../types";

export function ReportTimelinePanel({
  focusSessions,
  tasks,
  onOpenTask,
}: {
  focusSessions: FocusSession[];
  tasks: Task[];
  onOpenTask: (taskId: string) => void;
}) {
  return (
    <section className="band timeline-panel" id="focus-timeline">
      <div className="section-title">
        <div>
          <p className="eyebrow">执行记录</p>
          <h2>专注时间线</h2>
        </div>
        <Clock3 size={20} />
      </div>
      <div className="timeline">
        {focusSessions.slice(0, 12).map((session) => {
          const task = tasks.find((item) => item.id === session.taskId);
          return (
            <article className="timeline-item" key={session.id}>
              <span />
              <div>
                <strong>{task?.title ?? modeLabel[session.mode]}</strong>
                <p>
                  {new Date(session.startedAt).toLocaleString()} · {session.outcome ?? "进行中"} · 内/外中断{" "}
                  {session.interruptionCounts.internal}/{session.interruptionCounts.external}
                </p>
                {session.taskId && (
                  <button className="link-button" onClick={() => onOpenTask(session.taskId!)}>
                    查看任务
                  </button>
                )}
              </div>
            </article>
          );
        })}
        {!focusSessions.length && <p className="empty">完成番茄后会出现时间线。</p>}
      </div>
    </section>
  );
}
