import type React from "react";

export function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="metric">
      {icon}
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function DistributionList({
  title,
  items,
  max,
  onItemSelect,
}: {
  title: string;
  items: [string, number][];
  max: number;
  onItemSelect?: (name: string) => void;
}) {
  return (
    <div className="distribution-list">
      <strong>{title}</strong>
      {items.length === 0 && <p className="empty">暂无数据</p>}
      {items.map(([name, count]) => {
        const content = (
          <>
            <span>{name}</span>
            <div>
              <i style={{ width: `${Math.max(6, (count / max) * 100)}%` }} />
            </div>
            <small>{count}</small>
          </>
        );
        if (onItemSelect) {
          return (
            <button
              className="distribution-row distribution-row-button"
              key={name}
              onClick={() => onItemSelect(name)}
              type="button"
              title={`按 ${title} 筛选「${name}」`}
            >
              {content}
            </button>
          );
        }
        return (
          <div className="distribution-row" key={name}>
            {content}
          </div>
        );
      })}
    </div>
  );
}
