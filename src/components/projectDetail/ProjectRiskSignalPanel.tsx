import type { ProjectDetailModel } from "../../projectDetail";

type ProjectRiskSignalPanelProps = {
  board: ProjectDetailModel["board"];
  riskSections: ProjectDetailModel["riskSections"];
  riskTaskCount: ProjectDetailModel["riskTaskCount"];
  selectTask: (taskId: string) => void;
};

const signalSectionMeta = {
  assigned_not_started: { label: "未启动", description: "已分配但还没有开始记录。" },
  stalled: { label: "停滞", description: "任务超过预期但没有新的执行信号。" },
  blocked: { label: "阻塞", description: "进展说明或退回原因包含阻塞信息。" },
  pending_review: { label: "验收", description: "等待项目负责人确认结果。" },
  near_finish: { label: "临近", description: "预计完成时间即将到达。" },
  normal: { label: "正常", description: "当前没有明显风险信号。" },
} as const;

export function ProjectRiskSignalPanel({
  board,
  riskSections,
  riskTaskCount,
  selectTask,
}: ProjectRiskSignalPanelProps) {
  return (
    <section className="band progress-board">
      <div className="section-title">
        <div>
          <p className="eyebrow">项目状态</p>
          <h2>风险与执行信号</h2>
        </div>
        <span className="count-pill">{riskTaskCount}</span>
      </div>

      <div className="progress-signal-summary">
        {board.sections.filter((section) => section.kind !== "pending_review" && section.kind !== "normal").map((section) => (
          <div className={section.tasks.length > 0 ? "signal-summary-chip attention" : "signal-summary-chip"} key={section.kind}>
            <span>{signalSectionMeta[section.kind].label}</span>
            <strong>{section.tasks.length}</strong>
          </div>
        ))}
      </div>

      <div className="progress-signal-layout">
        <div className="signal-attention-panel">
          <div className="signal-panel-heading">
            <div>
              <strong>需要关注</strong>
              <span>按风险原因归类，优先处理这里的任务。</span>
            </div>
            <span>{riskTaskCount}</span>
          </div>
          {riskSections.length === 0 && <p className="empty">当前没有需要特别处理的任务。</p>}
          <div className="signal-task-list">
            {riskSections.flatMap((section) =>
              section.tasks.map((task) => (
                <article className={`signal-task-row signal-task-${section.kind}`} key={`${section.kind}-${task.taskId}`}>
                  <span className="signal-kind-badge">{section.title}</span>
                  <div>
                    <strong>{task.title}</strong>
                    <span>{task.executorName ?? "未分配执行者"} · 进度 {task.progressPercent}%</span>
                    <p>{task.detail}</p>
                  </div>
                  <button className="small-button" onClick={() => selectTask(task.taskId)}>查看</button>
                </article>
              )),
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
