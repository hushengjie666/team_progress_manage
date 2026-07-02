import { Sparkles, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import type { Account, ProjectMember } from "../../types";

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
  const [memberDraft, setMemberDraft] = useState({ name: "", email: "", password: "1234" });
  const [memberDraftWarning, setMemberDraftWarning] = useState("");
  const [memberPasswordDrafts, setMemberPasswordDrafts] = useState<Record<string, string>>({});
  const activeAccounts = accounts.filter((account) => !account.disabledAt);
  const normalizedMemberDraftEmail = memberDraft.email.trim().toLowerCase();
  const memberDraftEmailExists = Boolean(
    normalizedMemberDraftEmail &&
      activeAccounts.some((account) => account.email.trim().toLowerCase() === normalizedMemberDraftEmail),
  );
  const memberDraftValidationMessage = memberDraftEmailExists
    ? "该登录邮箱或手机号已存在于平台账号库，请直接编辑现有账号。"
    : "";

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
      <section className="member-create-panel workspace-member-create">
        <div className="section-title compact-title">
          <div>
            <p className="eyebrow">新增账号</p>
            <h2>创建平台账号</h2>
          </div>
        </div>
        <div className="settings-grid">
          <label>
            成员姓名
            <input
              value={memberDraft.name}
              onChange={(event) => {
                setMemberDraft({ ...memberDraft, name: event.target.value });
                setMemberDraftWarning("");
              }}
            />
          </label>
          <label>
            登录邮箱或手机号
            <input
              value={memberDraft.email}
              onChange={(event) => {
                setMemberDraft({ ...memberDraft, email: event.target.value });
                setMemberDraftWarning("");
              }}
            />
          </label>
          <label>
            初始密码
            <input
              type="password"
              value={memberDraft.password}
              onChange={(event) => {
                setMemberDraft({ ...memberDraft, password: event.target.value });
                setMemberDraftWarning("");
              }}
            />
          </label>
        </div>
        <div className="button-row">
          <button
            className="primary-button"
            onClick={() => {
              if (!memberDraft.name.trim() || !memberDraft.email.trim() || !memberDraft.password.trim()) {
                setMemberDraftWarning("请先填写成员姓名、登录邮箱或手机号和初始密码。");
                return;
              }
              if (memberDraftEmailExists) {
                setMemberDraftWarning(memberDraftValidationMessage);
                return;
              }
              createAccount(memberDraft.name, memberDraft.email, memberDraft.password);
              setMemberDraft({ name: "", email: "", password: "1234" });
              setMemberDraftWarning("");
            }}
          >
            创建平台账号
          </button>
        </div>
        {(memberDraftWarning || memberDraftValidationMessage) && (
          <p className="warning-line compact">{memberDraftWarning || memberDraftValidationMessage}</p>
        )}
      </section>
      <div className="member-directory">
        {activeAccounts.map((account) => (
          <AccountCard
            key={account.id}
            account={account}
            accounts={activeAccounts}
            projectCount={projectMembers.filter((binding) => binding.status !== "disabled" && binding.accountId === account.id).length}
            passwordDraft={memberPasswordDrafts[account.id] ?? ""}
            updateAccount={updateAccount}
            disableAccount={() => disableAccount(account.id)}
            updatePasswordDraft={(password) => setMemberPasswordDrafts({ ...memberPasswordDrafts, [account.id]: password })}
            updatePassword={(password) => {
              updateAccountPassword(account, password);
              setMemberPasswordDrafts({ ...memberPasswordDrafts, [account.id]: "" });
            }}
          />
        ))}
        {!activeAccounts.length && <p className="empty">还没有平台账号，请先创建账号。</p>}
      </div>
    </section>
  );
}

function AccountCard({
  account,
  accounts,
  projectCount,
  updateAccount,
  disableAccount,
  passwordDraft,
  updatePasswordDraft,
  updatePassword,
}: {
  account: Account;
  accounts: Account[];
  projectCount: number;
  updateAccount: (account: Account) => void;
  disableAccount: () => void;
  passwordDraft: string;
  updatePasswordDraft: (password: string) => void;
  updatePassword: (password: string) => void;
}) {
  const [draft, setDraft] = useState({ name: account.name, email: account.email });
  const normalizedEmail = draft.email.trim().toLowerCase();
  const nameValue = draft.name.trim();
  const hasChanges = draft.name !== account.name || draft.email !== account.email;
  const emailDuplicate = Boolean(normalizedEmail) && accounts.some(
    (item) => item.id !== account.id && !item.disabledAt && item.email.trim().toLowerCase() === normalizedEmail,
  );
  const validationMessage = !nameValue
    ? "请输入成员姓名"
    : !normalizedEmail
      ? "请输入登录邮箱或手机号"
      : emailDuplicate
        ? "该登录邮箱或手机号已存在于平台账号库"
        : "";
  const canSave = hasChanges && !validationMessage;

  useEffect(() => {
    setDraft({ name: account.name, email: account.email });
  }, [account.id, account.name, account.email]);

  return (
    <article className="member-card team-member-card" key={account.id}>
      <div className="member-profile-editor">
        <div className="member-card-main">
          <label>
            姓名
            <input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
          </label>
          <label>
            登录邮箱或手机号
            <input value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} />
          </label>
        </div>
        {validationMessage && hasChanges && <p className="member-validation">{validationMessage}</p>}
      </div>
      <div className="member-role-row">
        <span className="status-pill">启用中</span>
        <span className="status-pill">{projectCount} 个项目</span>
        <span className="status-pill">平台账号</span>
        <button
          className="secondary-button"
          disabled={!canSave}
          onClick={() => updateAccount({ ...account, name: nameValue, email: normalizedEmail })}
        >
          保存资料
        </button>
        {hasChanges && (
          <button className="small-button" onClick={() => setDraft({ name: account.name, email: account.email })}>
            重置
          </button>
        )}
        <button className="icon-button small danger" title="停用账号" onClick={disableAccount}>
          <Trash2 size={15} />
        </button>
      </div>
      <div className="member-password-row">
        <label>
          新密码
          <input
            type="password"
            value={passwordDraft}
            placeholder="输入后点击修改"
            onChange={(event) => updatePasswordDraft(event.target.value)}
          />
        </label>
        <button className="secondary-button" disabled={!passwordDraft.trim()} onClick={() => updatePassword(passwordDraft)}>
          修改密码
        </button>
      </div>
    </article>
  );
}
