import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";

export class AppErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("TimeManage page failed", error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="auth-shell">
        <section className="auth-panel" role="alert">
          <h1>页面暂时无法显示</h1>
          <p>请重新加载，恢复团队数据和当前计时。</p>
          <button className="primary-button" onClick={() => window.location.reload()}>重新加载</button>
        </section>
      </main>
    );
  }
}
