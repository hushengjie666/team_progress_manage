import type { AppAuthenticatedShellProps } from "./AppAuthenticatedShellTypes";
import { DailyReviewView } from "./DailyReviewView";

type AppDailyReviewRouteProps = Pick<AppAuthenticatedShellProps, "view" | "dailyActions">;

export function AppDailyReviewRoute({ view, dailyActions }: AppDailyReviewRouteProps) {
  return (
    <DailyReviewView
      state={view.state}
      todayPlan={view.todayPlan}
      capacityHint={view.capacityHint}
      updateReview={dailyActions.updateReview}
      completeReview={dailyActions.completeReview}
    />
  );
}
