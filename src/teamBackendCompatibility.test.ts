import { afterEach, describe, expect, it, vi } from "vitest";
import { releaseContract } from "./releaseContract";
import {
  checkBackendCompatibility,
  TeamBackendCompatibilityError,
  validateBackendHealth,
} from "./teamBackendCompatibility";

describe("team backend release compatibility", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("accepts the exact release contract", () => {
    const result = validateBackendHealth({
      status: "ok",
      service: "timemanage-team",
      release_version: releaseContract.releaseVersion,
      api_protocol_version: releaseContract.apiProtocolVersion,
      database_schema_version: releaseContract.databaseSchemaVersion,
      minimum_client_release: releaseContract.minimumClientRelease,
    });

    expect(result.code).toBe("compatible");
    expect(result.clientReleaseVersion).toBe(releaseContract.releaseVersion);
  });

  it("rejects an old health response before authentication or business loading", () => {
    const result = validateBackendHealth({ status: "ok", service: "timemanage-team" });

    expect(result.code).toBe("server_version_contract_missing");
    expect(result.message).toContain("版本过旧");
  });

  it("reads legacy health without business compatibility headers", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ status: "ok", service: "timemanage-team" }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(checkBackendCompatibility("https://example.test/api")).rejects.toMatchObject({
      details: { code: "server_version_contract_missing" },
    });
    expect(fetchMock.mock.calls[0]?.[1]?.headers).toBeUndefined();
  });

  it("rejects protocol and database mismatches separately", () => {
    expect(validateBackendHealth({
      status: "ok",
      release_version: releaseContract.releaseVersion,
      api_protocol_version: releaseContract.apiProtocolVersion + 1,
      database_schema_version: releaseContract.databaseSchemaVersion,
      minimum_client_release: releaseContract.minimumClientRelease,
    }).code).toBe("api_protocol_mismatch");
    expect(validateBackendHealth({
      status: "ok",
      release_version: releaseContract.releaseVersion,
      api_protocol_version: releaseContract.apiProtocolVersion,
      database_schema_version: releaseContract.databaseSchemaVersion - 1,
      minimum_client_release: releaseContract.minimumClientRelease,
    }).code).toBe("database_schema_behind");
    expect(validateBackendHealth({
      status: "ok",
      release_version: releaseContract.releaseVersion,
      api_protocol_version: releaseContract.apiProtocolVersion,
      database_schema_version: releaseContract.databaseSchemaVersion + 1,
      minimum_client_release: releaseContract.minimumClientRelease,
    }).code).toBe("database_schema_ahead");
  });

  it("represents incompatibility as a typed error for the boot gate", () => {
    const details = validateBackendHealth({ status: "ok" });
    const error = new TeamBackendCompatibilityError(details);

    expect(error.details.code).toBe("server_version_contract_missing");
    expect(error.message).toBe(details.message);
  });
});
