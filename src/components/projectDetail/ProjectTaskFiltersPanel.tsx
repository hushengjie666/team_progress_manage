import { projectTaskStatusColumns } from "../../projectTaskDisplay";
import type { ProjectTaskFilters } from "../../projectDetail";
import type { ProjectMember } from "../../types";

type ProjectTaskFiltersPanelProps = {
  filters: ProjectTaskFilters;
  setFilters: (filters: ProjectTaskFilters) => void;
  executors: ProjectMember[];
};

export function ProjectTaskFiltersPanel({ filters, setFilters, executors }: ProjectTaskFiltersPanelProps) {
  return (
    <div className="project-task-filters">
      <label>
        搜索
        <input value={filters.query} onChange={(event) => setFilters({ ...filters, query: event.target.value })} placeholder="标题、备注、标签" />
      </label>
      <label>
        状态
        <select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value as ProjectTaskFilters["status"] })}>
          <option value="all">全部状态</option>
          {projectTaskStatusColumns.map((column) => (
            <option key={column.status} value={column.status}>{column.title}</option>
          ))}
        </select>
      </label>
      <label>
        执行人
        <select value={filters.executor} onChange={(event) => setFilters({ ...filters, executor: event.target.value })}>
          <option value="all">全部执行人</option>
          <option value="unassigned">未分配</option>
          {executors.map((member) => (
            <option key={member.id} value={member.id}>{member.name}</option>
          ))}
        </select>
      </label>
      <label>
        优先级
        <select value={filters.priority} onChange={(event) => setFilters({ ...filters, priority: event.target.value as ProjectTaskFilters["priority"] })}>
          <option value="all">全部优先级</option>
          <option value="urgent">紧急</option>
          <option value="high">高</option>
          <option value="medium">中</option>
          <option value="low">低</option>
        </select>
      </label>
      <label>
        排序
        <select value={filters.sort} onChange={(event) => setFilters({ ...filters, sort: event.target.value as ProjectTaskFilters["sort"] })}>
          <option value="status">状态顺序</option>
          <option value="priority">优先级</option>
          <option value="dueAt">到期日</option>
          <option value="updatedAt">最近更新</option>
        </select>
      </label>
    </div>
  );
}
