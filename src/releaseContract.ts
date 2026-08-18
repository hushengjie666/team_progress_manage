export const releaseContract = {
  releaseVersion: "0.2.4",
  apiProtocolVersion: 1,
  databaseSchemaVersion: 7,
  minimumClientRelease: "0.2.4",
} as const;

export type ReleaseContract = typeof releaseContract;
