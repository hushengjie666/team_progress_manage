import type { AppAuthenticatedShellProps } from "./AppAuthenticatedShellTypes";
import { MemberStatusView } from "./MemberStatusView";

type AppMemberStatusRouteProps = Pick<AppAuthenticatedShellProps, "view" | "shellState">;

export function AppMemberStatusRoute({ view, shellState }: AppMemberStatusRouteProps) {
  return (
    <MemberStatusView
      state={view.state}
      workspaceId={shellState.selectedWorkspaceId ?? undefined}
      selectTask={shellState.setSelectedTaskId}
    />
  );
}
