import { incompleteRecoveryCount } from "../businessRecovery";
import type { AppState } from "../types";

export function BusinessRecoveryNotice({ state }: { state: AppState }) {
  const count = incompleteRecoveryCount(state);
  if (!count) return null;
  return (
    <div className="backend-error-banner data-recovery-banner" role="status">
      <div>
        <strong>历史数据待补全</strong>
        <p>已加载的历史数据中有 {count} 条记录缺少原始详情，已保留可恢复的信息。占位名称、时间和数值默认值不代表原始数据，请补全后再用于统计。</p>
      </div>
    </div>
  );
}
