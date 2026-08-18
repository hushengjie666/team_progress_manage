import { createDailyPlanForDate } from "./appTodayPlan";
import { currentAccountDailyPlanForWorkspaceDate } from "./dailyPlanScope";
import type { AppState, DailyPlan } from "./types";
import type { RunTeamDomainCommand } from "./teamDomainCommands";

export async function ensureRemoteDailyPlan(
  state: AppState,
  workspaceId: string | undefined,
  date: string,
  runTeamCommand: RunTeamDomainCommand,
): Promise<{ state: AppState; plan: DailyPlan } | undefined> {
  const existing = currentAccountDailyPlanForWorkspaceDate(state, workspaceId, date);
  if (existing) return { state, plan: existing };

  const plan = createDailyPlanForDate(state, date, undefined, workspaceId);
  const saved = await runTeamCommand({
    kind: "create",
    entity: "daily_plan",
    workspaceId,
    payload: plan as unknown as Record<string, unknown>,
    idempotencyKey: `daily-plan:create:${plan.id}`,
  });
  if (!saved) return undefined;
  return {
    state: saved,
    plan: currentAccountDailyPlanForWorkspaceDate(saved, workspaceId, date) ?? plan,
  };
}
