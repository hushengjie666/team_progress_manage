export const releaseContract = {
  releaseVersion: "0.2.8",
  apiProtocolVersion: 1,
  databaseSchemaVersion: 11,
  minimumClientRelease: "0.2.8",
} as const;

export type ReleaseContract = typeof releaseContract;
