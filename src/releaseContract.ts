export const releaseContract = {
  releaseVersion: "0.2.15",
  apiProtocolVersion: 2,
  databaseSchemaVersion: 18,
  minimumClientRelease: "0.2.15",
} as const;

export type ReleaseContract = typeof releaseContract;
