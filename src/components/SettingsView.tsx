import { AlarmClock, Bell, Cloud, DatabaseBackup, Download, LogIn, RefreshCw, Server, ShieldCheck, ShieldQuestion, Sparkles, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { nowIso } from "../appModel";
import { deploymentCommands } from "../syncDiagnostics";
import type { AppState, BlockProfile, ImportSummary, Project, ProjectMember, ProjectMemberRole, StrictModeStatus, SyncConflict, SyncDiagnosticResult, SyncState } from "../types";

export function SettingsView(props: {
  state: AppState;
  activeProfile?: BlockProfile;
  strictStatus: StrictModeStatus | null;
  updateSettings: <K extends keyof AppState["settings"]>(key: K, value: AppState["settings"][K]) => void;
  createProject: (name: string, description: string) => void;
  updateProject: (project: Project) => void;
  addProjectMember: (projectId: string, name: string, email: string, roles: ProjectMemberRole[]) => void;
  updateProjectMember: (member: ProjectMember) => void;
  updateProfile: (profile: BlockProfile) => void;
  askPermissions: () => Promise<void>;
  askNotificationPermissions: () => Promise<void>;
  syncPassword: string;
  setSyncPassword: (value: string) => void;
  updateSyncSetting: <K extends keyof SyncState>(key: K, value: SyncState[K]) => void;
  checkSyncHealth: () => Promise<void>;
  handleSyncLogin: () => Promise<void>;
  handleSyncNow: () => Promise<void>;
  runSyncDiagnostics: () => Promise<void>;
  syncDiagnostic: SyncDiagnosticResult | null;
  exportJson: () => void;
  exportCsv: () => void;
  previewImportFile: (file: File) => Promise<void>;
  importSummary: ImportSummary | null;
  confirmImport: () => void;
  restoreBackup: (backupId: string) => void;
  resolveSyncConflict: (conflict: SyncConflict, action: "local" | "remote" | "later") => void;
  restartOnboarding: () => void;
}) {
  const {
    state,
    activeProfile,
    strictStatus,
    updateSettings,
    createProject,
    updateProject,
    addProjectMember,
    updateProjectMember,
    updateProfile,
    askNotificationPermissions,
    syncPassword,
    setSyncPassword,
    updateSyncSetting,
    checkSyncHealth,
    handleSyncLogin,
    handleSyncNow,
    runSyncDiagnostics,
    syncDiagnostic,
    exportJson,
    exportCsv,
    previewImportFile,
    importSummary,
    confirmImport,
    restoreBackup,
    resolveSyncConflict,
    restartOnboarding,
  } = props;
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [projectDraft, setProjectDraft] = useState({ name: "", description: "" });
  const [memberDrafts, setMemberDrafts] = useState<Record<string, { name: string; email: string; roles: ProjectMemberRole[] }>>({});
  const commands = deploymentCommands(state.sync.serverUrl);
  const strictPlatform = strictStatus?.platform ?? "browser";
  const supportsSystemChecks = strictPlatform === "tauri_macos" || strictPlatform === "ios";
  const supportsUrlChecks = strictPlatform === "tauri_macos";

  const editProfileList = (key: "apps" | "websites", raw: string) => {
    if (!activeProfile) return;
    updateProfile({
      ...activeProfile,
      [key]: raw
        .split(/[,\n，]+/)
        .map((item) => item.trim())
        .filter(Boolean),
      updatedAt: nowIso(),
    });
  };

  const updateDraftRoles = (projectId: string, role: ProjectMemberRole, checked: boolean) => {
    const draft = memberDrafts[projectId] ?? { name: "", email: "", roles: ["executor"] as ProjectMemberRole[] };
    const roles = checked ? Array.from(new Set([...draft.roles, role])) : draft.roles.filter((item) => item !== role);
    setMemberDrafts({ ...memberDrafts, [projectId]: { ...draft, roles } });
  };

  const updateMemberRole = (member: ProjectMember, role: ProjectMemberRole, checked: boolean) => {
    const roles = checked ? Array.from(new Set([...member.roles, role])) : member.roles.filter((item) => item !== role);
    updateProjectMember({ ...member, roles });
  };

  return (
    <div className="settings-layout">
      <section className="band settings-panel">
        <div className="section-title">
          <div>
            <p className="eyebrow">Onboarding</p>
            <h2>启动问卷</h2>
          </div>
          <Sparkles size={20} />
        </div>
        <p className="muted">
          当前目标：每天 {state.onboarding.dailyGoalPomodoros} 个番茄；偏好 {state.onboarding.preferredFocusMinutes} 分钟节奏。
        </p>
        <button className="secondary-button" onClick={restartOnboarding}>
          重新进行启动问卷
        </button>
      </section>

      <section className="band settings-panel">
        <div className="section-title">
          <div>
            <p className="eyebrow">Team Progress</p>
            <h2>项目与成员</h2>
          </div>
          <Sparkles size={20} />
        </div>
        <div className="settings-grid">
          <label>
            项目名称
            <input
              value={projectDraft.name}
              onChange={(event) => setProjectDraft({ ...projectDraft, name: event.target.value })}
              placeholder="例如：客户交付项目"
            />
          </label>
          <label>
            项目说明
            <input
              value={projectDraft.description}
              onChange={(event) => setProjectDraft({ ...projectDraft, description: event.target.value })}
              placeholder="这个项目要达成什么"
            />
          </label>
        </div>
        <button
          className="primary-button"
          onClick={() => {
            createProject(projectDraft.name, projectDraft.description);
            setProjectDraft({ name: "", description: "" });
          }}
        >
          新建项目
        </button>
        <div className="backup-list">
          {state.projects.map((project) => {
            const members = state.projectMembers.filter((member) => member.projectId === project.id);
            const draft = memberDrafts[project.id] ?? { name: "", email: "", roles: ["executor"] as ProjectMemberRole[] };
            return (
              <article className="backup-item" key={project.id}>
                <label>
                  项目名称
                  <input
                    value={project.name}
                    onChange={(event) => updateProject({ ...project, name: event.target.value })}
                  />
                </label>
                <label>
                  项目说明
                  <input
                    value={project.description}
                    onChange={(event) => updateProject({ ...project, description: event.target.value })}
                  />
                </label>
                <label>
                  默认预计开始（小时）
                  <input
                    type="number"
                    min="1"
                    max="720"
                    value={project.defaultExpectedStartHours}
                    onChange={(event) => updateProject({ ...project, defaultExpectedStartHours: Number(event.target.value) })}
                  />
                </label>
                <strong>项目成员</strong>
                {members.map((member) => (
                  <div className="sync-table" key={member.id}>
                    <span>姓名</span>
                    <input value={member.name} onChange={(event) => updateProjectMember({ ...member, name: event.target.value })} />
                    <span>邮箱</span>
                    <input value={member.email ?? ""} onChange={(event) => updateProjectMember({ ...member, email: event.target.value || undefined })} />
                    <span>项目负责人</span>
                    <label className="inline-toggle">
                      <input
                        type="checkbox"
                        checked={member.roles.includes("project_owner")}
                        onChange={(event) => updateMemberRole(member, "project_owner", event.target.checked)}
                      />
                      Project Owner
                    </label>
                    <span>执行者</span>
                    <label className="inline-toggle">
                      <input
                        type="checkbox"
                        checked={member.roles.includes("executor")}
                        onChange={(event) => updateMemberRole(member, "executor", event.target.checked)}
                      />
                      Executor
                    </label>
                  </div>
                ))}
                <div className="settings-grid">
                  <label>
                    新成员姓名
                    <input
                      value={draft.name}
                      onChange={(event) => setMemberDrafts({ ...memberDrafts, [project.id]: { ...draft, name: event.target.value } })}
                    />
                  </label>
                  <label>
                    新成员邮箱
                    <input
                      value={draft.email}
                      onChange={(event) => setMemberDrafts({ ...memberDrafts, [project.id]: { ...draft, email: event.target.value } })}
                    />
                  </label>
                </div>
                <div className="toggle-row">
                  <label>
                    <input
                      type="checkbox"
                      checked={draft.roles.includes("project_owner")}
                      onChange={(event) => updateDraftRoles(project.id, "project_owner", event.target.checked)}
                    />
                    项目负责人
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={draft.roles.includes("executor")}
                      onChange={(event) => updateDraftRoles(project.id, "executor", event.target.checked)}
                    />
                    执行者
                  </label>
                  <button
                    className="secondary-button"
                    onClick={() => {
                      addProjectMember(project.id, draft.name, draft.email, draft.roles);
                      setMemberDrafts({ ...memberDrafts, [project.id]: { name: "", email: "", roles: ["executor"] } });
                    }}
                  >
                    添加成员
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="band settings-panel">
        <div className="section-title">
          <div>
            <p className="eyebrow">Pomodoro Rhythm</p>
            <h2>节奏设置</h2>
          </div>
          <AlarmClock size={20} />
        </div>
        <div className="settings-grid">
          <label>
            专注分钟
            <input
              type="number"
              min="5"
              max="90"
              value={state.settings.focusMinutes}
              onChange={(event) => updateSettings("focusMinutes", Number(event.target.value))}
            />
          </label>
          <label>
            短休分钟
            <input
              type="number"
              min="1"
              max="30"
              value={state.settings.shortBreakMinutes}
              onChange={(event) => updateSettings("shortBreakMinutes", Number(event.target.value))}
            />
          </label>
          <label>
            长休分钟
            <input
              type="number"
              min="5"
              max="60"
              value={state.settings.longBreakMinutes}
              onChange={(event) => updateSettings("longBreakMinutes", Number(event.target.value))}
            />
          </label>
          <label>
            长休间隔
            <input
              type="number"
              min="2"
              max="8"
              value={state.settings.longBreakEvery}
              onChange={(event) => updateSettings("longBreakEvery", Number(event.target.value))}
            />
          </label>
        </div>
        <div className="toggle-row">
          <label>
            <input
              type="checkbox"
              checked={state.settings.strictModeEnabled}
              onChange={(event) => updateSettings("strictModeEnabled", event.target.checked)}
            />
            专注时自动启用严格模式
          </label>
          <label>
            <input
              type="checkbox"
              checked={state.settings.autoStartBreaks}
              onChange={(event) => updateSettings("autoStartBreaks", event.target.checked)}
            />
            自动开始休息
          </label>
        </div>
        <div className="notification-grid">
          <label className="inline-toggle">
            <input
              type="checkbox"
              checked={state.settings.notificationsEnabled}
              onChange={(event) => updateSettings("notificationsEnabled", event.target.checked)}
            />
            系统通知
          </label>
          <label className="inline-toggle">
            <input
              type="checkbox"
              checked={state.settings.soundEnabled}
              onChange={(event) => updateSettings("soundEnabled", event.target.checked)}
            />
            声音
          </label>
          <label>
            结束音效
            <select value={state.settings.timerEndSound} onChange={(event) => updateSettings("timerEndSound", event.target.value as AppState["settings"]["timerEndSound"])}>
              <option value="soft">柔和</option>
              <option value="bell">铃声</option>
              <option value="digital">电子</option>
            </select>
          </label>
          <label>
            白噪音
            <select value={state.settings.whiteNoise} onChange={(event) => updateSettings("whiteNoise", event.target.value as AppState["settings"]["whiteNoise"])}>
              <option value="off">关闭</option>
              <option value="rain">雨声</option>
              <option value="brown">棕噪音</option>
              <option value="cafe">咖啡馆</option>
            </select>
          </label>
          <label>
            音量
            <input
              type="range"
              min="0"
              max="100"
              value={state.settings.whiteNoiseVolume}
              onChange={(event) => updateSettings("whiteNoiseVolume", Number(event.target.value))}
            />
          </label>
          <button className="secondary-button" onClick={() => void askNotificationPermissions()}>
            <Bell size={16} />
            检查通知
          </button>
        </div>
        <p className="muted">通知权限：{state.settings.notificationSettings.permissionState}</p>
      </section>

      <section className="band settings-panel strict-config">
        <div className="section-title">
          <div>
            <p className="eyebrow">Apple First</p>
            <h2>软严格模式配置</h2>
          </div>
          <ShieldCheck size={20} />
        </div>
        {activeProfile && (
          <>
            <label>
              方案名称
              <input
                value={activeProfile.name}
                onChange={(event) => updateProfile({ ...activeProfile, name: event.target.value, updatedAt: nowIso() })}
              />
            </label>
            <label>
              屏蔽 App
              <textarea value={activeProfile.apps.join("\n")} onChange={(event) => editProfileList("apps", event.target.value)} />
            </label>
            <label>
              屏蔽网站
              <textarea
                value={activeProfile.websites.join("\n")}
                onChange={(event) => editProfileList("websites", event.target.value)}
              />
            </label>
            <label>
              强度
              <select
                value={activeProfile.strictness}
                onChange={(event) =>
                  updateProfile({ ...activeProfile, strictness: event.target.value as BlockProfile["strictness"], updatedAt: nowIso() })
                }
              >
                <option value="soft">软严格</option>
                <option value="balanced">违规暂停确认</option>
                <option value="locked">连续违规作废</option>
              </select>
            </label>
            <div className="strict-behavior">
              <p><strong>软严格：</strong>只记录违规，不打断当前番茄。</p>
              <p><strong>违规暂停：</strong>检测到分心源后暂停计时，需要用户确认再继续。</p>
              <p><strong>连续违规作废：</strong>同一番茄连续 3 次命中后自动作废。</p>
            </div>
          </>
        )}
        <button className="primary-button" onClick={() => void props.askPermissions()}>
          <ShieldQuestion size={16} />
          检查权限
        </button>
        <div className="permission-checklist">
          <span className={strictStatus?.permission_state === "granted" ? "ok" : ""}>辅助功能权限</span>
          <span className={supportsSystemChecks ? "ok" : ""}>
            前台 App 检测：{supportsSystemChecks ? "可用" : "未启用"}
          </span>
          <span className={supportsUrlChecks ? "ok" : ""}>Chrome/Safari URL 读取：{supportsUrlChecks ? "可用" : "未启用"}</span>
        </div>
        <p className="muted">
          {strictStatus?.message ??
            "浏览器预览仅支持软降级记录；Tauri 仅在有权限时做前台/App 监测与可选 URL 检测。"}
        </p>
      </section>

      <section className="band settings-panel data-management">
        <div className="section-title">
          <div>
            <p className="eyebrow">Data Trust</p>
            <h2>数据管理</h2>
          </div>
          <DatabaseBackup size={20} />
        </div>
        <p className="muted">导入前会自动下载当前完整 JSON 备份；CSV 用于人工审计，不建议作为恢复来源。</p>
        <div className="button-row">
          <button className="primary-button" onClick={exportJson}>
            <Download size={16} />
            导出完整 JSON
          </button>
          <button className="secondary-button" onClick={exportCsv}>
            <Download size={16} />
            导出 CSV
          </button>
          <button className="secondary-button" onClick={() => importInputRef.current?.click()}>
            <Upload size={16} />
            选择 JSON 导入
          </button>
          <input
            ref={importInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden-file-input"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void previewImportFile(file);
              event.currentTarget.value = "";
            }}
          />
        </div>
        {importSummary && (
          <div className={importSummary.valid ? "import-summary" : "import-summary invalid"}>
            <strong>{importSummary.message}</strong>
            <span>
              任务 {importSummary.taskCount} · 番茄 {importSummary.sessionCount} · 计划 {importSummary.planCount} · 中断 {importSummary.interruptionCount}
            </span>
            <small>
              与当前相比：任务 {importSummary.taskDelta >= 0 ? "+" : ""}{importSummary.taskDelta} · 番茄 {importSummary.sessionDelta >= 0 ? "+" : ""}{importSummary.sessionDelta} · 计划 {importSummary.planDelta >= 0 ? "+" : ""}{importSummary.planDelta}
            </small>
            {importSummary.warnings.map((warning) => (
              <small key={warning}>{warning}</small>
            ))}
            <button className="primary-button" disabled={!importSummary.valid} onClick={confirmImport}>
              确认导入
            </button>
          </div>
        )}
        <div className="backup-list">
          {state.backupSnapshots.slice(0, 4).map((backup) => (
            <article className="backup-item" key={backup.id}>
              <strong>{new Date(backup.createdAt).toLocaleString()}</strong>
              <span>{backup.reason === "before_import" ? "导入前备份" : backup.reason === "manual_export" ? "手动导出" : "自动备份"}</span>
              <small>任务 {backup.taskCount} · 番茄 {backup.sessionCount} · 计划 {backup.planCount}</small>
              <button className="small-button" disabled={!backup.payload} onClick={() => restoreBackup(backup.id)}>
                恢复
              </button>
            </article>
          ))}
          {!state.backupSnapshots.length && <p className="empty">还没有备份记录。</p>}
        </div>
      </section>

      <section className="band settings-panel">
        <div className="section-title">
          <div>
            <p className="eyebrow">Cloud Sync</p>
            <h2>同步配置向导</h2>
          </div>
          <Cloud size={20} />
        </div>
        <div className="sync-steps">
          <span className="active">1 服务地址</span>
          <span className={state.sync.status !== "idle" ? "active" : ""}>2 健康检查</span>
          <span className={state.sync.token ? "active" : ""}>3 登录</span>
          <span className={state.sync.lastSyncedAt ? "active" : ""}>4 同步</span>
          <span className={state.sync.autoSync ? "active" : ""}>5 自动同步</span>
        </div>
        <div className="sync-grid">
          <label>
            服务地址
            <input
              value={state.sync.serverUrl}
              onChange={(event) => updateSyncSetting("serverUrl", event.target.value)}
              placeholder="http://127.0.0.1:8787"
            />
          </label>
          <label>
            账号
            <input value={state.sync.username} onChange={(event) => updateSyncSetting("username", event.target.value)} />
          </label>
          <label>
            密码
            <input type="password" value={syncPassword} onChange={(event) => setSyncPassword(event.target.value)} />
          </label>
          <label>
            设备 ID
            <input value={state.sync.deviceId} onChange={(event) => updateSyncSetting("deviceId", event.target.value)} />
          </label>
        </div>
        <div className="sync-actions">
          <button
            className="secondary-button"
            disabled={state.sync.status === "syncing"}
            onClick={() => void checkSyncHealth()}
          >
            <Cloud size={16} />
            检查服务
          </button>
          <button
            className="primary-button"
            disabled={state.sync.status === "authenticating"}
            onClick={() => void handleSyncLogin()}
          >
            <LogIn size={16} />
            登录同步服务
          </button>
          <button
            className="secondary-button"
            disabled={!state.sync.token || state.sync.status === "syncing"}
            onClick={() => void handleSyncNow()}
          >
              <RefreshCw size={16} />
            立即同步
          </button>
          <label className="inline-toggle">
            <input
              type="checkbox"
              checked={state.sync.autoSync}
              onChange={(event) => updateSyncSetting("autoSync", event.target.checked)}
            />
            自动同步
          </label>
          <button className="secondary-button" onClick={() => void runSyncDiagnostics()}>
            <Server size={16} />
            运行同步诊断
          </button>
          <label className="compact-input">
            间隔秒
            <input
              type="number"
              min="30"
              max="3600"
              value={state.sync.intervalSeconds}
              onChange={(event) => updateSyncSetting("intervalSeconds", Number(event.target.value))}
            />
          </label>
          <span className={`sync-status sync-status-${state.sync.status}`}>
            {state.sync.status === "synced"
              ? "已同步"
              : state.sync.status === "syncing"
                ? "同步中"
                : state.sync.status === "authenticating"
                  ? "登录中"
                  : state.sync.status === "error"
                    ? "异常"
                    : "待连接"}
          </span>
        </div>
        <p className="muted">{state.sync.message}</p>
        {syncDiagnostic && (
          <div className="diagnostic-panel">
            <strong>诊断结果：{new Date(syncDiagnostic.checkedAt).toLocaleString()}</strong>
            <span>远端 revision {syncDiagnostic.remoteRevision ?? 0} · 冲突 {syncDiagnostic.conflictCount}</span>
            {syncDiagnostic.steps.map((step) => (
              <article className={step.ok ? "diagnostic-step ok" : "diagnostic-step"} key={step.id}>
                <strong>{step.label}</strong>
                <span>{step.detail}</span>
                {step.latencyMs !== undefined && <small>{step.latencyMs}ms</small>}
              </article>
            ))}
          </div>
        )}
        <div className="deploy-helper">
          <div className="section-title compact-title">
            <div>
              <p className="eyebrow">Deploy Helper</p>
              <h2>自建服务器部署提示</h2>
            </div>
          </div>
          <div className="deploy-grid">
            <DeployBlock title="Linux" commands={commands.linux} />
            <DeployBlock title="Windows" commands={commands.windows} />
          </div>
          <p className="muted">{commands.proxy[0]}</p>
          <p className="muted">{commands.dataPath} 建议定时备份数据文件和配置文件。</p>
        </div>
        <button className="link-button" onClick={() => updateSettings("advancedSyncVisible", !state.settings.advancedSyncVisible)}>
          {state.settings.advancedSyncVisible ? "收起高级状态" : "展开高级状态"}
        </button>
        {state.settings.advancedSyncVisible && (
          <>
            <div className="sync-table">
              <span>任务</span>
              <strong>{state.tasks.length}</strong>
              <span>番茄记录</span>
              <strong>{state.focusSessions.length}</strong>
              <span>中断</span>
              <strong>{state.interruptions.length}</strong>
              <span>远端版本</span>
              <strong>{state.sync.lastPulledRevision}</strong>
              <span>冲突</span>
              <strong>{state.sync.conflictCount}</strong>
              <span>上次同步</span>
              <strong>{state.sync.lastSyncedAt ? new Date(state.sync.lastSyncedAt).toLocaleTimeString() : "未同步"}</strong>
              <span>重试次数</span>
              <strong>{state.sync.retryCount}</strong>
              <span>下次重试</span>
              <strong>{state.sync.nextRetryAt ? new Date(state.sync.nextRetryAt).toLocaleTimeString() : "无"}</strong>
            </div>
            <div className="conflict-list">
              {state.sync.conflicts.slice(0, 5).map((conflict) => (
                <article className="conflict-item" key={`${conflict.entity}-${conflict.id}-${conflict.revision}`}>
                  <strong>
                    {conflict.entity}/{conflict.id}
                  </strong>
                  <span>远端版本 {conflict.revision}</span>
                  <small>
                    本地 {conflict.localUpdatedAt ? new Date(conflict.localUpdatedAt).toLocaleString() : "无"} · 远端{" "}
                    {new Date(conflict.remoteUpdatedAt).toLocaleString()}
                  </small>
                  {conflict.remotePayload !== undefined && (
                    <details className="conflict-detail">
                      <summary>远端详情</summary>
                      <pre>{JSON.stringify(conflict.remotePayload, null, 2).slice(0, 1200)}</pre>
                    </details>
                  )}
                  <div className="button-row">
                    <button className="small-button" onClick={() => resolveSyncConflict(conflict, "local")}>保留本地</button>
                    <button className="small-button" onClick={() => resolveSyncConflict(conflict, "remote")}>使用远端</button>
                    <button className="small-button" onClick={() => resolveSyncConflict(conflict, "later")}>稍后处理</button>
                  </div>
                </article>
              ))}
              {state.sync.conflicts.length === 0 && <p className="empty">暂无同步冲突。</p>}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function DeployBlock({ title, commands }: { title: string; commands: string[] }) {
  return (
    <article className="deploy-block">
      <strong>{title}</strong>
      {commands.map((command) => (
        <code key={command}>{command}</code>
      ))}
    </article>
  );
}
