export const releaseContract = {
  releaseVersion: "0.2.14",
  apiProtocolVersion: 2,
  databaseSchemaVersion: 17,
  minimumClientRelease: "0.2.14",
} as const;

export type ReleaseContract = typeof releaseContract;
