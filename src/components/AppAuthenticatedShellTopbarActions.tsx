import { Search } from "lucide-react";
import type { AppAuthenticatedShellProps } from "./AppAuthenticatedShellTypes";
import { WorkspaceInvitationMenu } from "./WorkspaceInvitationMenu";

type AppAuthenticatedShellTopbarActionsProps = Pick<
  AppAuthenticatedShellProps,
  "view" | "shellState" | "chrome" | "authActions" | "workspaceAccountActions"
>;

export function AppAuthenticatedShellTopbarActions({
  view,
  shellState,
  chrome,
  authActions,
  workspaceAccountActions,
}: AppAuthenticatedShellTopbarActionsProps) {
  return (
    <>
      <WorkspaceInvitationMenu
        workspaceInvitations={chrome.workspaceInvitations}
        projectInvitations={chrome.projectInvitations}
        acceptWorkspaceInvitation={workspaceAccountActions.acceptPendingWorkspaceInvitation}
        acceptProjectInvitation={workspaceAccountActions.acceptPendingProjectInvitation}
        deleteWorkspaceInvitation={workspaceAccountActions.deletePendingWorkspaceInvitation}
        deleteProjectInvitation={workspaceAccountActions.deletePendingProjectInvitation}
        refreshInvitations={async () => {
          await Promise.all([
            workspaceAccountActions.refreshWorkspaceInvitations(),
            workspaceAccountActions.refreshProjectInvitations(),
          ]);
        }}
      />
      <button className="secondary-button" onClick={authActions.logout}>
        退出登录：{view.state.auth.account?.name ?? "当前账号"}
      </button>
      <button className="icon-button" title="命令面板" onClick={() => shellState.setCommandPaletteOpen(true)}>
        <Search size={18} />
      </button>
    </>
  );
}
