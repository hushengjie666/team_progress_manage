import type { ProjectMember } from "./types";
import type { ServerAccount } from "./teamBackendCoreTypes";
import type { BusinessRow } from "./teamBusinessRows";

export interface MemberAccountPayload {
  workspaceId?: string;
  projectId?: string;
  name: string;
  email: string;
  password: string;
  roles: ProjectMember["roles"];
  status?: "active" | "disabled";
  expectedRevision?: number;
}

export interface MemberResponse {
  member: BusinessRow;
}

export interface PlatformAccountsResponse {
  accounts: ServerAccount[];
}

export interface PlatformAccountResponse {
  account: ServerAccount;
}

export interface PlatformAccountPayload {
  name?: string;
  email?: string;
  password?: string;
  status?: "active" | "disabled";
  expectedRevision?: number;
}
