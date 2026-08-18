export const releaseContract = {
  releaseVersion: "0.2.6",
  apiProtocolVersion: 1,
  databaseSchemaVersion: 9,
  minimumClientRelease: "0.2.6",
} as const;

export type ReleaseContract = typeof releaseContract;
