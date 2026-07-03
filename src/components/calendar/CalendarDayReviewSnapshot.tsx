import { CalendarDays } from "lucide-react";
import type { DailyPlan, DailyReview } from "../../types";

type CalendarDayReviewSnapshotProps = {
  selectedPlan?: DailyPlan;
  review?: DailyReview;
  reviewLabel: string;
};

export function CalendarDayReviewSnapshot({ selectedPlan, review, reviewLabel }: CalendarDayReviewSnapshotProps) {
  return (
    <div className="day-review-summary">
      <div className="section-title">
        <div>
          <p className="eyebrow">回顾快照</p>
          <h3>当天复盘</h3>
        </div>
        <CalendarDays size={20} />
      </div>
      {selectedPlan?.reviewedAt ? (
        <div className="review-content">
          <p>
            回顾时间 <strong>{new Date(selectedPlan.reviewedAt).toLocaleString()}</strong>
          </p>
          <p>
            今日状态 <strong>{reviewLabel}</strong>
          </p>
          <div className="review-grid">
            <p>{review?.wins ? `收获：${review.wins}` : "收获：暂无填写"}</p>
            <p>{review?.blockers ? `阻碍：${review.blockers}` : "阻碍：暂无填写"}</p>
            <p>{review?.interruptionPattern ? `中断模式：${review.interruptionPattern}` : "中断模式：暂无分析"}</p>
            <p>{review?.tomorrowFocus ? `明日注意：${review.tomorrowFocus}` : "明日注意：暂无填写"}</p>
          </div>
        </div>
      ) : (
        <p className="muted">该日尚未完成回顾。建议前往工作台对应日期完成回顾后在此核对。</p>
      )}
    </div>
  );
}
