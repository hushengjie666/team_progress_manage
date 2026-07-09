import { LogIn } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { normalizeAuthMessage } from "../appBoot";
import type { AuthStatus } from "../types";

export function AuthGate(props: {
  status: AuthStatus;
  serverUrl: string;
  message: string;
  initialEmail?: string;
  initialPassword?: string;
  autoLogin?: boolean;
  updateServerUrl: (serverUrl: string) => void;
  login: (email: string, password: string, remember: boolean) => Promise<void>;
}) {
  const [email, setEmail] = useState(props.initialEmail ?? "");
  const [password, setPassword] = useState(props.initialPassword ?? "");
  const [remember, setRemember] = useState(Boolean(props.initialEmail));
  const autoLoginKeyRef = useRef("");
  const busy = props.status === "checking";
  const submitAuth = () => props.login(email, password, remember);

  useEffect(() => {
    setEmail(props.initialEmail ?? "");
    setPassword(props.initialPassword ?? "");
    setRemember(Boolean(props.initialEmail));
  }, [props.serverUrl, props.initialEmail, props.initialPassword]);

  useEffect(() => {
    if (!props.autoLogin || busy || props.status !== "signed_out") return;
    if (!email.trim() || !password) return;
    const autoLoginKey = `${props.serverUrl}|${email}`;
    if (autoLoginKeyRef.current === autoLoginKey) return;
    autoLoginKeyRef.current = autoLoginKey;
    void props.login(email, password, true);
  }, [busy, email, password, props.autoLogin, props.serverUrl, props.status]);

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <div className="auth-mark">
          <LogIn size={28} />
        </div>
        <p className="eyebrow">团队进度管控</p>
        <h1>登录账号</h1>
        <p className="muted">{normalizeAuthMessage(props.message)}</p>

        <form
          className="auth-form"
          autoComplete="off"
          onSubmit={(event) => {
            event.preventDefault();
            if (!busy) void submitAuth();
          }}
        >
          <label>
            服务地址
            <input value={props.serverUrl} onChange={(event) => props.updateServerUrl(event.target.value)} />
          </label>

          <label>
            登录邮箱或手机号
            <input autoComplete="off" value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label>
            密码
            <input autoComplete="off" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
          <label className="auth-remember">
            <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />
            记住账号
          </label>

          <button type="submit" className="primary-button large" disabled={busy}>
            登录
          </button>
        </form>
      </section>
    </main>
  );
}
