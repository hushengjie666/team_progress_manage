import { Building2, House } from "lucide-react";
import type { Workspace } from "../types";

export function WorkspaceScopeSelector({
  workspaces,
  selectedWorkspaceId,
  selectWorkspace,
}: {
  workspaces: Workspace[];
  selectedWorkspaceId: string | null;
  selectWorkspace: (workspaceId: string) => void;
}) {
  if (workspaces.length === 0) return null;

  return (
    <div className="workspace-scope-selector" role="group" aria-label="工作区筛选">
      {workspaces.map((workspace) => {
        const privateWorkspace = (workspace.type ?? "shared") === "private";
        const selected = selectedWorkspaceId === workspace.id;
        const label = privateWorkspace ? "私人" : workspace.name;
        return (
          <button
            className={selected ? "workspace-scope-option active" : "workspace-scope-option"}
            aria-pressed={selected}
            key={workspace.id}
            onClick={() => selectWorkspace(workspace.id)}
            title={`${label}${selected ? "；再次点击显示全部工作区" : ""}`}
            type="button"
          >
            {privateWorkspace ? <House size={15} /> : <Building2 size={15} />}
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
