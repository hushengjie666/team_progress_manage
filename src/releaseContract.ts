export const releaseContract = {
  releaseVersion: "0.2.17",
  apiProtocolVersion: 2,
  databaseSchemaVersion: 20,
  minimumClientRelease: "0.2.17",
} as const;

export type ReleaseContract = typeof releaseContract;
