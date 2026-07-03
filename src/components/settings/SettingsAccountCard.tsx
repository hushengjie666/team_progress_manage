import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import type { Account } from "../../types";

export function SettingsAccountCard({
  account,
  accounts,
  projectCount,
  updateAccount,
  updateAccountPassword,
  disableAccount,
}: {
  account: Account;
  accounts: Account[];
  projectCount: number;
  updateAccount: (account: Account) => void;
  updateAccountPassword: (account: Account, password: string) => void;
  disableAccount: () => void;
}) {
  const [draft, setDraft] = useState({ name: account.name, email: account.email });
  const [passwordDraft, setPasswordDraft] = useState("");
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

  const updatePassword = () => {
    updateAccountPassword(account, passwordDraft);
    setPasswordDraft("");
  };

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
            onChange={(event) => setPasswordDraft(event.target.value)}
          />
        </label>
        <button className="secondary-button" disabled={!passwordDraft.trim()} onClick={updatePassword}>
          修改密码
        </button>
      </div>
    </article>
  );
}
