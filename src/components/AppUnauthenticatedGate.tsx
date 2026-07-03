import { readRememberedAuth } from "../rememberedAuth";
import type { AuthStatus } from "../types";
import { AuthGate } from "./AuthGate";

export function AppUnauthenticatedGate({
  status,
  serverUrl,
  message,
  suppressAutoLogin,
  updateServerUrl,
  checkStatus,
  login,
}: {
  status: AuthStatus;
  serverUrl: string;
  message: string;
  suppressAutoLogin: boolean;
  updateServerUrl: (serverUrl: string) => void;
  checkStatus: () => Promise<void>;
  login: (email: string, password: string, remember: boolean) => Promise<void>;
}) {
  const rememberedAuth = readRememberedAuth(serverUrl);

  return (
    <AuthGate
      status={status}
      serverUrl={serverUrl}
      message={message}
      initialEmail={rememberedAuth?.email}
      initialPassword={rememberedAuth?.password}
      autoLogin={Boolean(rememberedAuth?.email && rememberedAuth.password) && !suppressAutoLogin}
      updateServerUrl={updateServerUrl}
      checkStatus={checkStatus}
      login={login}
    />
  );
}
