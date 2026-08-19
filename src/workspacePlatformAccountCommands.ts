import {
  createPlatformAccount as createPlatformAccountRequest,
  updatePlatformAccount as updatePlatformAccountRequest,
} from "./teamBackend";
import type { Account } from "./types";
import { platformAccountAdminToken, requirePlatformAccountAdminSource } from "./workspacePlatformAccountAccess";
import type { WorkspaceAccountRuntimeOptions } from "./workspaceAccountTypes";
import type { createWorkspacePlatformAccountRefresh } from "./workspacePlatformAccountRefresh";

type WorkspacePlatformAccountRefresh = ReturnType<typeof createWorkspacePlatformAccountRefresh>;

type WorkspacePlatformAccountCommandOptions = Pick<
  WorkspaceAccountRuntimeOptions,
  "getState" | "setToast" | "getPlatformAccounts" | "setPlatformAccounts"
> & WorkspacePlatformAccountRefresh;

export function createWorkspacePlatformAccountCommands({
  getState,
  setToast,
  setPlatformAccounts,
  getPlatformAccounts = () => [],
}: WorkspacePlatformAccountCommandOptions) {
  const createPlatformAccount = (name: string, email: string, password = "1234") => {
    const source = requirePlatformAccountAdminSource(getState(), setToast, "创建平台账号");
    if (!source) return;
    const token = platformAccountAdminToken(source);
    const normalizedEmail = email.trim().toLowerCase();
    if (!token) {
      setToast("请先登录后台后再创建平台账号");
      return;
    }
    if (!name.trim() || !normalizedEmail || !password.trim()) {
      setToast("请填写账号姓名、登录邮箱或手机号和初始密码");
      return;
    }
    void createPlatformAccountRequest(source.backend, token, {
      name: name.trim(),
      email: normalizedEmail,
      password,
      status: "active",
    })
      .then((account) => setPlatformAccounts([account, ...getPlatformAccounts().filter((item) => item.id !== account.id)]))
      .then(() => setToast("平台账号已创建，可在工作区或项目中授权使用"))
      .catch((error) => {
        setToast(error instanceof Error ? error.message : "平台账号创建失败");
      });
  };

  const updatePlatformAccountProfile = (account: Account) => {
    const source = requirePlatformAccountAdminSource(getState(), setToast, "修改平台账号");
    if (!source) return;
    const normalizedEmail = account.email.trim().toLowerCase();
    const normalizedName = account.name.trim();
    if (!normalizedName) {
      setToast("请输入成员姓名");
      return;
    }
    if (!normalizedEmail) {
      setToast("请输入登录邮箱或手机号");
      return;
    }
    const token = platformAccountAdminToken(source);
    if (getPlatformAccounts().some((item) => item.id !== account.id && item.email.trim().toLowerCase() === normalizedEmail)) {
      setToast("该登录邮箱或手机号已存在于平台账号库，请勿重复使用");
      return;
    }
    if (!token) {
      setToast("请先登录后台后再修改平台账号");
      return;
    }
    void updatePlatformAccountRequest(source.backend, token, account.id, { name: normalizedName, email: normalizedEmail })
      .then((updated) => setPlatformAccounts(getPlatformAccounts().map((item) => item.id === updated.id ? updated : item)))
      .then(() => setToast("平台账号资料已保存"))
      .catch((error) => {
        setToast(error instanceof Error ? error.message : "平台账号资料保存失败");
      });
  };

  const disablePlatformAccount = (accountId: string) => {
    const source = requirePlatformAccountAdminSource(getState(), setToast, "停用平台账号");
    if (!source) return;
    const account = getPlatformAccounts().find((item) => item.id === accountId);
    if (!account) return;
    if (account.id === source.auth.account?.id) {
      setToast("不能删除当前登录账号");
      return;
    }
    const confirmed = window.confirm(`确定停用平台账号「${account.name}」吗？停用后该账号将无法登录系统。`);
    if (!confirmed) return;
    const token = platformAccountAdminToken(source);
    if (!token) {
      setToast("请先登录后台后再停用平台账号");
      return;
    }
    void updatePlatformAccountRequest(source.backend, token, account.id, { status: "disabled" })
      .then((updated) => setPlatformAccounts(getPlatformAccounts().map((item) => item.id === updated.id ? updated : item)))
      .then(() => setToast("平台账号已停用"))
      .catch((error) => {
        setToast(error instanceof Error ? error.message : "平台账号停用失败");
      });
  };

  const updatePlatformAccountPassword = (account: Account, password: string) => {
    const source = requirePlatformAccountAdminSource(getState(), setToast, "修改平台账号密码");
    if (!source) return;
    const token = platformAccountAdminToken(source);
    if (!token) {
      setToast("请先登录后台后再修改平台账号密码");
      return;
    }
    if (!password.trim()) {
      setToast("请输入新密码");
      return;
    }
    void updatePlatformAccountRequest(source.backend, token, account.id, { password })
      .then((updated) => setPlatformAccounts(getPlatformAccounts().map((item) => item.id === updated.id ? updated : item)))
      .then(() => setToast("平台账号密码已更新"))
      .catch((error) => {
        setToast(error instanceof Error ? error.message : "平台账号密码更新失败");
      });
  };

  return {
    createPlatformAccount,
    updatePlatformAccountProfile,
    disablePlatformAccount,
    updatePlatformAccountPassword,
  };
}
