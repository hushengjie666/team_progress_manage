export const releaseContract = {
  releaseVersion: "0.2.13",
  apiProtocolVersion: 2,
  databaseSchemaVersion: 16,
  minimumClientRelease: "0.2.13",
} as const;

export type ReleaseContract = typeof releaseContract;
