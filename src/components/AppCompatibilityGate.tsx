import { RefreshCw, ShieldAlert } from "lucide-react";
import { releaseContract } from "../releaseContract";
import type { BackendCompatibilityState } from "../teamBackendCompatibility";

const displayed = (value: string | number | undefined) => (value === undefined ? "未提供" : String(value));

export function AppCompatibilityGate({
  serverUrl,
  compatibility,
  retry,
}: {
  serverUrl: string;
  compatibility?: BackendCompatibilityState;
  retry: () => void;
}) {
  return (
    <main className="auth-shell">
      <section className="auth-panel compatibility-panel">
        <div className="auth-mark compatibility-mark">
          <ShieldAlert size={28} />
        </div>
        <p className="eyebrow">TimeManage 版本检查</p>
        <h1>需要同时升级客户端和后台</h1>
        <p className="muted">
          为避免旧快照覆盖服务器数据，当前版本不兼容时不会进入业务界面，也不会执行创建、修改、删除或计时写入。
        </p>
        <div className="compatibility-details">
          <div><span>服务地址</span><strong>{serverUrl}</strong></div>
          <div><span>当前桌面端</span><strong>v{releaseContract.releaseVersion}</strong></div>
          <div><span>当前 API 协议</span><strong>{releaseContract.apiProtocolVersion}</strong></div>
          <div><span>后台版本</span><strong>{displayed(compatibility?.serverReleaseVersion)}</strong></div>
          <div><span>后台 API 协议</span><strong>{displayed(compatibility?.serverApiProtocolVersion)}</strong></div>
          <div><span>后台数据库版本</span><strong>{displayed(compatibility?.serverDatabaseSchemaVersion)}</strong></div>
          <div><span>要求最低客户端</span><strong>{displayed(compatibility?.minimumClientRelease)}</strong></div>
        </div>
        <p className="compatibility-message">{compatibility?.message ?? "正在等待后台版本信息"}</p>
        <button type="button" className="primary-button large" onClick={retry}>
          <RefreshCw size={17} />
          重新检查
        </button>
      </section>
    </main>
  );
}
