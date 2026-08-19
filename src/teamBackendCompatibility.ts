import { releaseContract } from "./releaseContract";
import { apiUrl, requestJson, TeamHttpError } from "./teamBackendHttp";

export type BackendCompatibilityCode =
  | "compatible"
  | "server_version_contract_missing"
  | "server_unhealthy"
  | "api_protocol_mismatch"
  | "client_release_too_old"
  | "database_schema_behind"
  | "database_schema_ahead"
  | "database_schema_mismatch"
  | "bootstrap_endpoint_missing"
  | "client_upgrade_required";

export type BackendCompatibilityState = {
  code: BackendCompatibilityCode;
  message: string;
  clientReleaseVersion: string;
  clientApiProtocolVersion: number;
  serverReleaseVersion?: string;
  serverApiProtocolVersion?: number;
  serverDatabaseSchemaVersion?: number;
  minimumClientRelease?: string;
};

export type BackendHealthResponse = {
  status?: string;
  service?: string;
  release_version?: string;
  api_protocol_version?: number;
  database_schema_version?: number;
  minimum_client_release?: string;
};

export type BackendVersionSummary = {
  versionsMatch: boolean;
  serverReleaseVersion?: string;
  serverApiProtocolVersion?: number;
  serverDatabaseSchemaVersion?: number;
};

export const backendVersionSummary = (backend: { compatibility?: BackendCompatibilityState }): BackendVersionSummary => {
  const state = backend.compatibility;
  return {
    versionsMatch: state?.code === "compatible",
    serverReleaseVersion: state?.serverReleaseVersion,
    serverApiProtocolVersion: state?.serverApiProtocolVersion,
    serverDatabaseSchemaVersion: state?.serverDatabaseSchemaVersion,
  };
};

export class TeamBackendCompatibilityError extends Error {
  constructor(public readonly details: BackendCompatibilityState) {
    super(details.message);
    this.name = "TeamBackendCompatibilityError";
  }
}

export const isTeamBackendCompatibilityError = (error: unknown): error is TeamBackendCompatibilityError =>
  error instanceof TeamBackendCompatibilityError;

const releaseParts = (value: string) => {
  const parts = value.trim().replace(/^v/, "").split(".");
  if (parts.length !== 3 || parts.some((part) => !/^\d+$/.test(part))) return undefined;
  return parts.map(Number);
};

const releaseAtLeast = (actual: string, minimum: string) => {
  const actualParts = releaseParts(actual);
  const minimumParts = releaseParts(minimum);
  if (!actualParts || !minimumParts) return false;
  for (let index = 0; index < actualParts.length; index += 1) {
    if (actualParts[index] !== minimumParts[index]) return actualParts[index] > minimumParts[index];
  }
  return true;
};

const compatibilityState = (
  code: BackendCompatibilityCode,
  message: string,
  health: BackendHealthResponse = {},
): BackendCompatibilityState => ({
  code,
  message,
  clientReleaseVersion: releaseContract.releaseVersion,
  clientApiProtocolVersion: releaseContract.apiProtocolVersion,
  serverReleaseVersion: health.release_version,
  serverApiProtocolVersion: health.api_protocol_version,
  serverDatabaseSchemaVersion: health.database_schema_version,
  minimumClientRelease: health.minimum_client_release,
});

export const compatibilityStateForHttpError = (error: TeamHttpError): BackendCompatibilityState =>
  compatibilityState(
    error.code === "client_upgrade_required" ? "client_upgrade_required" : "bootstrap_endpoint_missing",
    error.code === "client_upgrade_required"
      ? "服务器拒绝了当前客户端协议，请升级 TimeManage 桌面端"
      : "服务器缺少新版业务接口，请同时升级后台和桌面端",
    {
      release_version: typeof error.details?.server_release === "string" ? error.details.server_release : undefined,
      api_protocol_version: typeof error.details?.api_protocol_version === "number" ? error.details.api_protocol_version : undefined,
      minimum_client_release: typeof error.details?.required_client_release === "string" ? error.details.required_client_release : undefined,
    },
  );

export const validateBackendHealth = (health: BackendHealthResponse): BackendCompatibilityState => {
  if (
    typeof health.release_version !== "string" ||
    typeof health.api_protocol_version !== "number" ||
    !Number.isInteger(health.api_protocol_version) ||
    typeof health.database_schema_version !== "number" ||
    !Number.isInteger(health.database_schema_version) ||
    typeof health.minimum_client_release !== "string"
  ) {
    return compatibilityState("server_version_contract_missing", "后台版本过旧或未提供版本合同，请升级团队后台", health);
  }
  const serverApiProtocolVersion = health.api_protocol_version;
  const serverDatabaseSchemaVersion = health.database_schema_version;
  const minimumClientRelease = health.minimum_client_release;
  if (health.status !== "ok") return compatibilityState("server_unhealthy", "团队后台健康检查未通过，请先检查后台服务", health);
  if (serverApiProtocolVersion !== releaseContract.apiProtocolVersion) {
    return compatibilityState("api_protocol_mismatch", "客户端与后台 API 协议不一致，请同时升级两端", health);
  }
  if (!releaseAtLeast(releaseContract.releaseVersion, minimumClientRelease)) {
    return compatibilityState("client_release_too_old", "当前桌面端版本过低，请升级 TimeManage", health);
  }
  if (serverDatabaseSchemaVersion > releaseContract.databaseSchemaVersion) {
    return compatibilityState("database_schema_ahead", "后台数据库版本高于当前客户端支持范围，请升级桌面端", health);
  }
  if (serverDatabaseSchemaVersion < releaseContract.databaseSchemaVersion) {
    return compatibilityState("database_schema_behind", "后台数据库尚未完成迁移，请先升级后台并执行数据库迁移", health);
  }
  return compatibilityState("compatible", "后台版本兼容", health);
};

export async function checkBackendCompatibility(serverUrl: string): Promise<BackendCompatibilityState> {
  let health: BackendHealthResponse;
  try {
    health = await requestJson<BackendHealthResponse>(apiUrl(serverUrl, "/health"));
  } catch (error) {
    if (error instanceof TeamHttpError && error.status === 426) {
      throw new TeamBackendCompatibilityError(compatibilityStateForHttpError(error));
    }
    throw error;
  }
  const result = validateBackendHealth(health);
  if (result.code !== "compatible") {
    throw new TeamBackendCompatibilityError(result);
  }
  return result;
}
