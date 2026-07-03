import { useState } from "react";
import type { Account } from "../../types";

type MemberDraft = {
  name: string;
  email: string;
  password: string;
};

const emptyMemberDraft = (): MemberDraft => ({ name: "", email: "", password: "1234" });

export function SettingsAccountCreatePanel({
  accounts,
  createAccount,
}: {
  accounts: Account[];
  createAccount: (name: string, email: string, password?: string) => void;
}) {
  const [memberDraft, setMemberDraft] = useState(emptyMemberDraft);
  const [memberDraftWarning, setMemberDraftWarning] = useState("");
  const normalizedMemberDraftEmail = memberDraft.email.trim().toLowerCase();
  const memberDraftEmailExists = Boolean(
    normalizedMemberDraftEmail &&
      accounts.some((account) => account.email.trim().toLowerCase() === normalizedMemberDraftEmail),
  );
  const memberDraftValidationMessage = memberDraftEmailExists
    ? "该登录邮箱或手机号已存在于平台账号库，请直接编辑现有账号。"
    : "";

  const updateDraft = (patch: Partial<MemberDraft>) => {
    setMemberDraft({ ...memberDraft, ...patch });
    setMemberDraftWarning("");
  };

  const submitMemberDraft = () => {
    if (!memberDraft.name.trim() || !memberDraft.email.trim() || !memberDraft.password.trim()) {
      setMemberDraftWarning("请先填写成员姓名、登录邮箱或手机号和初始密码。");
      return;
    }
    if (memberDraftEmailExists) {
      setMemberDraftWarning(memberDraftValidationMessage);
      return;
    }
    createAccount(memberDraft.name, memberDraft.email, memberDraft.password);
    setMemberDraft(emptyMemberDraft());
    setMemberDraftWarning("");
  };

  return (
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
          <input value={memberDraft.name} onChange={(event) => updateDraft({ name: event.target.value })} />
        </label>
        <label>
          登录邮箱或手机号
          <input value={memberDraft.email} onChange={(event) => updateDraft({ email: event.target.value })} />
        </label>
        <label>
          初始密码
          <input
            type="password"
            value={memberDraft.password}
            onChange={(event) => updateDraft({ password: event.target.value })}
          />
        </label>
      </div>
      <div className="button-row">
        <button className="primary-button" onClick={submitMemberDraft}>
          创建平台账号
        </button>
      </div>
      {(memberDraftWarning || memberDraftValidationMessage) && (
        <p className="warning-line compact">{memberDraftWarning || memberDraftValidationMessage}</p>
      )}
    </section>
  );
}
