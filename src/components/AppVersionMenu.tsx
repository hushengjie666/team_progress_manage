import { CheckCircle2, RefreshCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { releaseContract } from "../releaseContract";
import { backendVersionSummary } from "../teamBackendCompatibility";
import type { BackendConnectionState } from "../types";

const displayedVersion = (value: string | undefined) => value ? `v${value.replace(/^v/, "")}` : "未提供";

export function AppVersionMenu({ backend }: { backend: BackendConnectionState }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const versionSummary = backendVersionSummary(backend);
  const { versionsMatch } = versionSummary;

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <div className="version-status-menu" ref={menuRef}>
      <button
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={`版本 v${releaseContract.releaseVersion}，${versionsMatch ? "版本匹配" : "查看版本状态"}`}
        className={versionsMatch ? "version-status-trigger matched" : "version-status-trigger"}
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <span className="version-status-dot" aria-hidden="true" />
        <span>v{releaseContract.releaseVersion}</span>
      </button>
      {open && (
        <section className="version-status-popover" role="dialog" aria-label="版本信息">
          <header className="version-status-header">
            <div>
              <p className="eyebrow">TimeManage</p>
              <h3>版本信息</h3>
            </div>
            <span className={versionsMatch ? "version-match-badge matched" : "version-match-badge"}>
              <CheckCircle2 size={14} />
              {versionsMatch ? "版本匹配" : "需要检查"}
            </span>
          </header>
          <dl className="version-status-details">
            <div>
              <dt>本机客户端</dt>
              <dd>v{releaseContract.releaseVersion}</dd>
            </div>
            <div>
              <dt>服务器后台</dt>
              <dd>{displayedVersion(versionSummary.serverReleaseVersion)}</dd>
            </div>
            <div>
              <dt>API 协议</dt>
              <dd>{versionSummary.serverApiProtocolVersion ?? releaseContract.apiProtocolVersion}</dd>
            </div>
            <div>
              <dt>数据库结构</dt>
              <dd>{versionSummary.serverDatabaseSchemaVersion === undefined ? "未提供" : `schema ${versionSummary.serverDatabaseSchemaVersion}`}</dd>
            </div>
          </dl>
          <p className="version-server-url" title={backend.serverUrl}>{backend.serverUrl}</p>
          <button className="secondary-button version-recheck-button" onClick={() => window.location.reload()} type="button">
            <RefreshCw size={15} />
            重新检查版本
          </button>
        </section>
      )}
    </div>
  );
}
