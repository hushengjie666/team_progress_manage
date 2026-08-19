import { Search } from "lucide-react";
import type { AppAuthenticatedShellProps } from "./AppAuthenticatedShellTypes";
import { AppVersionMenu } from "./AppVersionMenu";
import { WorkspaceInvitationMenu } from "./WorkspaceInvitationMenu";
import { WorkspaceScopeSelector } from "./WorkspaceScopeSelector";

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
      {view.tab !== "settings" && (
        <WorkspaceScopeSelector
          workspaces={view.visibleWorkspaces}
          selectedWorkspaceId={shellState.selectedWorkspaceId}
          selectWorkspace={(workspaceId) => {
            shellState.setSelectedWorkspaceId((current) => current === workspaceId ? null : workspaceId);
            shellState.setSelectedTaskId(null);
          }}
        />
      )}
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
      <AppVersionMenu backend={view.state.backend} />
      <button className="secondary-button" onClick={authActions.logout}>
        退出登录：{view.state.auth.account?.name ?? "当前账号"}
      </button>
      <button className="icon-button" title="命令面板" onClick={() => shellState.setCommandPaletteOpen(true)}>
        <Search size={18} />
      </button>
    </>
  );
}
