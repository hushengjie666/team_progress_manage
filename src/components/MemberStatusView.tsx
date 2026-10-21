import {
  buildMemberStatusModel,
} from "../memberStatusColumns";
import type { AppState } from "../types";
import { MemberStatusColumnView } from "./memberStatus/MemberStatusColumnView";

export { buildMemberStatusColumns } from "../memberStatusColumns";
export { buildMemberStatusPeople } from "../memberStatusPeople";
export type {
  MemberProjectTaskGroup,
  MemberStatusColumn,
  MemberStatusPerson,
} from "../memberStatusTypes";

export function MemberStatusView({
  state,
  projectId,
  workspaceId,
  selectTask,
}: {
  state: AppState;
  projectId?: string;
  workspaceId?: string;
  selectTask: (taskId: string | null) => void;
}) {
  const { columns, taskCount } = buildMemberStatusModel(state, projectId, undefined, workspaceId);

  return (
    <section className="band member-status-panel">
      <div className="section-title">
        <div>
          <p className="eyebrow">成员状况</p>
          <h2>今日任务总览</h2>
        </div>
        <span className="count-pill" title="按任务去重统计；协作任务可能同时出现在多名成员列中" aria-label={`今日任务共 ${taskCount} 项（去重）`}>{taskCount} 项任务</span>
      </div>
      <div className="member-status-board" aria-label="成员今日任务列">
        {columns.map((member) => (
          <MemberStatusColumnView
            key={member.id}
            member={member}
            selectTask={selectTask}
          />
        ))}
        {columns.length === 0 && <p className="empty">暂无成员。</p>}
      </div>
    </section>
  );
}
