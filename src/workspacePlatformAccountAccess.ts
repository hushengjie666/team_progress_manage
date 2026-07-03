import type { AppState } from "./types";
import { isSuperAdminAccount, tokenForState } from "./workspaceAccountMetadata";

type SetToast = (message: string) => void;

export function platformAccountAdminToken(source: AppState | null | undefined) {
  if (!source || !isSuperAdminAccount(source.auth.account)) return "";
  return tokenForState(source);
}

export function requirePlatformAccountAdminSource(
  source: AppState | null,
  setToast: SetToast,
  actionLabel: string,
) {
  if (!source) {
    setToast(`请先登录后台后再${actionLabel}`);
    return null;
  }
  if (!isSuperAdminAccount(source.auth.account)) {
    setToast(`只有超级管理员可以${actionLabel}`);
    return null;
  }
  return source;
}
