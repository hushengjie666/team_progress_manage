export const releaseContract = {
  releaseVersion: "0.2.11",
  apiProtocolVersion: 2,
  databaseSchemaVersion: 14,
  minimumClientRelease: "0.2.11",
} as const;

export type ReleaseContract = typeof releaseContract;
