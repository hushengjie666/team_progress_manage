import { DatabaseBackup } from "lucide-react";

export function SettingsDemoPanel({
  projectCount,
  taskCount,
  projectMemberCount,
  workRecordCount,
  loadDemoData,
}: {
  projectCount: number;
  taskCount: number;
  projectMemberCount: number;
  workRecordCount: number;
  loadDemoData: () => void;
}) {
  return (
    <section className="band settings-panel demo-data-panel">
      <div className="section-title">
        <div>
          <p className="eyebrow">演示数据</p>
          <h2>演示数据管理</h2>
        </div>
        <DatabaseBackup size={20} />
      </div>
      <p className="muted section-helper">
        用一套内置样例快速体验项目总览、成员状况、工作队列、专注计时和复盘页面。加载演示数据会添加到当前项目，不会退出登录或替换现有数据。
      </p>
      <div className="sync-summary-grid">
        <div>
          <span>当前项目</span>
          <strong>{projectCount}</strong>
        </div>
        <div>
          <span>当前任务</span>
          <strong>{taskCount}</strong>
        </div>
        <div>
          <span>成员绑定</span>
          <strong>{projectMemberCount}</strong>
        </div>
        <div>
          <span>工作记录</span>
          <strong>{workRecordCount}</strong>
        </div>
      </div>
      <div className="button-row">
        <button className="primary-button" onClick={loadDemoData}>
          <DatabaseBackup size={16} />
          加载演示数据
        </button>
      </div>
    </section>
  );
}
