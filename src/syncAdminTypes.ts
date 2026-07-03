import type { ProjectMember } from "./types";
import type { ServerAccount } from "./syncServerCoreTypes";
import type { SyncRow } from "./syncPayloadTypes";

export interface MemberAccountPayload {
  workspaceId?: string;
  projectId?: string;
  name: string;
  email: string;
  password: string;
  roles: ProjectMember["roles"];
  status?: "active" | "disabled";
}

export interface MemberResponse {
  member: SyncRow;
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
}
