import { Sparkles } from "lucide-react";
import type { Account, ProjectMember } from "../../types";
import { SettingsAccountCard } from "./SettingsAccountCard";
import { SettingsAccountCreatePanel } from "./SettingsAccountCreatePanel";

export function SettingsMembersSection({
  accounts,
  projectMembers,
  createAccount,
  updateAccount,
  updateAccountPassword,
  disableAccount,
}: {
  accounts: Account[];
  projectMembers: ProjectMember[];
  createAccount: (name: string, email: string, password?: string) => void;
  updateAccount: (account: Account) => void;
  updateAccountPassword: (account: Account, password: string) => void;
  disableAccount: (accountId: string) => void;
}) {
  const activeAccounts = accounts.filter((account) => !account.disabledAt);

  return (
    <section className="band settings-panel">
      <div className="section-title">
        <div>
          <p className="eyebrow">账号管理</p>
          <h2>平台账号库</h2>
        </div>
        <Sparkles size={20} />
      </div>
      <p className="muted section-helper">
        这里统一创建和维护可登录系统的平台账号。协作工作区成员关系在“工作区”页面维护，项目内角色在项目页面绑定。
      </p>
      <SettingsAccountCreatePanel accounts={activeAccounts} createAccount={createAccount} />
      <div className="member-directory">
        {activeAccounts.map((account) => (
          <SettingsAccountCard
            key={account.id}
            account={account}
            accounts={activeAccounts}
            projectCount={projectMembers.filter((binding) => binding.status !== "disabled" && binding.accountId === account.id).length}
            updateAccount={updateAccount}
            updateAccountPassword={updateAccountPassword}
            disableAccount={() => disableAccount(account.id)}
          />
        ))}
        {!activeAccounts.length && <p className="empty">还没有平台账号，请先创建账号。</p>}
      </div>
    </section>
  );
}
