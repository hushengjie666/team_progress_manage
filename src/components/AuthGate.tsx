import { LogIn, Server, Users } from "lucide-react";
import { useState } from "react";
import type { AuthStatus } from "../types";

export function AuthGate(props: {
  status: AuthStatus;
  bootstrapped?: boolean;
  serverUrl: string;
  message: string;
  updateServerUrl: (serverUrl: string) => void;
  checkStatus: () => Promise<void>;
  bootstrap: (payload: { workspaceName: string; name: string; email: string; password: string }) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
}) {
  const [workspaceName, setWorkspaceName] = useState("默认团队");
  const [name, setName] = useState("项目负责人");
  const [email, setEmail] = useState("owner@example.com");
  const [password, setPassword] = useState("demo");
  const busy = props.status === "checking";
  const needsBootstrap = props.bootstrapped === false;
  const submitAuth = () =>
    needsBootstrap
      ? props.bootstrap({ workspaceName, name, email, password })
      : props.login(email, password);

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <div className="auth-mark">
          {needsBootstrap ? <Users size={28} /> : <LogIn size={28} />}
        </div>
        <p className="eyebrow">团队进度管控</p>
        <h1>{needsBootstrap ? "初始化团队工作区" : "登录团队工作区"}</h1>
        <p className="muted">{props.message}</p>

        <form
          className="auth-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (!busy) void submitAuth();
          }}
        >
          <label>
            服务地址
            <div className="auth-inline">
              <input value={props.serverUrl} onChange={(event) => props.updateServerUrl(event.target.value)} />
              <button type="button" className="icon-button" title="检查服务" disabled={busy} onClick={() => void props.checkStatus()}>
                <Server size={18} />
              </button>
            </div>
          </label>

          {needsBootstrap && (
            <label>
              团队名称
              <input value={workspaceName} onChange={(event) => setWorkspaceName(event.target.value)} />
            </label>
          )}

          {needsBootstrap && (
            <label>
              姓名
              <input value={name} onChange={(event) => setName(event.target.value)} />
            </label>
          )}
          <label>
            {needsBootstrap ? "负责人登录邮箱或手机号" : "登录邮箱或手机号"}
            <input value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label>
            密码
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>

          <button type="submit" className="primary-button large" disabled={busy}>
            {needsBootstrap ? "创建团队并登录" : "登录"}
          </button>
        </form>
      </section>
    </main>
  );
}
