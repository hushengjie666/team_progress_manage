export interface ServerAccount {
  id: string;
  workspace_id: string;
  name: string;
  email: string;
  disabled_at?: string;
  created_at: string;
  updated_at: string;
}

export interface ServerWorkspace {
  id: string;
  name: string;
  type?: "private" | "shared";
  owner_account_id?: string;
  created_at: string;
  updated_at: string;
}

export interface ServerWorkspaceMembership {
  id: string;
  workspace_id: string;
  account_id: string;
  name: string;
  email: string;
  role: "owner" | "admin" | "member";
  status: "active" | "disabled";
  created_at: string;
  updated_at: string;
}
