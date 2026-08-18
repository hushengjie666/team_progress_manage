import { describe, expect, it } from "vitest";
import { releaseContract } from "./releaseContract";
import {
  TeamBackendCompatibilityError,
  validateBackendHealth,
} from "./teamBackendCompatibility";

describe("team backend release compatibility", () => {
  it("accepts the exact v0.2.4 contract", () => {
    const result = validateBackendHealth({
      status: "ok",
      service: "timemanage-team",
      release_version: "0.2.4",
      api_protocol_version: 1,
      database_schema_version: 7,
      minimum_client_release: "0.2.4",
    });

    expect(result.code).toBe("compatible");
    expect(result.clientReleaseVersion).toBe(releaseContract.releaseVersion);
  });

  it("rejects an old health response before authentication or business loading", () => {
    const result = validateBackendHealth({ status: "ok", service: "timemanage-team" });

    expect(result.code).toBe("server_version_contract_missing");
    expect(result.message).toContain("版本过旧");
  });

  it("rejects protocol and database mismatches separately", () => {
    expect(validateBackendHealth({
      status: "ok",
      release_version: "0.2.4",
      api_protocol_version: 2,
      database_schema_version: 7,
      minimum_client_release: "0.2.4",
    }).code).toBe("api_protocol_mismatch");
    expect(validateBackendHealth({
      status: "ok",
      release_version: "0.2.4",
      api_protocol_version: 1,
      database_schema_version: 6,
      minimum_client_release: "0.2.4",
    }).code).toBe("database_schema_behind");
    expect(validateBackendHealth({
      status: "ok",
      release_version: "0.2.4",
      api_protocol_version: 1,
      database_schema_version: 8,
      minimum_client_release: "0.2.4",
    }).code).toBe("database_schema_ahead");
  });

  it("represents incompatibility as a typed error for the boot gate", () => {
    const details = validateBackendHealth({ status: "ok" });
    const error = new TeamBackendCompatibilityError(details);

    expect(error.details.code).toBe("server_version_contract_missing");
    expect(error.message).toBe(details.message);
  });
});
