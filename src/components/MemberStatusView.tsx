import {
  buildMemberStatusColumns,
  countMemberStatusTodayTasks,
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
  selectTask,
}: {
  state: AppState;
  projectId?: string;
  selectTask: (taskId: string | null) => void;
}) {
  const columns = buildMemberStatusColumns(state, projectId);
  const todayTaskCount = countMemberStatusTodayTasks(state, projectId);

  return (
    <section className="band member-status-panel">
      <div className="section-title">
        <div>
          <p className="eyebrow">成员状况</p>
          <h2>今日任务总览</h2>
        </div>
        <span className="count-pill">{todayTaskCount}</span>
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
