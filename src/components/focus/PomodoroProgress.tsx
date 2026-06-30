export function PomodoroProgress(props: { actual: number; estimate: number; compact?: boolean }) {
  const estimate = Math.max(0, Math.round(props.estimate));
  const actual = Math.max(0, Math.round(props.actual));
  const visibleCount = Math.min(Math.max(estimate, actual, 1), props.compact ? 6 : 8);
  const overflow = Math.max(0, Math.max(estimate, actual) - visibleCount);

  return (
    <div className={props.compact ? "pomodoro-progress compact" : "pomodoro-progress"} aria-label={`已完成 ${actual} 个番茄，估算 ${estimate} 个番茄`}>
      <strong>{actual}/{estimate}</strong>
      <div className="pomodoro-dots" aria-hidden="true">
        {Array.from({ length: visibleCount }, (_, index) => (
          <span
            className={[
              "pomodoro-dot",
              index < actual ? "done" : "",
              index >= estimate ? "extra" : "",
            ].filter(Boolean).join(" ")}
            key={index}
          />
        ))}
        {overflow > 0 && <span className="pomodoro-overflow">+{overflow}</span>}
      </div>
      <span>番茄</span>
    </div>
  );
}
