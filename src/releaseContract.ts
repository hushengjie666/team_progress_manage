export const releaseContract = {
  releaseVersion: "0.2.7",
  apiProtocolVersion: 1,
  databaseSchemaVersion: 10,
  minimumClientRelease: "0.2.7",
} as const;

export type ReleaseContract = typeof releaseContract;
