export const releaseContract = {
  releaseVersion: "0.2.10",
  apiProtocolVersion: 2,
  databaseSchemaVersion: 13,
  minimumClientRelease: "0.2.10",
} as const;

export type ReleaseContract = typeof releaseContract;
