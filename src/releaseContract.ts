export const releaseContract = {
  releaseVersion: "0.2.9",
  apiProtocolVersion: 2,
  databaseSchemaVersion: 12,
  minimumClientRelease: "0.2.9",
} as const;

export type ReleaseContract = typeof releaseContract;
